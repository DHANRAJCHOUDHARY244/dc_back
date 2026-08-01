import { AuthenticatedRequest } from "@constants/common.interface";
import { UploadCategory } from "@constants/common.enum";
import { BAD_REQUEST_CODE, FORBIDDEN_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { expenseRepository } from "@repositories";
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

/** Marketing entries live in the expenses collection under this category. */
const MARKETING_CATEGORY = "MARKETING";

function sanitizeBody(body: Record<string, unknown>) {
	const allowed = [
		"title",
		"amount",
		"currency",
		"payment_mode",
		"status",
		"expense_date",
		"notes",
		"invoice_number",
		"marketing_channel",
	] as const;

	const out: Record<string, unknown> = {};
	for (const key of allowed) {
		if (body[key] !== undefined) out[key] = body[key];
	}
	// Marketing entries are always MARKETING expenses
	out.category = MARKETING_CATEGORY;
	if (out.amount != null) out.amount = Number(out.amount) || 0;
	if (out.expense_date) out.expense_date = new Date(String(out.expense_date));
	if (!out.currency) out.currency = "AUD";
	if (!out.payment_mode) out.payment_mode = "BANK";
	// UI uses PAID / UNPAID → store PAID / PENDING (expense enum)
	if (out.status === "UNPAID" || out.status === "PENDING") out.status = "PENDING";
	else if (out.status === "PAID") out.status = "PAID";
	else if (out.status && !["PENDING", "APPROVED", "REJECTED", "PAID"].includes(String(out.status))) {
		out.status = "PENDING";
	}
	return out;
}

class AccountsMarketingController {
	async list(req: AuthenticatedRequest, res: Response) {
		try {
			const page = Math.max(1, Number(req.query.page) || 1);
			const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
			const status = req.query.status ? String(req.query.status) : undefined;
			const channel = req.query.channel ? String(req.query.channel) : undefined;
			const search = req.query.search ? String(req.query.search).trim() : "";
			const start = req.query.start_date ? new Date(String(req.query.start_date)) : undefined;
			const end = req.query.end_date ? new Date(String(req.query.end_date)) : undefined;

			const filter: Record<string, unknown> = { category: MARKETING_CATEGORY };
			if (status === "PAID") filter.status = "PAID";
			else if (status === "UNPAID") filter.status = { $ne: "PAID" };
			if (channel) filter.marketing_channel = channel;
			if (start || end) {
				filter.expense_date = {
					...(start ? { $gte: start } : {}),
					...(end ? { $lte: end } : {}),
				};
			}
			if (search) {
				filter.$or = [
					{ title: { $regex: search, $options: "i" } },
					{ invoice_number: { $regex: search, $options: "i" } },
					{ marketing_channel: { $regex: search, $options: "i" } },
					{ notes: { $regex: search, $options: "i" } },
				];
			}

			const { rows, count } = await expenseRepository.findPaginated(filter, {
				page,
				limit,
				sort: { expense_date: -1, id: -1 },
				lean: true,
			});

			const matchBase: Record<string, unknown> = {
				category: MARKETING_CATEGORY,
				...(filter.marketing_channel ? { marketing_channel: filter.marketing_channel } : {}),
				...(filter.expense_date ? { expense_date: filter.expense_date } : {}),
			};

			const [statusRows, channelRows] = await Promise.all([
				expenseRepository.aggregate([
					{ $match: matchBase },
					{
						$group: {
							_id: { $cond: [{ $eq: ["$status", "PAID"] }, "PAID", "UNPAID"] },
							total: { $sum: "$amount" },
							count: { $sum: 1 },
						},
					},
				]),
				expenseRepository.aggregate([
					{ $match: matchBase },
					{
						$group: {
							_id: { $ifNull: ["$marketing_channel", ""] },
							total: { $sum: "$amount" },
							count: { $sum: 1 },
						},
					},
				]),
			]);

			const summary = { paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0, total: 0, count: 0 };
			(statusRows as any[]).forEach((r) => {
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

			const byChannel: Record<string, { total: number; count: number }> = {};
			(channelRows as any[]).forEach((r) => {
				const key = String(r._id || "OTHER");
				byChannel[key] = { total: Number(r.total) || 0, count: Number(r.count) || 0 };
			});

			const data = (rows as any[]).map((r) => ({
				...r,
				ui_status: r.status === "PAID" ? "PAID" : "UNPAID",
			}));

			return ReS(res, SUCCESS_CODE, "Marketing expenses fetched.", {
				currentPage: page,
				totalPages: Math.ceil(count / limit) || 1,
				total: count,
				summary,
				byChannel,
				data,
			});
		} catch (err: any) {
			console.error("[accountsMarketing.list]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async getById(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const doc = await expenseRepository.findById(id, { lean: true });
			if (!doc) return ReE(res, BAD_REQUEST_CODE, "Marketing entry not found");
			return ReS(res, SUCCESS_CODE, "Marketing entry fetched.", doc);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async create(req: AuthenticatedRequest, res: Response) {
		try {
			const data = sanitizeBody(req.body || {});
			if (!data.title || !data.expense_date) {
				return ReE(res, BAD_REQUEST_CODE, "title and expense_date are required");
			}
			const created = await expenseRepository.create({
				...data,
				attachments: [],
				created_by: req.user?.id,
			});
			return ReS(res, SUCCESS_CODE, "Marketing entry created.", created);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async update(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing = await expenseRepository.findById(id);
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Marketing entry not found");

			const data = sanitizeBody(req.body || {});
			const updated = await expenseRepository.updateById(id, { $set: data });
			return ReS(res, SUCCESS_CODE, "Marketing entry updated.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async remove(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await expenseRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Marketing entry not found");

			for (const att of existing.attachments || []) {
				try {
					const relative = (getRelativeFilePath(att.url) || att.url || "").replace(/^\//, "");
					const filePath = path.join(process.cwd(), relative);
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch {
					/* ignore */
				}
			}

			await expenseRepository.deleteById(id);
			return ReS(res, SUCCESS_CODE, "Marketing entry deleted.");
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async uploadAttachments(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await expenseRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Marketing entry not found");

			const files = req.files as fileUpload.FileArray | undefined;
			if (!files?.files) return ReE(res, BAD_REQUEST_CODE, "No files uploaded");

			const uploaded = await uploadFiles({
				category: UploadCategory.ACCOUNTS_STOCK_INVOICE,
				files: files.files as fileUpload.UploadedFile | fileUpload.UploadedFile[],
				entityId: `marketing-${id}`,
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

			const updated = await expenseRepository.updateById(id, { $set: { attachments } });
			return ReS(res, SUCCESS_CODE, "Attachments uploaded.", updated);
		} catch (err: any) {
			console.error("[accountsMarketing.upload]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async deleteAttachment(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const { fileUrl } = req.body || {};
			if (!id || !fileUrl) return ReE(res, BAD_REQUEST_CODE, "id and fileUrl are required");

			const existing: any = await expenseRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Marketing entry not found");

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
			const updated = await expenseRepository.updateById(id, { $set: { attachments } });
			return ReS(res, SUCCESS_CODE, "Attachment deleted.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}
}

export default new AccountsMarketingController();
