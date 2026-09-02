import crypto from "crypto";
import { Response } from "express";
import fileUpload, { UploadedFile } from "express-fileupload";
import { AuthenticatedRequest } from "@constants/common.interface";
import {
	BAD_REQUEST_CODE,
	FORBIDDEN_CODE,
	RESOURCE_NOT_FOUND,
	SERVER_ERROR_CODE,
	SUCCESS_CODE,
} from "@constants/serverCode";
import { UploadCategory } from "@constants/common.enum";
import { getNextSequence } from "@db/counter.model";
import { ReE, ReS } from "@services/generalHelper.service";
import { uploadFiles } from "@utils/fileUpload.helper";
import { Roles } from "src/data/dataInserter";
import { dispatchNotification } from "@services/notificationHandler.service";
import {
	employeeProfileRepository,
	feedbackAuditLogRepository,
	feedbackCaseRepository,
	feedbackInternalNoteRepository,
	feedbackMessageRepository,
	feedbackSettingsRepository,
	roleRepository,
	userRepository,
} from "@repositories";

const DEFAULT_ADMIN_ROLES = [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.HR_EXECUTIVE, Roles.CEO];
const DEFAULT_UNLOCK_ROLES = [Roles.SUPER_ADMIN];

const IDENTITY_FIELDS = [
	"submitter_user_id",
	"employee_code",
	"department",
	"team",
	"submitter_hash",
] as const;

async function getSettings() {
	let settings: any = await feedbackSettingsRepository.findOne({}, { lean: true, sort: { id: 1 } });
	if (!settings) {
		settings = await feedbackSettingsRepository.create({
			confidentiality_notice:
				"Your submission is confidential. Only authorised Admin/HR/Management can access case details.",
			anonymous_notice:
				"Anonymous submissions hide your identity from case handlers. Unlock requires Super Admin and is audited.",
			admin_roles: DEFAULT_ADMIN_ROLES,
			identity_unlock_roles: DEFAULT_UNLOCK_ROLES,
		});
	}
	return settings;
}

function isFeedbackAdmin(role: string | undefined, settings: any) {
	const roles: string[] = settings?.admin_roles?.length ? settings.admin_roles : DEFAULT_ADMIN_ROLES;
	return roles.includes(String(role || ""));
}

function canUnlockIdentity(role: string | undefined, settings: any) {
	const roles: string[] = settings?.identity_unlock_roles?.length
		? settings.identity_unlock_roles
		: DEFAULT_UNLOCK_ROLES;
	return roles.includes(String(role || ""));
}

async function writeAudit(payload: {
	case_ref?: string;
	case_numeric_id?: number | null;
	actor_user_id?: number | null;
	employee_code?: string;
	action: string;
	meta?: Record<string, unknown>;
}) {
	return feedbackAuditLogRepository.create({
		case_ref: payload.case_ref || "",
		case_numeric_id: payload.case_numeric_id ?? null,
		actor_user_id: payload.actor_user_id ?? null,
		employee_code: payload.employee_code || "",
		action: payload.action,
		meta: payload.meta || {},
	});
}

async function nextCaseId(kind: "COMPLAINT" | "SUGGESTION") {
	const year = new Date().getFullYear();
	const prefix = kind === "COMPLAINT" ? "COM" : "SUG";
	const counterName = `feedback_${prefix}_${year}`;
	const seq = await getNextSequence(counterName);
	return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}

function hashSubmitter(userId: number, caseId: string) {
	return crypto.createHash("sha256").update(`${userId}:${caseId}:feedback`).digest("hex");
}

