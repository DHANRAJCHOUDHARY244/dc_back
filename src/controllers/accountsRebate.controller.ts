import { AuthenticatedRequest } from "@constants/common.interface";
import { UploadCategory } from "@constants/common.enum";
import { BAD_REQUEST_CODE, FORBIDDEN_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { accountsRebateRepository } from "@repositories";
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

const SCHEMES = ["STC", "BSTC", "SOLAR_VICTORIA", "INTEREST_FREE_LOAN", "INSTANT_REBATE"] as const;
const UNIT_SCHEMES = new Set(["STC", "BSTC", "SOLAR_VICTORIA"]);
const PROGRAM_SCHEMES = new Set(["INTEREST_FREE_LOAN", "INSTANT_REBATE"]);
const CATEGORIES = [
	"",
	"SOLAR",
	"BATTERY",
	"AIRCON",
	"HEATPUMP",
	"VIC_HEATPUMP",
	"SOLAR_BATTERY_AIRCON",
	"VEECS",
] as const;

type RebateItemIn = {
	scheme?: string;
	category?: string;
	quantity?: number | string;
	unit_price?: number | string;
	amount?: number | string;
	notes?: string;
};

function normalizeItem(raw: RebateItemIn) {
	const scheme = String(raw.scheme || "");
	if (!SCHEMES.includes(scheme as (typeof SCHEMES)[number])) return null;

	let category = String(raw.category || "");
	if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) category = "";

	let quantity = Number(raw.quantity) || 0;
	let unit_price = Number(raw.unit_price) || 0;
	let amount = Number(raw.amount) || 0;

	if (UNIT_SCHEMES.has(scheme)) {
		amount = Math.round(quantity * unit_price * 100) / 100;
		category = "";
	} else if (PROGRAM_SCHEMES.has(scheme)) {
		quantity = 0;
		unit_price = 0;
	}

	return {
		scheme,
		category,
		quantity,
		unit_price,
		amount,
		notes: String(raw.notes || ""),
	};
}

/** Normalize legacy single-line docs into items[] when missing. */
function ensureItems(doc: any): any[] {
	if (Array.isArray(doc?.items) && doc.items.length > 0) return doc.items;
	if (doc?.scheme && SCHEMES.includes(doc.scheme)) {
		return [
			{
				scheme: doc.scheme,
				category: doc.category || "",
				quantity: Number(doc.quantity) || 0,
				unit_price: Number(doc.unit_price) || 0,
				amount: Number(doc.amount) || 0,
				notes: "",
			},
		];
	}
	return [];
}

