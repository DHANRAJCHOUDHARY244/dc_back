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
import { ReE, ReS } from "@services/generalHelper.service";
import { uploadFiles } from "@utils/fileUpload.helper";
import { Roles } from "src/data/dataInserter";
import notificationController from "@controllers/notification.controller";
import {
	employeeProfileRepository,
	roleRepository,
	trainingAssignmentRepository,
	trainingCategoryRepository,
	trainingCourseRepository,
	trainingProgressRepository,
	trainingResourceRepository,
	trainingSettingsRepository,
	trainingVersionRepository,
	userRepository,
} from "@repositories";

const TRAINING_ADMIN_ROLES = [
	Roles.SUPER_ADMIN,
	Roles.CEO,
	Roles.ADMIN,
	Roles.HR_EXECUTIVE,
	Roles.MANAGER,
	Roles.OPERATIONS_MANAGER,
];

function isTrainingAdmin(role?: string) {
	return TRAINING_ADMIN_ROLES.includes(String(role || ""));
}

function slugify(name: string) {
	return String(name || "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function parseJsonField(value: unknown, fallback: any = []) {
	if (value == null || value === "") return fallback;
	if (typeof value === "object") return value;
	try {
		return JSON.parse(String(value));
	} catch {
		return fallback;
	}
}

async function getEmployeeMeta(userId: number) {
	const profile: any = await employeeProfileRepository.findOne({ user_id: userId }, { lean: true });
	return {
		employee_code: profile?.employee_code || "",
		department: profile?.department || "",
		designation: profile?.designation || "",
	};
}

async function getTrainingSettings() {
	let settings: any = await trainingSettingsRepository.findOne({}, { lean: true, sort: { id: 1 } });
	if (!settings) {
		settings = await trainingSettingsRepository.create({
			video_complete_percent: 80,
			pdf_dwell_seconds: 30,
			reminder_days_before_deadline: 3,
		});
	}
	return settings;
}

async function resolveAssigneeUserIds(payload: {
	target_type: string;
	target_value?: string;
	user_id?: number;
	user_ids?: number[];
}) {
	const { target_type, target_value, user_id, user_ids } = payload;
	if (target_type === "USER") {
		if (Array.isArray(user_ids) && user_ids.length) return user_ids.map(Number);
		if (user_id) return [Number(user_id)];
		if (target_value) return [Number(target_value)];
		return [];
	}
	if (target_type === "ROLE") {
		const role =
			(await roleRepository.findOne({ name: target_value }, { lean: true })) ||
			(await roleRepository.findOne({ id: Number(target_value) }, { lean: true }));
		if (!role) return [];
		const users: any[] = await userRepository.find({ role_id: role.id, deleted_at: null }, { lean: true });
		return users.map((u) => u.id);
	}
	if (target_type === "DEPARTMENT") {
		const profiles: any[] = await employeeProfileRepository.find(
			{ department: target_value, deleted_at: null },
			{ lean: true },
		);
		return profiles.map((p) => p.user_id);
	}
	if (target_type === "DESIGNATION") {
		const profiles: any[] = await employeeProfileRepository.find(
			{ designation: target_value, deleted_at: null },
			{ lean: true },
		);
		return profiles.map((p) => p.user_id);
	}
	if (target_type === "COMPANY") {
		const customerRole: any = await roleRepository.findOne({ name: Roles.CUSTOMER }, { lean: true });
		const filter: any = { deleted_at: null };
		if (customerRole) filter.role_id = { $ne: customerRole.id };
		const users: any[] = await userRepository.find(filter, { lean: true });
		return users.map((u) => u.id);
	}
	return [];
}

function detectMediaType(mime?: string, url?: string): string {
	const m = String(mime || "").toLowerCase();
	const u = String(url || "").toLowerCase();
	if (m.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(u)) return "video";
	if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(u)) return "image";
	if (m === "application/pdf" || u.endsWith(".pdf")) return "pdf";
	if (m.includes("zip") || u.endsWith(".zip")) return "zip";
	if (
		m.includes("word") ||
		m.includes("sheet") ||
		m.includes("powerpoint") ||
		m.includes("document") ||
		/\.(docx?|xlsx?|pptx?)$/.test(u)
	) {
		return "document";
	}
	return "other";
}

