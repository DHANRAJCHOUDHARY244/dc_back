import { PaymentStatus } from "@constants/common.enum";

/** Chip keys shown on invoice lists (includes date-based buckets). */
export const INVOICE_PAYMENT_CHIP_KEYS = [
	"ALL",
	"DRAFT",
	"PENDING",
	"PARTIALLY_PAID",
	"PAID",
	"DISCOUNT",
	"DUE_TODAY",
	"OVERDUE",
	"REFUNDED",
	"CLOSED",
] as const;

export type InvoicePaymentChipKey = (typeof INVOICE_PAYMENT_CHIP_KEYS)[number];

const CLOSED_LIKE = [PaymentStatus.CLOSED, PaymentStatus.CANCELLED];
const SETTLED_LIKE = [PaymentStatus.PAID, PaymentStatus.REFUNDED, PaymentStatus.CLOSED, PaymentStatus.CANCELLED];

export function dayBounds(ref = new Date()) {
	const start = new Date(ref);
	start.setHours(0, 0, 0, 0);
	const end = new Date(ref);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

/** Merge chip filter into base Mongo filter (mutates and returns filter). */
export function applyInvoicePaymentChipFilter(
	filter: Record<string, unknown>,
	chip?: string | null,
	opts: { supportDiscountFields?: boolean } = {},
): Record<string, unknown> {
	const key = String(chip || "").toUpperCase().trim();
	if (!key || key === "ALL") return filter;

	const { start, end } = dayBounds();

	if (key === "DUE_TODAY") {
		filter.dateOfDue = { $gte: start, $lte: end };
		filter.pay_status = { $nin: SETTLED_LIKE };
		return filter;
	}

	if (key === "OVERDUE") {
		filter.dateOfDue = { $lt: start };
		filter.pay_status = { $nin: SETTLED_LIKE };
		return filter;
	}

	if (key === "DISCOUNT") {
		const discountClause = opts.supportDiscountFields
			? {
					$or: [
						{ pay_status: PaymentStatus.DISCOUNT },
						{ discountAmount: { $gt: 0 } },
						{ discountRate: { $gt: 0 } },
					],
				}
			: { pay_status: PaymentStatus.DISCOUNT };

		if (filter.$or) {
			const existingOr = filter.$or;
			delete filter.$or;
			const and = Array.isArray(filter.$and) ? [...(filter.$and as unknown[])] : [];
			and.push({ $or: existingOr }, discountClause);
			filter.$and = and;
		} else if (Array.isArray(filter.$and)) {
			(filter.$and as unknown[]).push(discountClause);
		} else {
			Object.assign(filter, discountClause);
		}
		return filter;
	}

	if (key === "CLOSED") {
		filter.pay_status = { $in: CLOSED_LIKE };
		return filter;
	}

	if (key === "PAID") {
		filter.pay_status = PaymentStatus.PAID;
		return filter;
	}

	filter.pay_status = key;
	return filter;
}

export function emptyInvoicePaymentCounts(): Record<string, number> {
	const counts: Record<string, number> = { ALL: 0 };
	for (const k of INVOICE_PAYMENT_CHIP_KEYS) {
		if (k !== "ALL") counts[k] = 0;
	}
	for (const s of Object.values(PaymentStatus)) {
		if (counts[s] == null) counts[s] = 0;
	}
	return counts;
}

/** Compute chip counts from a lean invoice list (already scoped by customer/date filters). */
export function computeInvoicePaymentChipCounts(
	rows: Array<{ pay_status?: string; dateOfDue?: Date | string; discountAmount?: number; discountRate?: number }>,
): Record<string, number> {
	const counts = emptyInvoicePaymentCounts();
	const { start, end } = dayBounds();

	for (const row of rows) {
		counts.ALL += 1;
		const status = String(row.pay_status || PaymentStatus.PENDING).toUpperCase();
		if (counts[status] != null) counts[status] += 1;
		else counts[status] = 1;

		if (CLOSED_LIKE.includes(status as PaymentStatus)) counts.CLOSED += 1;

		const hasDiscount =
			status === PaymentStatus.DISCOUNT ||
			Number(row.discountAmount) > 0 ||
			Number(row.discountRate) > 0;
		if (hasDiscount) counts.DISCOUNT += 1;

		const due = row.dateOfDue ? new Date(row.dateOfDue) : null;
		const unsettled = !SETTLED_LIKE.includes(status as PaymentStatus);
		if (due && !Number.isNaN(due.getTime()) && unsettled) {
			if (due >= start && due <= end) counts.DUE_TODAY += 1;
			if (due < start) counts.OVERDUE += 1;
		}
	}

	return counts;
}

export const UPDATABLE_PAYMENT_STATUSES = [
	PaymentStatus.DRAFT,
	PaymentStatus.PENDING,
	PaymentStatus.PARTIALLY_PAID,
	PaymentStatus.PAID,
	PaymentStatus.DISCOUNT,
	PaymentStatus.EXPIRED,
	PaymentStatus.CANCELLED,
	PaymentStatus.REFUNDED,
	PaymentStatus.CLOSED,
];