function stripAnonymousIdentity(caseDoc: any, viewer: { role?: string; id: number }, settings: any) {
	if (!caseDoc) return caseDoc;
	const row = { ...caseDoc };
	const unlocked = !!row.identity_unlocked;
	const admin = isFeedbackAdmin(viewer.role, settings);
	const isOwner = row.submitter_user_id === viewer.id;

	if (row.is_anonymous && !unlocked) {
		// Owner of anonymous case: limited own view without exposing in lists as PII to others;
		// still hide identity fields from owner UI for anonymity consistency except case_id tracking
		if (!isOwner || admin) {
			for (const f of IDENTITY_FIELDS) {
				if (f === "submitter_user_id" && isOwner && !admin) continue;
				row[f] = f === "employee_code" ? null : f === "submitter_user_id" ? null : "";
			}
			row.submitter_user_id = null;
			row.employee_code = null;
			row.department = "";
			row.team = "";
			row.submitter_hash = undefined;
		} else if (isOwner && !admin) {
			row.employee_code = null;
			row.department = "";
			row.team = "";
			row.submitter_hash = undefined;
		}
	}

	if (!admin && !isOwner) {
		return null;
	}

	if (!admin && isOwner) {
		// Employee limited fields
		return {
			id: row.id,
			case_id: row.case_id,
			kind: row.kind,
			category: row.category,
			type: row.type,
			priority: row.priority,
			subject: row.subject,
			details: row.details,
			status: row.status,
			is_anonymous: row.is_anonymous,
			preferred_resolution: row.preferred_resolution,
			suggestion_benefit: row.suggestion_benefit,
			suggestion_effort: row.suggestion_effort,
			resolution_summary: row.resolution_summary,
			attachments: row.attachments,
			created_at: row.created_at,
			updated_at: row.updated_at,
		};
	}

	return row;
}

async function getEmployeeMeta(userId: number) {
	const profile: any = await employeeProfileRepository.findOne({ user_id: userId }, { lean: true });
	return {
		employee_code: profile?.employee_code || "",
		department: profile?.department || "",
		team: profile?.team || "",
	};
}

async function notifyAdmins(settings: any, message: string, caseRef: string, meta: Record<string, unknown> = {}) {
	const roles: string[] = settings?.admin_roles?.length ? settings.admin_roles : DEFAULT_ADMIN_ROLES;
	const roleDocs: any[] = await roleRepository.find({ name: { $in: roles } }, { lean: true });
	const roleIds = roleDocs.map((r) => r.id);
	if (!roleIds.length) return;
	const users: any[] = await userRepository.find({ role_id: { $in: roleIds }, deleted_at: null }, { lean: true });
	for (const u of users) {
		try {
			await dispatchNotification({
				userId: u.id,
				message,
				route: "feedback/admin/cases",
				meta: { type: "feedback", case_id: caseRef, ...meta },
			});
		} catch {
			/* non-blocking */
		}
	}
}

function parseJsonField(value: unknown, fallback: any = {}) {
	if (value == null || value === "") return fallback;
	if (typeof value === "object") return value;
	try {
		return JSON.parse(String(value));
	} catch {
		return fallback;
	}
}

function paramId(req: AuthenticatedRequest): string {
	const raw = req.params.id;
	return Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
}

function caseFilter(idOrCase: string) {
	return /^\d+$/.test(idOrCase) ? { id: Number(idOrCase) } : { case_id: idOrCase };
}

