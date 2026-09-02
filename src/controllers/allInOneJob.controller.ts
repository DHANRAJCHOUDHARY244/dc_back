import { AuthenticatedRequest } from "@constants/common.interface";
import { UploadCategory } from "@constants/common.enum";
import { BAD_REQUEST_CODE, FORBIDDEN_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { getNextSequence } from "@db/counter.model";
import { allInOneJobRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { getRelativeFilePath, uploadFiles } from "@utils/fileUpload.helper";
import { Response } from "express";
import { fileUpload } from "express-fileupload";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { dispatchNotification } from "@services/notificationHandler.service";

const ALLOWED_MIME = [
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/webp",
	"image/gif",
	"video/mp4",
	"video/quicktime",
	"video/webm",
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/zip",
	"application/x-zip-compressed",
];

const PHOTO_CATEGORIES = new Set([
	"ROOF",
	"METER",
	"SWITCHBOARD",
	"SITE",
	"HOUSE_FRONT",
	"BATTERY_LOCATION",
	"INSTALLATION",
	"MAPS",
	"SIGNATURE",
	"EXISTING",
	"ADDITIONAL",
	"OTHERS",
]);

function emptyCustomer() {
	return {
		name: "",
		customer_ref: "",
		mobile: "",
		alternate_mobile: "",
		email: "",
		address: "",
		state: "",
		postcode: "",
		lead_source: "",
		sales_person: "",
	};
}

function emptyInstallation() {
	return {
		property_type: "",
		roof_type: "",
		storey: "",
		roof_pitch: "",
		roof_height: "",
		switchboard_upgrade: "",
		meter_upgrade: "",
		internet_available: "",
		safety_switch: "",
		existing_solar: "",
		battery_required: "",
		ev_charger: "",
		hot_water: "",
		air_conditioner: "",
		installer_name: "",
		designer: "",
		retailer: "",
		panel_brand: "",
		panel_model: "",
		panel_quantity: 0,
		panel_watt: 0,
		inverter_brand: "",
		inverter_model: "",
		inverter_serial_no: "",
		battery_brand: "",
		battery_model: "",
		battery_capacity: "",
		monitoring_device: "",
		export_limit: "",
		phase: "",
		notes: "",
		status: "PENDING",
	};
}

function emptyPreApproval() {
	return {
		dnsp: "",
		nmi: "",
		meter_number: "",
		tariff: "",
		supply_type: "",
		phase: "",
		export_requested: "",
		system_size: "",
		battery_size: "",
		retailer: "",
		electricity_distributor: "",
		application_number: "",
		status: "DRAFT",
		assigned_staff: "",
		submission_date: null,
		approval_date: null,
		notes: "",
	};
}

function emptyGrid() {
	return {
		grid_connection_number: "",
		meter_exchange: "",
		inspection_date: null,
		retailer_notified: "",
		meter_installed: "",
		compliance_uploaded: "",
		ces: "",
		stc_submitted: "",
		solar_victoria_submitted: "",
		installer_declaration: "",
		customer_acceptance: "",
		status: "PENDING",
		notes: "",
	};
}

async function nextJobNumber() {
	const year = new Date().getFullYear();
	const seq = await getNextSequence(`all_in_one_job_${year}`);
	return `SE-${year}-${String(seq).padStart(4, "0")}`;
}

function pushTimeline(job: any, event: string, userId?: number, meta?: Record<string, unknown>) {
	const timeline = Array.isArray(job.timeline) ? [...job.timeline] : [];
	timeline.push({
		event,
		at: new Date(),
		by: userId || null,
		meta: meta || {},
	});
	return timeline;
}

function mergeObj(base: Record<string, unknown>, patch: unknown) {
	if (!patch || typeof patch !== "object") return base;
	return { ...base, ...(patch as Record<string, unknown>) };
}

class AllInOneJobController {
	async list(req: AuthenticatedRequest, res: Response) {
		try {
			const page = Math.max(1, Number(req.query.page) || 1);
			const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
			const search = req.query.search ? String(req.query.search).trim() : "";
			const overall = req.query.overall_status ? String(req.query.overall_status) : "";
			const paStatus = req.query.pa_status ? String(req.query.pa_status) : "";
			const gridStatus = req.query.grid_status ? String(req.query.grid_status) : "";
			const state = req.query.state ? String(req.query.state) : "";

			const filter: Record<string, unknown> = {};
			if (overall) filter.overall_status = overall;
			if (paStatus) filter["pre_approval.status"] = paStatus;
			if (gridStatus) filter["grid_connection.status"] = gridStatus;
			if (state) filter["customer.state"] = state;
			if (search) {
				filter.$or = [
					{ job_number: { $regex: search, $options: "i" } },
					{ quote_ref: { $regex: search, $options: "i" } },
					{ invoice_ref: { $regex: search, $options: "i" } },
					{ "customer.name": { $regex: search, $options: "i" } },
					{ "customer.mobile": { $regex: search, $options: "i" } },
					{ "customer.email": { $regex: search, $options: "i" } },
					{ "pre_approval.nmi": { $regex: search, $options: "i" } },
					{ "pre_approval.meter_number": { $regex: search, $options: "i" } },
					{ "installation.installer_name": { $regex: search, $options: "i" } },
					{ "customer.sales_person": { $regex: search, $options: "i" } },
				];
			}

			const { rows, count } = await allInOneJobRepository.findPaginated(filter, {
				page,
				limit,
				sort: { id: -1 },
				lean: true,
			});

			return ReS(res, SUCCESS_CODE, "Pre Approval + Grid Assessment jobs fetched.", {
				currentPage: page,
				totalPages: Math.ceil(count / limit) || 1,
				total: count,
				data: rows,
			});
		} catch (err: any) {
			console.error("[allInOne.list]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async dashboard(req: AuthenticatedRequest, res: Response) {
		try {
			const rows = (await allInOneJobRepository.find(
				{},
				{ lean: true, select: "installation pre_approval grid_connection documents photos overall_status" },
			)) as any[];

			const stats = {
				assessmentPending: 0,
				assessmentCompleted: 0,
				preApprovalPending: 0,
				preApprovalApproved: 0,
				gridPending: 0,
				gridCompleted: 0,
				documentsMissing: 0,
				billsMissing: 0,
				stcPending: 0,
				cesPending: 0,
				total: rows.length,
				open: 0,
				completed: 0,
			};

			for (const r of rows) {
				const installStatus = r.installation?.status || "PENDING";
				if (installStatus === "COMPLETED" || installStatus === "DONE") stats.assessmentCompleted += 1;
				else stats.assessmentPending += 1;

				const pa = r.pre_approval?.status || "DRAFT";
				if (pa === "APPROVED") stats.preApprovalApproved += 1;
				else if (["DRAFT", "SUBMITTED", "PENDING", "RESUBMISSION"].includes(pa)) stats.preApprovalPending += 1;

				const gc = r.grid_connection?.status || "PENDING";
				if (gc === "COMPLETED") stats.gridCompleted += 1;
				else if (["PENDING", "SUBMITTED", "APPROVED"].includes(gc)) stats.gridPending += 1;

				const docs = [...(r.documents || []), ...(r.photos || [])];
				if (!docs.length) stats.documentsMissing += 1;
				if (!docs.some((d: any) => d.category === "ELECTRICITY_BILL")) stats.billsMissing += 1;
				if (r.grid_connection?.stc_submitted !== "YES") stats.stcPending += 1;
				if (r.grid_connection?.ces !== "YES") stats.cesPending += 1;

				if (r.overall_status === "COMPLETED") stats.completed += 1;
				else stats.open += 1;
			}

			return ReS(res, SUCCESS_CODE, "Dashboard stats.", stats);
		} catch (err: any) {
			console.error("[allInOne.dashboard]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async getById(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const doc = await allInOneJobRepository.findById(id, { lean: true });
			if (!doc) return ReE(res, BAD_REQUEST_CODE, "Job not found");
			return ReS(res, SUCCESS_CODE, "Job fetched.", doc);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	/**
	 * Public share view — no JWT / no bypass token.
	 * Both MongoDB `_id` and sequential numeric `id` must match.
	 */
	async getPublicById(req: AuthenticatedRequest, res: Response) {
		try {
			const objectId = String(Array.isArray(req.params.objectId) ? req.params.objectId[0] : req.params.objectId || "");
			const idRaw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
			const numericId = Number(idRaw);

			if (!objectId || !mongoose.Types.ObjectId.isValid(objectId)) {
				return ReE(res, BAD_REQUEST_CODE, "Valid MongoDB object id is required");
			}
			if (!numericId || Number.isNaN(numericId)) {
				return ReE(res, BAD_REQUEST_CODE, "Valid numeric job id is required");
			}

			const doc: any = await allInOneJobRepository.findOne(
				{
					_id: new mongoose.Types.ObjectId(objectId),
					id: numericId,
				},
				{ lean: true },
			);

			if (!doc) return ReE(res, BAD_REQUEST_CODE, "Job not found");
			return ReS(res, SUCCESS_CODE, "Job fetched.", doc);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async create(req: AuthenticatedRequest, res: Response) {
		try {
			const body = req.body || {};
			const job_number = await nextJobNumber();
			const created = await allInOneJobRepository.create({
				job_number,
				customer_id: body.customer_id || undefined,
				customer: mergeObj(emptyCustomer(), body.customer),
				quote_source: body.quote_source || "NONE",
				quote_ref: body.quote_ref || "",
				quote_id: body.quote_id || undefined,
				invoice_source: body.invoice_source || "NONE",
				invoice_ref: body.invoice_ref || "",
				invoice_id: body.invoice_id || undefined,
				invoice_kind: body.invoice_kind || "",
				installation: mergeObj(emptyInstallation(), body.installation),
				pre_approval: mergeObj(emptyPreApproval(), body.pre_approval),
				grid_connection: mergeObj(emptyGrid(), body.grid_connection),
				documents: [],
				photos: [],
				pdf_versions: [],
				whatsapp_sends: [],
				whatsapp_numbers: [],
				timeline: [
					{
						event: "JOB_CREATED",
						at: new Date(),
						by: req.user?.id,
						meta: {},
					},
				],
				overall_status: body.overall_status || "OPEN",
				created_by: req.user?.id,
				updated_by: req.user?.id,
			});

			const notifyIds: number[] = Array.isArray(body.notify_user_ids)
				? body.notify_user_ids.map(Number).filter(Boolean)
				: [];
			for (const uid of notifyIds) {
				if (uid === req.user?.id) continue;
				try {
					await dispatchNotification({
						userId: uid,
						message: `Pre Approval + Grid Assessment job ${job_number} created`,
						route: `/all-in-one/job/${(created as any).id}`,
						meta: { type: "ALL_IN_ONE", jobId: (created as any).id, job_number },
					});
				} catch {
					/* */
				}
			}

			return ReS(res, SUCCESS_CODE, "Job created.", created);
		} catch (err: any) {
			console.error("[allInOne.create]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async update(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await allInOneJobRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Job not found");

			const body = req.body || {};
			const $set: Record<string, unknown> = { updated_by: req.user?.id };

			if (body.customer_id !== undefined) $set.customer_id = body.customer_id || null;
			if (body.customer) $set.customer = mergeObj(existing.customer || emptyCustomer(), body.customer);
			if (body.quote_source !== undefined) $set.quote_source = body.quote_source;
			if (body.quote_ref !== undefined) $set.quote_ref = body.quote_ref;
			if (body.quote_id !== undefined) $set.quote_id = body.quote_id || null;
			if (body.invoice_source !== undefined) $set.invoice_source = body.invoice_source;
			if (body.invoice_ref !== undefined) $set.invoice_ref = body.invoice_ref;
			if (body.invoice_id !== undefined) $set.invoice_id = body.invoice_id || null;
			if (body.invoice_kind !== undefined) $set.invoice_kind = body.invoice_kind || "";
			if (body.installation) {
				$set.installation = mergeObj(existing.installation || emptyInstallation(), body.installation);
			}
			if (body.pre_approval) {
				$set.pre_approval = mergeObj(existing.pre_approval || emptyPreApproval(), body.pre_approval);
			}
			if (body.grid_connection) {
				$set.grid_connection = mergeObj(existing.grid_connection || emptyGrid(), body.grid_connection);
			}
			if (body.overall_status) $set.overall_status = body.overall_status;
			if (body.whatsapp_numbers) $set.whatsapp_numbers = body.whatsapp_numbers;

			let timeline = existing.timeline || [];
			if (body.timeline_event) {
				timeline = pushTimeline(existing, String(body.timeline_event), req.user?.id, body.timeline_meta);
				$set.timeline = timeline;
			} else if (body.pre_approval?.status && body.pre_approval.status !== existing.pre_approval?.status) {
				$set.timeline = pushTimeline(existing, `PRE_APPROVAL_${body.pre_approval.status}`, req.user?.id);
			} else if (
				body.grid_connection?.status &&
				body.grid_connection.status !== existing.grid_connection?.status
			) {
				$set.timeline = pushTimeline(existing, `GRID_${body.grid_connection.status}`, req.user?.id);
			} else if (body.installation?.status && body.installation.status !== existing.installation?.status) {
				$set.timeline = pushTimeline(existing, `INSTALLATION_${body.installation.status}`, req.user?.id);
			}

			const updated = await allInOneJobRepository.updateById(id, { $set });

			const statusChanged =
				(body.pre_approval?.status && body.pre_approval.status !== existing.pre_approval?.status) ||
				(body.grid_connection?.status && body.grid_connection.status !== existing.grid_connection?.status) ||
				(body.installation?.status && body.installation.status !== existing.installation?.status) ||
				(body.overall_status && body.overall_status !== existing.overall_status);

			if (statusChanged && existing.created_by && existing.created_by !== req.user?.id) {
				try {
					await dispatchNotification({
						userId: existing.created_by,
						message: `Pre Approval + Grid Assessment job ${existing.job_number} status updated`,
						route: `/all-in-one/job/${id}`,
						meta: { type: "ALL_IN_ONE", jobId: id, job_number: existing.job_number },
					});
				} catch {
					/* */
				}
			}

			return ReS(res, SUCCESS_CODE, "Job updated.", updated);
		} catch (err: any) {
			console.error("[allInOne.update]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async remove(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing = await allInOneJobRepository.findById(id);
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Job not found");
			await allInOneJobRepository.deleteById(id);
			return ReS(res, SUCCESS_CODE, "Job deleted.");
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async uploadDocuments(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await allInOneJobRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Job not found");

			const files = req.files as fileUpload.FileArray | undefined;
			if (!files?.files) return ReE(res, BAD_REQUEST_CODE, "No files uploaded");

			const category = String(req.body?.category || "OTHERS").toUpperCase();
			const uploaded = await uploadFiles({
				category: UploadCategory.ALL_IN_ONE_JOB,
				files: files.files as fileUpload.UploadedFile | fileUpload.UploadedFile[],
				entityId: String(id),
				allowedTypes: ALLOWED_MIME,
				maxSizeMB: 25,
				multiple: true,
			});

			const fileList = Array.isArray(uploaded) ? uploaded : [uploaded];
			const mapped = fileList.map((f: any) => ({
				url: f.url,
				name: f.original_name || f.stored_name || "file",
				mime: f.mime_type || "",
				size: f.size_bytes || 0,
				category,
				uploaded_at: f.uploaded_at || new Date(),
				uploaded_by: req.user?.id,
			}));

			const isPhoto = PHOTO_CATEGORIES.has(category) || (mapped[0]?.mime || "").startsWith("image/");
			const documents = [...(existing.documents || [])];
			const photos = [...(existing.photos || [])];
			if (isPhoto && !["QUOTE_PDF", "INVOICE_PDF", "COMMERCIAL", "ELECTRICITY_BILL", "SLD", "STC", "COES", "VEEC", "DNSP", "PRE_APPROVAL_DOCS", "GRID_DOCS", "COMPLIANCE"].includes(category)) {
				photos.push(...mapped);
			} else {
				documents.push(...mapped);
			}

			const timeline = pushTimeline(existing, "DOCUMENTS_UPLOADED", req.user?.id, {
				count: mapped.length,
				category,
			});

			const updated = await allInOneJobRepository.updateById(id, {
				$set: { documents, photos, timeline, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Documents uploaded.", updated);
		} catch (err: any) {
			console.error("[allInOne.upload]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async deleteDocument(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const { fileUrl } = req.body || {};
			if (!id || !fileUrl) return ReE(res, BAD_REQUEST_CODE, "id and fileUrl are required");
			const existing: any = await allInOneJobRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Job not found");

			const inDocs = (existing.documents || []).some((d: any) => d.url === fileUrl);
			const inPhotos = (existing.photos || []).some((d: any) => d.url === fileUrl);
			if (!inDocs && !inPhotos) return ReE(res, FORBIDDEN_CODE, "File not found on job");

			try {
				const relative = (getRelativeFilePath(fileUrl) || fileUrl || "").replace(/^\//, "");
				const filePath = path.join(process.cwd(), relative);
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			} catch {
				/* */
			}

			const documents = (existing.documents || []).filter((d: any) => d.url !== fileUrl);
			const photos = (existing.photos || []).filter((d: any) => d.url !== fileUrl);
			const timeline = pushTimeline(existing, "DOCUMENT_DELETED", req.user?.id, { fileUrl });

			const updated = await allInOneJobRepository.updateById(id, {
				$set: { documents, photos, timeline, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Document deleted.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}
}

export default new AllInOneJobController();