function sanitizeBody(body: Record<string, unknown>) {
	const allowed = [
		"reference_number",
		"rebate_date",
		"amount",
		"currency",
		"status",
		"paid_date",
		"notes",
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

	let items: ReturnType<typeof normalizeItem>[] = [];
	if (Array.isArray(body.items)) {
		items = (body.items as RebateItemIn[]).map(normalizeItem).filter(Boolean) as NonNullable<
			ReturnType<typeof normalizeItem>
		>[];
	} else if (body.scheme) {
		// Backward-compatible single-line payload
		const one = normalizeItem({
			scheme: String(body.scheme),
			category: body.category != null ? String(body.category) : "",
			quantity: body.quantity as number,
			unit_price: body.unit_price as number,
			amount: body.amount as number,
		});
		if (one) items = [one];
	}

	out.items = items;
	out.amount = Math.round(items.reduce((s, i) => s + (i?.amount || 0), 0) * 100) / 100;

	// Mirror first line onto legacy fields for older list filters/UI
	const first = items[0];
	out.scheme = first?.scheme || "";
	out.category = first?.category || "";
	out.quantity = first?.quantity || 0;
	out.unit_price = first?.unit_price || 0;

	if (out.rebate_date) out.rebate_date = new Date(String(out.rebate_date));
	if (out.paid_date) out.paid_date = new Date(String(out.paid_date));
	else if (out.paid_date === null || out.paid_date === "") out.paid_date = null;

	if (out.status && !["PAID", "UNPAID"].includes(String(out.status))) {
		out.status = "UNPAID";
	}
	if (out.status === "PAID" && !out.paid_date) out.paid_date = new Date();
	if (out.status === "UNPAID") out.paid_date = null;
	return out;
}

class AccountsRebateController {
	async list(req: AuthenticatedRequest, res: Response) {
		try {
			const page = Math.max(1, Number(req.query.page) || 1);
			const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
			const status = req.query.status ? String(req.query.status) : undefined;
			const scheme = req.query.scheme ? String(req.query.scheme) : undefined;
			const category = req.query.category ? String(req.query.category) : undefined;
			const search = req.query.search ? String(req.query.search).trim() : "";
			const start = req.query.start_date ? new Date(String(req.query.start_date)) : undefined;
			const end = req.query.end_date ? new Date(String(req.query.end_date)) : undefined;

			const filter: Record<string, unknown> = {};
			if (status === "PAID" || status === "UNPAID") filter.status = status;
			if (scheme && SCHEMES.includes(scheme as (typeof SCHEMES)[number])) {
				filter.$or = [{ "items.scheme": scheme }, { scheme }];
			}
			if (category && CATEGORIES.includes(category as (typeof CATEGORIES)[number]) && category) {
				const catFilter = { $or: [{ "items.category": category }, { category }] };
				if (filter.$or) {
					filter.$and = [{ $or: filter.$or as any[] }, catFilter];
					delete filter.$or;
				} else {
					Object.assign(filter, catFilter);
				}
			}
			if (start || end) {
				filter.rebate_date = {
					...(start ? { $gte: start } : {}),
					...(end ? { $lte: end } : {}),
				};
			}
			if (search) {
				const searchOr = [
					{ reference_number: { $regex: search, $options: "i" } },
					{ customer_name: { $regex: search, $options: "i" } },
					{ customer_email: { $regex: search, $options: "i" } },
					{ customer_company: { $regex: search, $options: "i" } },
					{ notes: { $regex: search, $options: "i" } },
				];
				if (filter.$and) {
					(filter.$and as any[]).push({ $or: searchOr });
				} else if (filter.$or) {
					filter.$and = [{ $or: filter.$or as any[] }, { $or: searchOr }];
					delete filter.$or;
				} else {
					filter.$or = searchOr;
				}
			}

			const { rows, count } = await accountsRebateRepository.findPaginated(filter, {
				page,
				limit,
				sort: { rebate_date: -1, id: -1 },
				lean: true,
			});

			const data = (rows as any[]).map((r) => ({
				...r,
				items: ensureItems(r),
			}));

			const matchBase: Record<string, unknown> = {
				deleted_at: null,
				...(filter.status ? { status: filter.status } : {}),
				...(filter.rebate_date ? { rebate_date: filter.rebate_date } : {}),
			};

			const [summaryRows, bySchemeRows, byCategoryRows] = await Promise.all([
				accountsRebateRepository.aggregateRaw([
					{ $match: matchBase },
					{
						$group: {
							_id: "$status",
							total: { $sum: "$amount" },
							count: { $sum: 1 },
						},
					},
				]),
				accountsRebateRepository.aggregateRaw([
					{ $match: matchBase },
					{
						$addFields: {
							_lines: {
								$cond: [
									{ $gt: [{ $size: { $ifNull: ["$items", []] } }, 0] },
									"$items",
									[
										{
											scheme: "$scheme",
											category: "$category",
											quantity: "$quantity",
											unit_price: "$unit_price",
											amount: "$amount",
										},
									],
								],
							},
						},
					},
					{ $unwind: "$_lines" },
					...(scheme
						? [{ $match: { "_lines.scheme": scheme } }]
						: []),
					{
						$group: {
							_id: "$_lines.scheme",
							total: { $sum: "$_lines.amount" },
							count: { $sum: 1 },
							quantity: { $sum: "$_lines.quantity" },
						},
					},
				]),
				accountsRebateRepository.aggregateRaw([
					{ $match: matchBase },
					{
						$addFields: {
							_lines: {
								$cond: [
									{ $gt: [{ $size: { $ifNull: ["$items", []] } }, 0] },
									"$items",
									[
										{
											scheme: "$scheme",
											category: "$category",
											quantity: "$quantity",
											unit_price: "$unit_price",
											amount: "$amount",
										},
									],
								],
							},
						},
					},
					{ $unwind: "$_lines" },
					{ $match: { "_lines.category": { $nin: [null, ""] } } },
					...(category ? [{ $match: { "_lines.category": category } }] : []),
					{
						$group: {
							_id: "$_lines.category",
							total: { $sum: "$_lines.amount" },
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

			const byScheme: Record<string, { total: number; count: number; quantity: number }> = {};
			(bySchemeRows as any[]).forEach((r) => {
				if (!r._id) return;
				byScheme[String(r._id)] = {
					total: Number(r.total) || 0,
					count: Number(r.count) || 0,
					quantity: Number(r.quantity) || 0,
				};
			});

			const byCategory: Record<string, { total: number; count: number }> = {};
			(byCategoryRows as any[]).forEach((r) => {
				byCategory[String(r._id)] = {
					total: Number(r.total) || 0,
					count: Number(r.count) || 0,
				};
			});

			return ReS(res, SUCCESS_CODE, "Accounts rebates fetched.", {
				currentPage: page,
				totalPages: Math.ceil(count / limit) || 1,
				total: count,
				summary,
				byScheme,
				byCategory,
				data,
			});
		} catch (err: any) {
			console.error("[accountsRebate.list]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async getById(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const doc: any = await accountsRebateRepository.findById(id, { lean: true });
			if (!doc) return ReE(res, BAD_REQUEST_CODE, "Rebate not found");
			return ReS(res, SUCCESS_CODE, "Rebate fetched.", { ...doc, items: ensureItems(doc) });
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async create(req: AuthenticatedRequest, res: Response) {
		try {
			const data = sanitizeBody(req.body || {});
			const items = data.items as unknown[];
			if (!data.reference_number || !data.rebate_date) {
				return ReE(res, BAD_REQUEST_CODE, "reference_number and rebate_date are required");
			}
			if (!Array.isArray(items) || items.length === 0) {
				return ReE(res, BAD_REQUEST_CODE, "Add at least one rebate line item");
			}
			const created = await accountsRebateRepository.create({
				...data,
				attachments: [],
				created_by: req.user?.id,
				updated_by: req.user?.id,
			});
			return ReS(res, SUCCESS_CODE, "Rebate created.", created);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async update(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing = await accountsRebateRepository.findById(id);
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Rebate not found");

			const data = sanitizeBody(req.body || {});
			if (Array.isArray(data.items) && (data.items as unknown[]).length === 0) {
				return ReE(res, BAD_REQUEST_CODE, "Add at least one rebate line item");
			}
			const updated = await accountsRebateRepository.updateById(id, {
				$set: { ...data, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Rebate updated.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async remove(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await accountsRebateRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Rebate not found");

			for (const att of existing.attachments || []) {
				try {
					const relative = (getRelativeFilePath(att.url) || att.url || "").replace(/^\//, "");
					const filePath = path.join(process.cwd(), relative);
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch {
					/* ignore */
				}
			}

			await accountsRebateRepository.deleteById(id);
			return ReS(res, SUCCESS_CODE, "Rebate deleted.");
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async uploadAttachments(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			if (!id) return ReE(res, BAD_REQUEST_CODE, "Invalid id");
			const existing: any = await accountsRebateRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Rebate not found");

			const files = req.files as fileUpload.FileArray | undefined;
			if (!files?.files) return ReE(res, BAD_REQUEST_CODE, "No files uploaded");

			const uploaded = await uploadFiles({
				category: UploadCategory.ACCOUNTS_STOCK_INVOICE,
				files: files.files as fileUpload.UploadedFile | fileUpload.UploadedFile[],
				entityId: `rebate-${id}`,
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

			const updated = await accountsRebateRepository.updateById(id, {
				$set: { attachments, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Attachments uploaded.", updated);
		} catch (err: any) {
			console.error("[accountsRebate.upload]", err);
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}

	async deleteAttachment(req: AuthenticatedRequest, res: Response) {
		try {
			const id = Number(req.params.id);
			const { fileUrl } = req.body || {};
			if (!id || !fileUrl) return ReE(res, BAD_REQUEST_CODE, "id and fileUrl are required");

			const existing: any = await accountsRebateRepository.findById(id, { lean: true });
			if (!existing) return ReE(res, BAD_REQUEST_CODE, "Rebate not found");

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
			const updated = await accountsRebateRepository.updateById(id, {
				$set: { attachments, updated_by: req.user?.id },
			});
			return ReS(res, SUCCESS_CODE, "Attachment deleted.", updated);
		} catch (err: any) {
			return ReE(res, SERVER_ERROR_CODE, err.message || err);
		}
	}
}

export default new AccountsRebateController();
