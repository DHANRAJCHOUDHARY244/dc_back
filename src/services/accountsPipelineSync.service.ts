import { QuotePipelineStatus } from "@constants/quotePipeline.constants";
import { quoteRepository } from "@repositories";
import { advanceQuotePipeline } from "@services/quotePipeline.service";

/** Resolve quote id from explicit quote_id or numeric quotation/reference number. */
export async function resolveQuoteIdFromAccounts(opts: {
	quote_id?: number | string | null;
	quotation_number?: string | null;
	reference_number?: string | null;
}): Promise<number | null> {
	if (opts.quote_id != null && opts.quote_id !== "") {
		const n = Number(opts.quote_id);
		if (!isNaN(n) && n > 0) return n;
	}
	for (const raw of [opts.quotation_number, opts.reference_number]) {
		if (!raw) continue;
		const n = Number(String(raw).replace(/[^\d]/g, ""));
		if (!isNaN(n) && n > 0) {
			const q = await quoteRepository.findOne({ id: n }, { select: "id", lean: true });
			if (q) return n;
		}
	}
	return null;
}

/**
 * Pre-approval / grid no longer advance quote kanban_status.
 * Kept as a no-op so accounts controllers stay wired without pipeline side effects.
 */
export async function syncPipelineFromPreApprovalGrid(
	_doc: {
		quote_id?: number | null;
		quotation_number?: string | null;
		service_type?: string | null;
		status?: string | null;
	},
	_actorId?: number | null,
) {
	return;
}

export async function syncPipelineFromRebate(
	doc: {
		quote_id?: number | null;
		reference_number?: string | null;
		status?: string | null;
		claim_status?: string | null;
	},
	actorId?: number | null,
) {
	const quoteId = await resolveQuoteIdFromAccounts({
		quote_id: doc.quote_id,
		reference_number: doc.reference_number,
	});
	if (!quoteId) return;

	const paid = String(doc.status || "").toUpperCase() === "PAID";
	const claim = String(doc.claim_status || "CLAIM_PENDING").toUpperCase();

	let target = QuotePipelineStatus.REBATE_CLAIM_PENDING;
	if (paid || claim === "RECEIVED") target = QuotePipelineStatus.REBATE_RECEIVED;
	else if (claim === "SUBMITTED") target = QuotePipelineStatus.REBATE_SUBMITTED;

	await advanceQuotePipeline(quoteId, target, {
		reason: "accounts_rebate",
		actorId: actorId ?? null,
	});
}
