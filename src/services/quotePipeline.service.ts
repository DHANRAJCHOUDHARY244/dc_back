import {
	getPipelineRank,
	normalizePipelineStatus,
	QuotePipelineStatus,
	type QuotePipelineStatus as PipelineStatus,
} from "@constants/quotePipeline.constants";
import { quoteRepository } from "@repositories";

export type AdvancePipelineMeta = {
	reason?: string;
	actorId?: number | null;
	force?: boolean;
	notes?: string | null;
	statusDate?: Date | string | null;
};

/**
 * Forward-only (unless force) pipeline advance for Quote.kanban_status.
 * DECLINED_CANCELLED always applies (terminal cancel path).
 * Optional notes + statusDate are stored even when status is unchanged.
 */
export async function advanceQuotePipeline(
	quoteId: number,
	nextStatus: string,
	meta: AdvancePipelineMeta = {},
): Promise<{ updated: boolean; from: string | null; to: PipelineStatus | null; quote?: any }> {
	const target = normalizePipelineStatus(nextStatus);
	if (!target) {
		return { updated: false, from: null, to: null };
	}

	const quote: any = await quoteRepository.findOne({ id: Number(quoteId) }, { lean: true });
	if (!quote) {
		return { updated: false, from: null, to: target };
	}

	const currentRaw = quote.kanban_status || QuotePipelineStatus.PENDING;
	const current = normalizePipelineStatus(currentRaw) || QuotePipelineStatus.PENDING;

	const isDecline = target === QuotePipelineStatus.DECLINED_CANCELLED;
	if (!meta.force && !isDecline && current !== target) {
		const fromRank = getPipelineRank(current);
		const toRank = getPipelineRank(target);
		if (fromRank >= 0 && toRank >= 0 && toRank <= fromRank) {
			return { updated: false, from: current, to: target, quote };
		}
	}

	const now = new Date();
	const statusChanged = current !== target;
	const notes =
		meta.notes !== undefined && meta.notes !== null ? String(meta.notes).trim() : undefined;
	const statusDate =
		meta.statusDate !== undefined && meta.statusDate !== null && meta.statusDate !== ""
			? new Date(meta.statusDate)
			: undefined;

	const $set: Record<string, unknown> = {
		status_updated_date: now,
	};

	if (statusChanged) {
		$set.kanban_status = target;
	}
	if (notes !== undefined) {
		$set.pipeline_notes = notes;
	}
	if (statusDate !== undefined && !Number.isNaN(statusDate.getTime())) {
		$set.pipeline_status_date = statusDate;
	}

	let history = Array.isArray(quote.pipeline_history) ? [...quote.pipeline_history] : [];
	if (statusChanged || notes !== undefined || statusDate !== undefined) {
		history = [
			...history,
			{
				from: current,
				to: target,
				reason: meta.reason || "pipeline_advance",
				at: now,
				by: meta.actorId ?? null,
				notes: notes ?? quote.pipeline_notes ?? "",
				status_date: statusDate ?? quote.pipeline_status_date ?? null,
			},
		];
		$set.pipeline_history = history;
	}

	if (!statusChanged && notes === undefined && statusDate === undefined) {
		return { updated: false, from: current, to: target, quote };
	}

	await quoteRepository.updateMany({ id: Number(quoteId) }, { $set });

	return {
		updated: true,
		from: current,
		to: target,
		quote: {
			...quote,
			...$set,
			kanban_status: statusChanged ? target : current,
			pipeline_history: history,
		},
	};
}

/** Map install UI values (legacy + new) to pipeline targets. */
export function mapInstallStatusToPipeline(status: string): QuotePipelineStatus | null {
	return normalizePipelineStatus(status);
}