class FeedbackController {
	async getPublicNotices(_req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			return ReS(res, SUCCESS_CODE, "Notices", {
				confidentiality_notice: settings.confidentiality_notice,
				anonymous_notice: settings.anonymous_notice,
			});
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async submitComplaint(req: AuthenticatedRequest, res: Response) {
		return this.submitCase(req, res, "COMPLAINT");
	}

	async submitSuggestion(req: AuthenticatedRequest, res: Response) {
		return this.submitCase(req, res, "SUGGESTION");
	}

	private async submitCase(
		req: AuthenticatedRequest,
		res: Response,
		kind: "COMPLAINT" | "SUGGESTION",
	) {
		try {
			const body = req.body || {};
			if (!body.subject) return ReE(res, BAD_REQUEST_CODE, "subject required");
			const settings = await getSettings();
			const is_anonymous = body.is_anonymous === true || body.is_anonymous === "true";
			const meta = await getEmployeeMeta(req.user.id);
			const case_id = await nextCaseId(kind);

			const draft = await feedbackCaseRepository.create({
				case_id,
				kind,
				category: body.category || "",
				type: body.type || "",
				priority: body.priority || (kind === "COMPLAINT" ? "MEDIUM" : "LOW"),
				subject: body.subject,
				details: body.details || "",
				form_fields: parseJsonField(body.form_fields, {}),
				is_anonymous,
				submitter_user_id: req.user.id,
				submitter_hash: hashSubmitter(req.user.id, case_id),
				employee_code: is_anonymous ? null : meta.employee_code || null,
				department: is_anonymous ? "" : meta.department,
				team: is_anonymous ? "" : meta.team,
				status: "SUBMITTED",
				related_user_id: body.related_user_id ? Number(body.related_user_id) : null,
				related_job_ref: body.related_job_ref || "",
				preferred_resolution: body.preferred_resolution || "",
				suggestion_benefit: body.suggestion_benefit || "",
				suggestion_effort: body.suggestion_effort || "",
				attachments: [],
			});

			const filesMap = req.files as fileUpload.FileArray | undefined;
			const fileField = filesMap?.file || filesMap?.attachments;
			if (fileField) {
				const uploaded = await uploadFiles({
					category: UploadCategory.FEEDBACK,
					files: fileField,
					entityId: case_id,
					multiple: true,
					maxSizeMB: 50,
				});
				const list = Array.isArray(uploaded) ? uploaded : [uploaded];
				await feedbackCaseRepository.updateById(draft.id, { $set: { attachments: list } });
			}

			await writeAudit({
				case_ref: case_id,
				case_numeric_id: draft.id,
				actor_user_id: req.user.id,
				employee_code: is_anonymous ? "" : meta.employee_code,
				action: "SUBMIT",
				meta: { kind, is_anonymous, priority: body.priority || "MEDIUM" },
			});

			const safeMsg = `New confidential case ${case_id}`;
			await notifyAdmins(settings, safeMsg, case_id, { kind });

			if (body.priority === "HIGH" || body.priority === "CRITICAL") {
				await notifyAdmins(settings, `Priority ${body.priority}: ${case_id}`, case_id, {
					kind,
					priority: body.priority,
				});
			}

			return ReS(res, SUCCESS_CODE, "Submitted", { case_id, id: draft.id });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async myCases(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			const rows: any[] = await feedbackCaseRepository.find(
				{ submitter_user_id: req.user.id },
				{ lean: true, sort: { created_at: -1 } },
			);
			// Anonymous: employee may track by case_id only (omit from list or limited stub)
			const data = rows
				.filter((r) => !r.is_anonymous)
				.map((r) => stripAnonymousIdentity(r, req.user, settings))
				.filter(Boolean);

			const anonStubs = rows
				.filter((r) => r.is_anonymous)
				.map((r) => ({
					case_id: r.case_id,
					kind: r.kind,
					status: r.status,
					is_anonymous: true,
					subject: "Anonymous submission",
					created_at: r.created_at,
					updated_at: r.updated_at,
				}));

			return ReS(res, SUCCESS_CODE, "My submissions", [...data, ...anonStubs]);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async adminDashboard(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!isFeedbackAdmin(req.user.role, settings)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");

			const rows: any[] = await feedbackCaseRepository.find({}, { lean: true });
			const byStatus = (s: string) => rows.filter((r) => r.status === s).length;
			const counts = {
				total: rows.length,
				complaints: rows.filter((r) => r.kind === "COMPLAINT").length,
				suggestions: rows.filter((r) => r.kind === "SUGGESTION").length,
				submitted: byStatus("SUBMITTED"),
				under_review: byStatus("UNDER_REVIEW"),
				investigation: byStatus("INVESTIGATION"),
				action_required: byStatus("ACTION_REQUIRED"),
				resolved: byStatus("RESOLVED") + byStatus("CLOSED") + byStatus("IMPLEMENTED"),
				anonymous: rows.filter((r) => r.is_anonymous).length,
				critical: rows.filter((r) => r.priority === "CRITICAL" || r.priority === "HIGH").length,
			};
			return ReS(res, SUCCESS_CODE, "Dashboard", counts);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async adminListCases(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!isFeedbackAdmin(req.user.role, settings)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");

			const {
				page = 1,
				limit = 20,
				kind,
				status,
				priority,
				category,
				department,
				anonymous,
				search,
			} = { ...req.query, ...req.body } as any;

			const filter: any = {};
			if (kind) filter.kind = kind;
			if (status) {
				if (String(status).includes(",")) filter.status = { $in: String(status).split(",") };
				else filter.status = status;
			}
			if (priority) filter.priority = priority;
			if (category) filter.category = category;
			if (department) filter.department = department;
			if (anonymous === "1" || anonymous === "true") filter.is_anonymous = true;
			if (search) {
				filter.$or = [
					{ case_id: { $regex: search, $options: "i" } },
					{ subject: { $regex: search, $options: "i" } },
				];
			}

			const { rows, count } = await feedbackCaseRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				sort: { created_at: -1 },
				lean: true,
			});

			const data = (rows as any[]).map((r) => stripAnonymousIdentity(r, req.user, settings));
			return ReS(res, SUCCESS_CODE, "Cases", { data, total: count, page: Number(page) });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async getCase(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			const idOrCase = paramId(req);
			const filter: any = caseFilter(idOrCase);
			const row: any = await feedbackCaseRepository.findOne(filter, { lean: true });
			if (!row) return ReE(res, RESOURCE_NOT_FOUND, "Case not found");

			const admin = isFeedbackAdmin(req.user.role, settings);
			const isOwner = row.submitter_user_id === req.user.id;
			if (!admin && !isOwner) return ReE(res, FORBIDDEN_CODE, "Unauthorized");

			const safe = stripAnonymousIdentity(row, req.user, settings);
			if (!safe) return ReE(res, FORBIDDEN_CODE, "Unauthorized");

			const msgFilter: any = { case_ref: row.case_id };
			if (!admin) msgFilter.visibility = "EMPLOYEE_THREAD";
			else msgFilter.visibility = "EMPLOYEE_THREAD";

			const messages = await feedbackMessageRepository.find(msgFilter, {
				lean: true,
				sort: { created_at: 1 },
			});

			let notes: any[] = [];
			if (admin) {
				notes = await feedbackInternalNoteRepository.find(
					{ case_ref: row.case_id },
					{ lean: true, sort: { created_at: -1 } },
				);
			}

			return ReS(res, SUCCESS_CODE, "Case", { case: safe, messages, notes: admin ? notes : undefined });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateCase(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!isFeedbackAdmin(req.user.role, settings)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");

			const idOrCase = paramId(req);
			const filter: any = caseFilter(idOrCase);
			const existing: any = await feedbackCaseRepository.findOne(filter, { lean: true });
			if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Case not found");

			const allowed = [
				"status",
				"priority",
				"assignee_id",
				"resolution_summary",
				"category",
				"type",
			];
			const patch: any = {};
			for (const f of allowed) {
				if (req.body[f] !== undefined) {
					patch[f] = f === "assignee_id" ? (req.body[f] ? Number(req.body[f]) : null) : req.body[f];
				}
			}

			const updated = await feedbackCaseRepository.updateById(existing.id, { $set: patch });

			await writeAudit({
				case_ref: existing.case_id,
				case_numeric_id: existing.id,
				actor_user_id: req.user.id,
				action: "UPDATE",
				meta: { patch, previous_status: existing.status },
			});

			if (patch.status && patch.status !== existing.status && !existing.is_anonymous) {
				try {
					await dispatchNotification({
						userId: existing.submitter_user_id,
						message: `Case ${existing.case_id} status: ${patch.status}`,
						route: "feedback/my",
						meta: { type: "feedback_status", case_id: existing.case_id },
					});
				} catch {
					/* ignore */
				}
			}

			const safe = stripAnonymousIdentity(updated?.toObject?.() || updated, req.user, settings);
			return ReS(res, SUCCESS_CODE, "Updated", safe);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async addInternalNote(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!isFeedbackAdmin(req.user.role, settings)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const body = req.body?.body;
			if (!body) return ReE(res, BAD_REQUEST_CODE, "body required");

			const idOrCase = paramId(req);
			const filter: any = caseFilter(idOrCase);
			const existing: any = await feedbackCaseRepository.findOne(filter, { lean: true });
			if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Case not found");

			const note = await feedbackInternalNoteRepository.create({
				case_ref: existing.case_id,
				case_numeric_id: existing.id,
				author_user_id: req.user.id,
				body: String(body),
			});

			await writeAudit({
				case_ref: existing.case_id,
				case_numeric_id: existing.id,
				actor_user_id: req.user.id,
				action: "INTERNAL_NOTE",
				meta: { note_id: note.id },
			});

			return ReS(res, SUCCESS_CODE, "Note added", note);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async addMessage(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			const idOrCase = paramId(req);
			const filter: any = caseFilter(idOrCase);
			const existing: any = await feedbackCaseRepository.findOne(filter, { lean: true });
			if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Case not found");

			const admin = isFeedbackAdmin(req.user.role, settings);
			const isOwner = existing.submitter_user_id === req.user.id;
			if (!admin && !isOwner) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			if (!req.body?.body) return ReE(res, BAD_REQUEST_CODE, "body required");

			const msg = await feedbackMessageRepository.create({
				case_ref: existing.case_id,
				case_numeric_id: existing.id,
				author_user_id: req.user.id,
				body: String(req.body.body),
				visibility: "EMPLOYEE_THREAD",
				attachments: [],
			});

			await writeAudit({
				case_ref: existing.case_id,
				case_numeric_id: existing.id,
				actor_user_id: req.user.id,
				action: "MESSAGE",
				meta: { message_id: msg.id },
			});

			const notifyUserId = admin ? existing.submitter_user_id : null;
			if (notifyUserId && !existing.is_anonymous) {
				try {
					await dispatchNotification({
						userId: notifyUserId,
						message: `New message on case ${existing.case_id}`,
						route: "feedback/my",
						meta: { type: "feedback_message", case_id: existing.case_id },
					});
				} catch {
					/* ignore */
				}
			} else if (!admin) {
				await notifyAdmins(settings, `Reply on case ${existing.case_id}`, existing.case_id);
			}

			return ReS(res, SUCCESS_CODE, "Message sent", msg);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async unlockIdentity(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!canUnlockIdentity(req.user.role, settings)) {
				return ReE(res, FORBIDDEN_CODE, "Identity unlock not permitted");
			}
			const idOrCase = paramId(req);
			const filter: any = caseFilter(idOrCase);
			const existing: any = await feedbackCaseRepository.findOne(filter, { lean: true });
			if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Case not found");
			if (!existing.is_anonymous) return ReE(res, BAD_REQUEST_CODE, "Case is not anonymous");

			const reason = req.body?.reason || "";
			const updated = await feedbackCaseRepository.updateById(existing.id, {
				$set: {
					identity_unlocked: true,
					identity_unlocked_by: req.user.id,
					identity_unlocked_at: new Date(),
				},
			});

			await writeAudit({
				case_ref: existing.case_id,
				case_numeric_id: existing.id,
				actor_user_id: req.user.id,
				action: "IDENTITY_UNLOCK",
				meta: { reason, submitter_user_id: existing.submitter_user_id },
			});

			return ReS(res, SUCCESS_CODE, "Identity unlocked", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async listAudit(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!isFeedbackAdmin(req.user.role, settings)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const { page = 1, limit = 50, case_id } = { ...req.query, ...req.body } as any;
			const filter: any = {};
			if (case_id) filter.case_ref = case_id;
			const { rows, count } = await feedbackAuditLogRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				sort: { created_at: -1 },
				lean: true,
			});
			return ReS(res, SUCCESS_CODE, "Audit", { data: rows, total: count });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async getSettings(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!isFeedbackAdmin(req.user.role, settings)) {
				return ReS(res, SUCCESS_CODE, "Notices", {
					confidentiality_notice: settings.confidentiality_notice,
					anonymous_notice: settings.anonymous_notice,
				});
			}
			return ReS(res, SUCCESS_CODE, "Settings", settings);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateSettings(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getSettings();
			if (!isFeedbackAdmin(req.user.role, settings)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const patch: any = {};
			for (const f of [
				"confidentiality_notice",
				"anonymous_notice",
				"admin_roles",
				"identity_unlock_roles",
			]) {
				if (req.body[f] !== undefined) patch[f] = req.body[f];
			}
			const updated = await feedbackSettingsRepository.updateById(settings.id, { $set: patch });
			await writeAudit({
				actor_user_id: req.user.id,
				action: "UPDATE_SETTINGS",
				meta: { patch },
			});
			return ReS(res, SUCCESS_CODE, "Settings updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}
}

export default new FeedbackController();