function computeOverdue(status: string, deadline?: Date | null) {
	if (!deadline || status === "COMPLETED") return status;
	if (new Date(deadline).getTime() < Date.now() && status !== "COMPLETED") return "OVERDUE";
	return status;
}

class TrainingController {
	/* ---------- categories ---------- */
	async listCategories(_req: AuthenticatedRequest, res: Response) {
		try {
			const rows = await trainingCategoryRepository.find(
				{},
				{ lean: true, sort: { sort_order: 1, name: 1 } },
			);
			return ReS(res, SUCCESS_CODE, "Categories", rows);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async createCategory(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const { name, parent_id, description, sort_order, is_active } = req.body || {};
			if (!name) return ReE(res, BAD_REQUEST_CODE, "name required");
			const slug = slugify(name);
			const existing = await trainingCategoryRepository.findOne({ slug }, { lean: true });
			if (existing) return ReE(res, BAD_REQUEST_CODE, "Category already exists");
			const row = await trainingCategoryRepository.create({
				name,
				slug,
				parent_id: parent_id ?? null,
				description: description || "",
				sort_order: Number(sort_order || 0),
				is_active: is_active !== false,
			});
			return ReS(res, SUCCESS_CODE, "Category created", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateCategory(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const id = Number(req.params.id);
			const patch: any = { ...req.body };
			if (patch.name) patch.slug = slugify(patch.name);
			const row = await trainingCategoryRepository.updateById(id, { $set: patch });
			if (!row) return ReE(res, RESOURCE_NOT_FOUND, "Category not found");
			return ReS(res, SUCCESS_CODE, "Category updated", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async deleteCategory(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const id = Number(req.params.id);
			await trainingCategoryRepository.softDeleteById(id);
			return ReS(res, SUCCESS_CODE, "Category deleted", { id });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- resources ---------- */
	async listResources(req: AuthenticatedRequest, res: Response) {
		try {
			const {
				page = 1,
				limit = 20,
				search,
				category,
				category_id,
				media_type,
				type,
				mandatory,
				status,
				mine,
			} = { ...req.query, ...req.body } as any;

			const filter: any = {};
			const isAdmin = isTrainingAdmin(req.user.role);

			if (!isAdmin || String(mine) === "1") {
				filter.status = "PUBLISHED";
			} else if (status) {
				filter.status = status;
			}

			if (category_id) filter.category_id = Number(category_id);
			if (category) {
				const cat: any = await trainingCategoryRepository.findOne(
					{ $or: [{ slug: String(category).toLowerCase() }, { name: new RegExp(`^${category}$`, "i") }] },
					{ lean: true },
				);
				if (cat) filter.category_id = cat.id;
			}
			const media = media_type || type;
			if (media) filter.media_type = String(media).toLowerCase();
			if (mandatory === true || mandatory === "1" || mandatory === "true") filter.is_mandatory = true;
			if (search) {
				filter.$or = [
					{ title: { $regex: search, $options: "i" } },
					{ description: { $regex: search, $options: "i" } },
				];
			}

			const { rows, count } = await trainingResourceRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				sort: { updated_at: -1 },
				lean: true,
			});

			return ReS(res, SUCCESS_CODE, "Resources", { data: rows, total: count, page: Number(page) });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async getResource(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const row: any = await trainingResourceRepository.findById(id, { lean: true });
			if (!row) return ReE(res, RESOURCE_NOT_FOUND, "Resource not found");
			if (row.status !== "PUBLISHED" && !isTrainingAdmin(req.user.role)) {
				return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			}
			return ReS(res, SUCCESS_CODE, "Resource", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async createResource(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const body = req.body || {};
			if (!body.title) return ReE(res, BAD_REQUEST_CODE, "title required");

			const mediaHint = body.media_type || "document";
			const defaultRule =
				body.completion_rule ||
				(mediaHint === "video" ? "WATCH_PERCENT" : mediaHint === "pdf" ? "DWELL_SECONDS" : "OPEN");

			const draft = await trainingResourceRepository.create({
				title: body.title,
				description: body.description || "",
				category_id: body.category_id ? Number(body.category_id) : null,
				subcategory_id: body.subcategory_id ? Number(body.subcategory_id) : null,
				media_type: mediaHint,
				external_url: body.external_url || "",
				trainer_user_id: body.trainer_user_id ? Number(body.trainer_user_id) : req.user.id,
				version: body.version || "1.0",
				language: body.language || "en",
				role_names: parseJsonField(body.role_names, []),
				departments: parseJsonField(body.departments, []),
				is_mandatory: body.is_mandatory === true || body.is_mandatory === "true",
				estimated_minutes: Number(body.estimated_minutes || 15),
				status: body.status || "DRAFT",
				publish_date: body.publish_date || null,
				expiry_date: body.expiry_date || null,
				completion_rule: defaultRule,
				completion_threshold: Number(body.completion_threshold || 80),
				file: {},
			});

			const filesMap = req.files as fileUpload.FileArray | undefined;
			const file = filesMap?.file as UploadedFile | UploadedFile[] | undefined;
			if (file) {
				const uploaded = await uploadFiles({
					category: UploadCategory.TRAINING,
					files: file,
					entityId: draft.id,
					multiple: false,
					maxSizeMB: 200,
				});
				const media_type = body.media_type || detectMediaType(uploaded.mime_type, uploaded.url);
				await trainingResourceRepository.updateById(draft.id, {
					$set: { file: uploaded, media_type },
				});
				await trainingVersionRepository.create({
					resource_id: draft.id,
					version: draft.version || "1.0",
					file: uploaded,
					external_url: body.external_url || "",
					changed_by: req.user.id,
					change_note: "Initial upload",
				});
			} else if (body.external_url) {
				await trainingResourceRepository.updateById(draft.id, {
					$set: { media_type: body.media_type || "link" },
				});
			}

			const row = await trainingResourceRepository.findById(draft.id, { lean: true });
			return ReS(res, SUCCESS_CODE, "Resource created", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateResource(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const id = Number(req.params.id);
			const existing: any = await trainingResourceRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Resource not found");

			const body = req.body || {};
			const patch: any = {};
			const fields = [
				"title",
				"description",
				"category_id",
				"subcategory_id",
				"media_type",
				"external_url",
				"trainer_user_id",
				"version",
				"language",
				"is_mandatory",
				"estimated_minutes",
				"status",
				"publish_date",
				"expiry_date",
				"completion_rule",
				"completion_threshold",
			];
			for (const f of fields) {
				if (body[f] !== undefined) {
					if (["category_id", "subcategory_id", "trainer_user_id", "estimated_minutes", "completion_threshold"].includes(f)) {
						patch[f] = body[f] === null || body[f] === "" ? null : Number(body[f]);
					} else if (f === "is_mandatory") {
						patch[f] = body[f] === true || body[f] === "true";
					} else {
						patch[f] = body[f];
					}
				}
			}
			if (body.role_names !== undefined) patch.role_names = parseJsonField(body.role_names, []);
			if (body.departments !== undefined) patch.departments = parseJsonField(body.departments, []);

			const filesMap = req.files as fileUpload.FileArray | undefined;
			const file = filesMap?.file as UploadedFile | UploadedFile[] | undefined;
			if (file) {
				const uploaded = await uploadFiles({
					category: UploadCategory.TRAINING,
					files: file,
					entityId: id,
					multiple: false,
					maxSizeMB: 200,
				});
				patch.file = uploaded;
				if (!patch.media_type) patch.media_type = detectMediaType(uploaded.mime_type, uploaded.url);
				const nextVersion = body.version || bumpVersion(existing.version);
				patch.version = nextVersion;
				await trainingVersionRepository.create({
					resource_id: id,
					version: nextVersion,
					file: uploaded,
					external_url: patch.external_url ?? existing.external_url,
					changed_by: req.user.id,
					change_note: body.change_note || "File updated",
				});
			}

			const row = await trainingResourceRepository.updateById(id, { $set: patch });
			return ReS(res, SUCCESS_CODE, "Resource updated", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async deleteResource(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const id = Number(req.params.id);
			await trainingResourceRepository.softDeleteById(id);
			return ReS(res, SUCCESS_CODE, "Resource deleted", { id });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- courses ---------- */
	async listCourses(req: AuthenticatedRequest, res: Response) {
		try {
			const { page = 1, limit = 20, search, status, mandatory } = { ...req.query, ...req.body } as any;
			const filter: any = {};
			if (!isTrainingAdmin(req.user.role)) filter.status = "PUBLISHED";
			else if (status) filter.status = status;
			if (mandatory === true || mandatory === "1") filter.is_mandatory = true;
			if (search) filter.title = { $regex: search, $options: "i" };
			const { rows, count } = await trainingCourseRepository.findPaginated(filter, {
				page: Number(page),
				limit: Number(limit),
				sort: { updated_at: -1 },
				lean: true,
			});
			return ReS(res, SUCCESS_CODE, "Courses", { data: rows, total: count });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async createCourse(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const body = req.body || {};
			if (!body.title) return ReE(res, BAD_REQUEST_CODE, "title required");
			const row = await trainingCourseRepository.create({
				title: body.title,
				description: body.description || "",
				category_id: body.category_id ? Number(body.category_id) : null,
				is_mandatory: !!body.is_mandatory,
				status: body.status || "DRAFT",
				modules: parseJsonField(body.modules, []),
				role_names: parseJsonField(body.role_names, []),
				departments: parseJsonField(body.departments, []),
				estimated_minutes: Number(body.estimated_minutes || 0),
				publish_date: body.publish_date || null,
			});
			return ReS(res, SUCCESS_CODE, "Course created", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateCourse(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const id = Number(req.params.id);
			const body = req.body || {};
			const patch: any = { ...body };
			if (body.modules !== undefined) patch.modules = parseJsonField(body.modules, []);
			if (body.role_names !== undefined) patch.role_names = parseJsonField(body.role_names, []);
			if (body.departments !== undefined) patch.departments = parseJsonField(body.departments, []);
			const row = await trainingCourseRepository.updateById(id, { $set: patch });
			if (!row) return ReE(res, RESOURCE_NOT_FOUND, "Course not found");
			return ReS(res, SUCCESS_CODE, "Course updated", row);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- assignments ---------- */
	async createAssignment(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const body = req.body || {};
			const resource_id = body.resource_id ? Number(body.resource_id) : null;
			const course_id = body.course_id ? Number(body.course_id) : null;
			if (!resource_id && !course_id) return ReE(res, BAD_REQUEST_CODE, "resource_id or course_id required");
			if (!body.target_type) return ReE(res, BAD_REQUEST_CODE, "target_type required");

			const assignment = await trainingAssignmentRepository.create({
				resource_id,
				course_id,
				target_type: body.target_type,
				target_value: body.target_value || "",
				user_id: body.user_id ? Number(body.user_id) : null,
				is_mandatory: !!body.is_mandatory,
				deadline: body.deadline || null,
				assigned_by: req.user.id,
				notes: body.notes || "",
			});

			const userIds = await resolveAssigneeUserIds({
				target_type: body.target_type,
				target_value: body.target_value,
				user_id: body.user_id,
				user_ids: body.user_ids,
			});

			const resource: any = resource_id
				? await trainingResourceRepository.findById(resource_id, { lean: true })
				: null;
			const course: any = course_id
				? await trainingCourseRepository.findById(course_id, { lean: true })
				: null;
			const title = resource?.title || course?.title || "training";
			const is_mandatory = !!body.is_mandatory || !!resource?.is_mandatory || !!course?.is_mandatory;

			let progressCreated = 0;
			for (const uid of userIds) {
				const meta = await getEmployeeMeta(uid);
				const existingFilter: any = { user_id: uid };
				if (resource_id) existingFilter.resource_id = resource_id;
				if (course_id) existingFilter.course_id = course_id;
				const existing: any = await trainingProgressRepository.findOne(existingFilter, { lean: true });
				if (existing) {
					await trainingProgressRepository.updateById(existing.id, {
						$set: {
							assignment_id: assignment.id,
							is_mandatory,
							deadline: body.deadline || existing.deadline,
							status: computeOverdue(existing.status, body.deadline || existing.deadline),
						},
					});
				} else {
					await trainingProgressRepository.create({
						user_id: uid,
						employee_code: meta.employee_code,
						resource_id,
						course_id,
						assignment_id: assignment.id,
						status: "ASSIGNED",
						progress_percent: 0,
						is_mandatory,
						deadline: body.deadline || null,
					});
					progressCreated += 1;
				}

				try {
					await notificationController.createNotification({
						userId: uid,
						message: `New training assigned: ${title}${body.deadline ? ` (due ${new Date(body.deadline).toLocaleDateString()})` : ""}`,
						route: "training/my",
						meta: { type: "training_assign", resource_id, course_id, assignment_id: assignment.id },
					});
				} catch {
					/* non-blocking */
				}
			}

			return ReS(res, SUCCESS_CODE, "Assignment created", {
				assignment,
				assignees: userIds.length,
				progress_created: progressCreated,
			});
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- my training / dashboard ---------- */
	async myDashboard(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = req.user.id;
			const rows: any[] = await trainingProgressRepository.find({ user_id: userId }, { lean: true });
			const now = Date.now();
			const enriched = rows.map((r) => {
				const status = computeOverdue(r.status, r.deadline);
				return { ...r, status };
			});
			const counts = {
				assigned: enriched.length,
				completed: enriched.filter((r) => r.status === "COMPLETED").length,
				pending: enriched.filter((r) => ["ASSIGNED", "PENDING", "STARTED", "IN_PROGRESS"].includes(r.status)).length,
				overdue: enriched.filter((r) => r.status === "OVERDUE" || (r.deadline && new Date(r.deadline).getTime() < now && r.status !== "COMPLETED")).length,
				in_progress: enriched.filter((r) => ["STARTED", "IN_PROGRESS"].includes(r.status)).length,
			};
			return ReS(res, SUCCESS_CODE, "My dashboard", { counts, recent: enriched.slice(0, 10) });
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async myAssignments(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = req.user.id;
			const { mandatory, status } = req.query as any;
			const filter: any = { user_id: userId };
			if (mandatory === "1" || mandatory === "true") filter.is_mandatory = true;
			const rows: any[] = await trainingProgressRepository.find(filter, {
				lean: true,
				sort: { updated_at: -1 },
			});

			const resourceIds = [...new Set(rows.map((r) => r.resource_id).filter(Boolean))];
			const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))];
			const resources: any[] = resourceIds.length
				? await trainingResourceRepository.find({ id: { $in: resourceIds } }, { lean: true })
				: [];
			const courses: any[] = courseIds.length
				? await trainingCourseRepository.find({ id: { $in: courseIds } }, { lean: true })
				: [];
			const resourceMap = Object.fromEntries(resources.map((r) => [r.id, r]));
			const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));

			let data = rows.map((r) => ({
				...r,
				status: computeOverdue(r.status, r.deadline),
				resource: r.resource_id ? resourceMap[r.resource_id] || null : null,
				course: r.course_id ? courseMap[r.course_id] || null : null,
			}));
			if (status) data = data.filter((r) => r.status === status);

			return ReS(res, SUCCESS_CODE, "My assignments", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async myProgressHistory(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = req.user.id;
			const isAdmin = isTrainingAdmin(req.user.role);
			const filter: any = {};
			if (!isAdmin || !req.query.user_id) filter.user_id = userId;
			else filter.user_id = Number(req.query.user_id);

			const rows: any[] = await trainingProgressRepository.find(filter, {
				lean: true,
				sort: { updated_at: -1 },
				limit: 200,
			});
			const resourceIds = [...new Set(rows.map((r) => r.resource_id).filter(Boolean))];
			const resources: any[] = resourceIds.length
				? await trainingResourceRepository.find({ id: { $in: resourceIds } }, { lean: true })
				: [];
			const resourceMap = Object.fromEntries(resources.map((r) => [r.id, r]));
			const data = rows.map((r) => ({
				...r,
				status: computeOverdue(r.status, r.deadline),
				resource_title: r.resource_id ? resourceMap[r.resource_id]?.title : null,
			}));
			return ReS(res, SUCCESS_CODE, "Progress history", data);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- progress engine ---------- */
	async progressStart(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = req.user.id;
			const { resource_id, course_id } = req.body || {};
			if (!resource_id && !course_id) return ReE(res, BAD_REQUEST_CODE, "resource_id required");

			const meta = await getEmployeeMeta(userId);
			const filter: any = { user_id: userId };
			if (resource_id) filter.resource_id = Number(resource_id);
			if (course_id) filter.course_id = Number(course_id);

			let progress: any = await trainingProgressRepository.findOne(filter, { lean: true });
			const now = new Date();
			if (!progress) {
				const resource: any = resource_id
					? await trainingResourceRepository.findById(Number(resource_id), { lean: true })
					: null;
				progress = await trainingProgressRepository.create({
					user_id: userId,
					employee_code: meta.employee_code,
					resource_id: resource_id ? Number(resource_id) : null,
					course_id: course_id ? Number(course_id) : null,
					status: "STARTED",
					progress_percent: 0,
					opened_at: now,
					started_at: now,
					last_accessed_at: now,
					is_mandatory: !!resource?.is_mandatory,
				});
			} else if (progress.status === "ASSIGNED" || progress.status === "PENDING") {
				progress = await trainingProgressRepository.updateById(progress.id, {
					$set: {
						status: "STARTED",
						opened_at: progress.opened_at || now,
						started_at: progress.started_at || now,
						last_accessed_at: now,
						employee_code: progress.employee_code || meta.employee_code,
					},
				});
			} else {
				progress = await trainingProgressRepository.updateById(progress.id, {
					$set: { last_accessed_at: now },
				});
			}

			return ReS(res, SUCCESS_CODE, "Progress started", progress);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async progressHeartbeat(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = req.user.id;
			const { resource_id, course_id, watch_percent, dwell_seconds, progress_percent } = req.body || {};
			if (!resource_id && !course_id) return ReE(res, BAD_REQUEST_CODE, "resource_id required");

			const filter: any = { user_id: userId };
			if (resource_id) filter.resource_id = Number(resource_id);
			if (course_id) filter.course_id = Number(course_id);

			let progress: any = await trainingProgressRepository.findOne(filter, { lean: true });
			if (!progress) {
				const meta = await getEmployeeMeta(userId);
				const resource: any = resource_id
					? await trainingResourceRepository.findById(Number(resource_id), { lean: true })
					: null;
				const now = new Date();
				progress = await trainingProgressRepository.create({
					user_id: userId,
					employee_code: meta.employee_code,
					resource_id: resource_id ? Number(resource_id) : null,
					course_id: course_id ? Number(course_id) : null,
					status: "STARTED",
					progress_percent: 0,
					opened_at: now,
					started_at: now,
					last_accessed_at: now,
					is_mandatory: !!resource?.is_mandatory,
				});
			}
			if (progress.status === "COMPLETED") {
				return ReS(res, SUCCESS_CODE, "Already completed", progress);
			}

			const settings = await getTrainingSettings();
			const resource: any = progress.resource_id
				? await trainingResourceRepository.findById(progress.resource_id, { lean: true })
				: null;

			const patch: any = {
				last_accessed_at: new Date(),
				status: "IN_PROGRESS",
			};
			if (watch_percent != null) patch.watch_percent = Math.max(progress.watch_percent || 0, Number(watch_percent));
			if (dwell_seconds != null) patch.dwell_seconds = Math.max(progress.dwell_seconds || 0, Number(dwell_seconds));
			if (progress_percent != null) {
				patch.progress_percent = Math.max(progress.progress_percent || 0, Number(progress_percent));
			} else if (patch.watch_percent != null) {
				patch.progress_percent = patch.watch_percent;
			}

			const rule = resource?.completion_rule || (resource?.media_type === "video" ? "WATCH_PERCENT" : "OPEN");
			const threshold =
				resource?.completion_threshold ||
				(rule === "WATCH_PERCENT" ? settings.video_complete_percent : settings.pdf_dwell_seconds);

			let shouldComplete = false;
			if (rule === "WATCH_PERCENT" && (patch.watch_percent ?? progress.watch_percent) >= threshold) {
				shouldComplete = true;
			} else if (rule === "DWELL_SECONDS" && (patch.dwell_seconds ?? progress.dwell_seconds) >= threshold) {
				shouldComplete = true;
			} else if (rule === "OPEN") {
				const dwellNeed = settings.pdf_dwell_seconds || 30;
				if ((patch.dwell_seconds ?? progress.dwell_seconds ?? 0) >= dwellNeed) {
					shouldComplete = true;
				} else if ((patch.watch_percent ?? progress.watch_percent ?? 0) >= (settings.video_complete_percent || 80)) {
					shouldComplete = true;
				}
			}

			if (shouldComplete) {
				patch.status = "COMPLETED";
				patch.progress_percent = 100;
				patch.completed_at = new Date();
			}

			progress = await trainingProgressRepository.updateById(progress.id, { $set: patch });

			if (shouldComplete) {
				try {
					await notificationController.createNotification({
						userId,
						message: `Training completed: ${resource?.title || "resource"}`,
						route: "training/my",
						meta: { type: "training_completed", resource_id: progress.resource_id },
					});
				} catch {
					/* ignore */
				}
			}

			return ReS(res, SUCCESS_CODE, shouldComplete ? "Completed" : "Progress updated", progress);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async progressComplete(req: AuthenticatedRequest, res: Response) {
		try {
			const userId = req.user.id;
			const { resource_id, course_id } = req.body || {};
			if (!resource_id && !course_id) return ReE(res, BAD_REQUEST_CODE, "resource_id required");

			const filter: any = { user_id: userId };
			if (resource_id) filter.resource_id = Number(resource_id);
			if (course_id) filter.course_id = Number(course_id);
			const progress: any = await trainingProgressRepository.findOne(filter, { lean: true });
			if (!progress) return ReE(res, RESOURCE_NOT_FOUND, "Progress not found");
			if (progress.status === "COMPLETED") return ReS(res, SUCCESS_CODE, "Already completed", progress);

			const resource: any = progress.resource_id
				? await trainingResourceRepository.findById(progress.resource_id, { lean: true })
				: null;

			// Mandatory items cannot be self-marked complete
			if (progress.is_mandatory || resource?.is_mandatory) {
				return ReE(
					res,
					FORBIDDEN_CODE,
					"Mandatory training can only complete via watch/view progress rules",
				);
			}

			const settings = await getTrainingSettings();
			const rule = resource?.completion_rule || "OPEN";
			if (rule === "WATCH_PERCENT") {
				const need = resource?.completion_threshold || settings.video_complete_percent;
				if ((progress.watch_percent || 0) < need) {
					return ReE(res, BAD_REQUEST_CODE, `Watch at least ${need}% to complete`);
				}
			}
			if (rule === "DWELL_SECONDS") {
				const need = resource?.completion_threshold || settings.pdf_dwell_seconds;
				if ((progress.dwell_seconds || 0) < need) {
					return ReE(res, BAD_REQUEST_CODE, `View for at least ${need}s to complete`);
				}
			}

			const updated = await trainingProgressRepository.updateById(progress.id, {
				$set: {
					status: "COMPLETED",
					progress_percent: 100,
					completed_at: new Date(),
					last_accessed_at: new Date(),
				},
			});
			return ReS(res, SUCCESS_CODE, "Completed", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	/* ---------- settings / reports ---------- */
	async getSettings(req: AuthenticatedRequest, res: Response) {
		try {
			const settings = await getTrainingSettings();
			return ReS(res, SUCCESS_CODE, "Settings", settings);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async updateSettings(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const settings = await getTrainingSettings();
			const updated = await trainingSettingsRepository.updateById(settings.id, {
				$set: {
					video_complete_percent: Number(req.body.video_complete_percent ?? settings.video_complete_percent),
					pdf_dwell_seconds: Number(req.body.pdf_dwell_seconds ?? settings.pdf_dwell_seconds),
					reminder_days_before_deadline: Number(
						req.body.reminder_days_before_deadline ?? settings.reminder_days_before_deadline,
					),
				},
			});
			return ReS(res, SUCCESS_CODE, "Settings updated", updated);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}

	async reportsSummary(req: AuthenticatedRequest, res: Response) {
		try {
			if (!isTrainingAdmin(req.user.role)) return ReE(res, FORBIDDEN_CODE, "Unauthorized");
			const [resources, courses, assignments, progress] = await Promise.all([
				trainingResourceRepository.count({}),
				trainingCourseRepository.count({}),
				trainingAssignmentRepository.count({}),
				trainingProgressRepository.find({}, { lean: true }),
			]);
			const rows: any[] = progress as any[];
			const summary = {
				resources,
				courses,
				assignments,
				progress_total: rows.length,
				completed: rows.filter((r) => r.status === "COMPLETED").length,
				in_progress: rows.filter((r) => ["STARTED", "IN_PROGRESS"].includes(r.status)).length,
				overdue: rows.filter((r) => computeOverdue(r.status, r.deadline) === "OVERDUE").length,
				mandatory_pending: rows.filter((r) => r.is_mandatory && r.status !== "COMPLETED").length,
			};
			return ReS(res, SUCCESS_CODE, "Summary", summary);
		} catch (e: any) {
			return ReE(res, SERVER_ERROR_CODE, e.message);
		}
	}
}

function bumpVersion(v?: string) {
	const m = String(v || "1.0").match(/^(\d+)\.(\d+)$/);
	if (!m) return "1.1";
	return `${m[1]}.${Number(m[2]) + 1}`;
}

export default new TrainingController();
