import { AuthenticatedRequest } from "@constants/common.interface";
import { UploadCategory } from "@constants/common.enum";
import { BAD_REQUEST_CODE, FORBIDDEN_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { accountsPreApprovalGridRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { getRelativeFilePath, uploadFiles } from "@utils/fileUpload.helper";
import { Response } from "express";
import { fileUpload } from "express-fileupload";
import fs from "fs";
import path from "path";

const ALLOWED_MIME = [
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/webp",
	"image/gif",
	"application/pdf",
];

const SERVICE_TYPES = ["PRE_APPROVAL", "GRID_CONNECTION", "BOTH"] as const;

function sanitizeBody(body: Record<string, unknown>) {
	const allowed = [
		"quotation_number",
		"record_date",
		"amount",
		"currency",
		"service_type",
		"status",
		"paid_date",
		"notes",
		"retailer",
		"dnsp",
		"nmi",
		"reference_number",
		"customer_name",
		"customer_email",
		"customer_phone",
		"customer_address",
		"customer_company",
	] as const;

	const out: Record<string, unknown> = {};
	for (const key of allowed) {
		if (body[key] !== undefined) out[key] = body[key];
	}
	if (out.amount != null) out.amount = Number(out.amount) || 0;
	if (out.record_date) out.record_date = new Date(String(out.record_date));
	if (out.paid_date) out.paid_date = new Date(String(out.paid_date));
	else if (out.paid_date === null || out.paid_date === "") out.paid_date = null;

	if (out.service_type && !SERVICE_TYPES.includes(out.service_type as (typeof SERVICE_TYPES)[number])) {
		out.service_type = "PRE_APPROVAL";
	}
	if (out.status && !["PAID", "UNPAID"].includes(String(out.status))) {
		out.status = "UNPAID";
	}
	if (out.status === "PAID" && !out.paid_date) out.paid_date = new Date();
	if (out.status === "UNPAID") out.paid_date = null;
	return out;
}

class AccountsPreApprovalGridController {
	async list(req: AuthenticatedRequest, res: Response) {
		try {
			const page = Math.max(1, Number(req.query.page) || 1);
			const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
			const status = req.query.status ? String(req.query.status) : undefined;
			const serviceType = req.query.service_type ? String(req.query.service_type) : undefined;
			const search = req.query.search ? String(req.query.search).trim() : "";
			const start = req.query.start_date ? new Date(String(req.query.start_date)) : undefined;
			const end = req.query.end_date ? new Date(String(req.query.end_date)) : undefined;

			const filter: Record<string, unknown> = {};
			if (status === "PAID" || status === "UNPAID") filter.status = status;
			if (serviceType && SERVICE_TYPES.includes(serviceType as (typeof SERVICE_TYPES)[number])) {
				filter.service_type = serviceType;
			}
			if (start || end) {
				filter.record_date = {
					...(start ? { $gte: start } : {}),
					...(end ? { $lte: end } : {}),
				};
			}
			if (search) {
				filter.$or = [
					{ quotation_number: { $regex: search, $options: "i" } },
					{ reference_number: { $regex: search, $options: "i" } },
					{ customer_name: { $regex: search, $options: "i" } },
					{ customer_email: { $regex: search, $options: "i" } },
					{ retailer: { $regex: search, $options: "i" } },
					{ dnsp: { $regex: search, $options: "i" } },
					{ nmi: { $regex: search, $options: "i" } },
				];
			}

			const { rows, count } = await accountsPreApprovalGridRepository.findPaginated(filter, {
				page,
				limit,
				sort: { record_date: -1, id: -1 },
				lean: true,
			});

			const matchBase: Record<string, unknown> = {
				deleted_at: null,
				...(filter.status ? { status: filter.status } : {}),
				...(filter.service_type ? { service_type: filter.service_type } : {}),
				...(filter.record_date ? { record_date: filter.record_date } : {}),
			};

			const [summaryRows, byTypeRows] = await Promise.all([
				accountsPreApprovalGridRepository.aggregateRaw([
					{ $match: matchBase },
					{
						$group: {
							_id: "$status",
							total: { $sum: "$amount" },
							count: { $sum: 1 },
						},
					},
				]),
				accountsPreApprovalGridRepository.aggregateRaw([
					{ $match: matchBase },
					{
						$group: {
							_id: "$service_type",
							total: { $sum: "$amount" },
							count: { $sum: 1 },
						},
					},
				]),
			]);

			const summary = { paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0, total: 0, count: 0 };
			(summaryRows as any[]).forEach((r) => {
				const amt = Number(r.total) || 0;
				const c = Number(r.count) || 0;
				summary.total += amt;
				summary.count += c;
				if (r._id === "PAID") {
					summary.paid = amt;
					summary.paidCount = c;
				} else {
					summary.unpaid = amt;
					summary.unpaidCount = c;
				}
			});

			const byServiceType: Record<string, { total: number; count: number }> = {};
			(byTypeRows as any[]).forEach((r) => {
				if (!r._id) return;
				byServiceType[String(r._id)] = {
					total: Number(r.total) || 0,
					count: Number(r.count) || 0,
				};
			});

			return ReS(res, SUCCESS_CODE, "Accounts pre-approval / grid records fetched.", {
				currentPage: page,
				totalPages: Math.ceil(count / limit) || 1,
				total: count,
				summary,
				byServiceType,
				data: rows,
			});
		} catch (err: any) {
			console.error("[accountsPreApprovalGrid.list]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async getById(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const doc = await accountsPreApprovalGridRepository.findById(id, { lean: true });
			if (!doc) return ReE(res, BAD_REQUEST_CODE, "Record not found");
			return ReS(res, SUCCESS_CODE, "Record fetched.", doc);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async create(req: AuthenticatedRequest, res: Response) {
		try {
			const data = sanitizeBody(req.body || {});
			if (!data.quotation_number || !data.record_date || !data.service_type) {
				return ReE(res, BAD_REQUEST_CODE, "quotation_number, record_date and service_type are required");
			}
			const created = await accountsPreApprovalGridRepository.create({
				...data,
				attachments: [],
				created_by: req.user?.id,
				updated_by: req.user?.id,
			});
			return ReS(res, SUCCESS_CODE, "Record created.", created);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async update(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing = await accountsPreApprovalGridRepository.findById(id);
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Record not found");

			const data = sanitizeBody(req.body || {});
			const updated = await accountsPreApprovalGridRepository.updateById(id, {
				$set: { ...data, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Record updated.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async remove(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await accountsPreApprovalGridRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Record not found");

			for (const att of existing.attachments || []) {
				try {
					const relative = (getRelativeFilePath(att.url) || att.url || "").replace(/^\//, "");
					const filePath = path.join(process.cwd(), relative);
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch {
					/* ignore */
				}
			}

			await accountsPreApprovalGridRepository.deleteById(id);
			return ReS(res, SUCCESS_CODE, "Record deleted.");
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async uploadAttachments(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await accountsPreApprovalGridRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Record not found");

			const files = req.files as fileUpload.FileArray | undefined;
			if (!files?.files) return ReE(res, BAD_REQUEST_CODE, "No files uploaded");

			const uploaded = await uploadFiles({
				category: UploadCategory.ACCOUNTS_STOCK_INVOICE,
				files: files.files as fileUpload.UploadedFile | fileUpload.UploadedFile[],
				entityId: `preapproval-${id}`,
				allowedTypes: ALLOWED_MIME,
				maxSizeMB: 15,
				multiple: true,
			});

			const fileList = Array.isArray(uploaded) ? uploaded : [uploaded];
			const attachments = [
				...(existing.attachments || []),
				...fileList.map((f: any) => ({
					url: f.url,
					name: f.original_name || f.stored_name || "attachment",
					mime: f.mime_type || "",
					size: f.size_bytes || 0,
					uploaded_at: f.uploaded_at || new Date(),
				})),
			];

			const updated = await accountsPreApprovalGridRepository.updateById(id, {
				$set: { attachments, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Attachments uploaded.", updated);
		} catch (err: any) {
			console.error("[accountsPreApprovalGrid.upload]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async deleteAttachment(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const { fileUrl } = req.body || {};
			if (!id || !fileUrl) return ReE(res, BAD_REQUEST_CODE, "id and fileUrl are required");

			const existing: any = await accountsPreApprovalGridRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Record not found");

			const docs = existing.attachments || [];
			const target = docs.find((d: any) => d.url === fileUrl);
			if (!target) return ReE(res, FORBIDDEN_CODE, "Attachment not found");

			try {
				const relative = (getRelativeFilePath(fileUrl) || fileUrl || "").replace(/^\//, "");
				const filePath = path.join(process.cwd(), relative);
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			} catch {
				/* */
			}

			const attachments = docs.filter((d: any) => d.url !== fileUrl);
			const updated = await accountsPreApprovalGridRepository.updateById(id, {
				$set: { attachments, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Attachment deleted.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}
}

export default new AccountsPreApprovalGridController();
