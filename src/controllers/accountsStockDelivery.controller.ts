import { AuthenticatedRequest } from "@constants/common.interface";
import { UploadCategory } from "@constants/common.enum";
import { BAD_REQUEST_CODE, FORBIDDEN_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { accountsStockDeliveryRepository } from "@repositories";
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

function sanitizeBody(body: Record<string, unknown>) {
	const allowed = [
		"delivery_number",
		"delivery_date",
		"amount",
		"currency",
		"status",
		"paid_date",
		"notes",
		"delivery_company",
		"deliverer_name",
		"delivery_email",
		"delivery_phone",
		"delivery_address",
		"delivery_abn",
		"vehicle_name",
		"vehicle_number",
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
	if (out.delivery_date) out.delivery_date = new Date(String(out.delivery_date));
	if (out.paid_date) out.paid_date = new Date(String(out.paid_date));
	else if (out.paid_date === null || out.paid_date === "") out.paid_date = null;
	if (out.status && !["PAID", "UNPAID"].includes(String(out.status))) {
		out.status = "UNPAID";
	}
	if (out.status === "PAID" && !out.paid_date) out.paid_date = new Date();
	if (out.status === "UNPAID") out.paid_date = null;
	return out;
}

class AccountsStockDeliveryController {
	async list(req: AuthenticatedRequest, res: Response) {
		try {
			const page = Math.max(1, Number(req.query.page) || 1);
			const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
			const status = req.query.status ? String(req.query.status) : undefined;
			const search = req.query.search ? String(req.query.search).trim() : "";
			const start = req.query.start_date ? new Date(String(req.query.start_date)) : undefined;
			const end = req.query.end_date ? new Date(String(req.query.end_date)) : undefined;

			const filter: Record<string, unknown> = {};
			if (status === "PAID" || status === "UNPAID") filter.status = status;
			if (start || end) {
				filter.delivery_date = {
					...(start ? { $gte: start } : {}),
					...(end ? { $lte: end } : {}),
				};
			}
			if (search) {
				filter.$or = [
					{ delivery_number: { $regex: search, $options: "i" } },
					{ delivery_company: { $regex: search, $options: "i" } },
					{ deliverer_name: { $regex: search, $options: "i" } },
					{ delivery_email: { $regex: search, $options: "i" } },
					{ customer_name: { $regex: search, $options: "i" } },
					{ customer_email: { $regex: search, $options: "i" } },
				];
			}

			const { rows, count } = await accountsStockDeliveryRepository.findPaginated(filter, {
				page,
				limit,
				sort: { delivery_date: -1, id: -1 },
				lean: true,
			});

			const summaryRows = await accountsStockDeliveryRepository.aggregateRaw([
				{
					$match: {
						deleted_at: null,
						...(filter.status ? { status: filter.status } : {}),
						...(filter.delivery_date ? { delivery_date: filter.delivery_date } : {}),
					},
				},
				{
					$group: {
						_id: "$status",
						total: { $sum: "$amount" },
						count: { $sum: 1 },
					},
				},
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

			return ReS(res, SUCCESS_CODE, "Accounts stock deliveries fetched.", {
				currentPage: page,
				totalPages: Math.ceil(count / limit) || 1,
				total: count,
				summary,
				data: rows,
			});
		} catch (err: any) {
			console.error("[accountsStockDelivery.list]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async getById(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const doc = await accountsStockDeliveryRepository.findById(id, { lean: true });
			if (!doc) return ReE(res, BAD_REQUEST_CODE, "Stock delivery not found");
			return ReS(res, SUCCESS_CODE, "Stock delivery fetched.", doc);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async create(req: AuthenticatedRequest, res: Response) {
		try {
			const data = sanitizeBody(req.body || {});
			if (!data.delivery_number || !data.delivery_company || !data.delivery_date) {
				return ReE(res, BAD_REQUEST_CODE, "delivery_number, delivery_company and delivery_date are required");
			}
			const created = await accountsStockDeliveryRepository.create({
				...data,
				attachments: [],
				created_by: req.user?.id,
				updated_by: req.user?.id,
			});
			return ReS(res, SUCCESS_CODE, "Stock delivery created.", created);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async update(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing = await accountsStockDeliveryRepository.findById(id);
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Stock delivery not found");

			const data = sanitizeBody(req.body || {});
			const updated = await accountsStockDeliveryRepository.updateById(id, {
				$set: { ...data, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Stock delivery updated.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async remove(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await accountsStockDeliveryRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Stock delivery not found");

			for (const att of existing.attachments || []) {
				try {
					const relative = (getRelativeFilePath(att.url) || att.url || "").replace(/^\//, "");
					const filePath = path.join(process.cwd(), relative);
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch {
					/* ignore file cleanup errors */
				}
			}

			await accountsStockDeliveryRepository.deleteById(id);
			return ReS(res, SUCCESS_CODE, "Stock delivery deleted.");
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async uploadAttachments(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await accountsStockDeliveryRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Stock delivery not found");

			const files = req.files as fileUpload.FileArray | undefined;
			if (!files?.files) return ReE(res, BAD_REQUEST_CODE, "No files uploaded");

			const uploaded = await uploadFiles({
				category: UploadCategory.ACCOUNTS_STOCK_INVOICE,
				files: files.files as fileUpload.UploadedFile | fileUpload.UploadedFile[],
				entityId: `delivery-${id}`,
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

			const updated = await accountsStockDeliveryRepository.updateById(id, {
				$set: { attachments, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Attachments uploaded.", updated);
		} catch (err: any) {
			console.error("[accountsStockDelivery.upload]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async deleteAttachment(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const { fileUrl } = req.body || {};
			if (!id || !fileUrl) return ReE(res, BAD_REQUEST_CODE, "id and fileUrl are required");

			const existing: any = await accountsStockDeliveryRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Stock delivery not found");

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
			const updated = await accountsStockDeliveryRepository.updateById(id, {
				$set: { attachments, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Attachment deleted.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}
}

export default new AccountsStockDeliveryController();
