import type { PipelineStage } from "mongoose";

/**
 * Shared Mongo aggregation stage builders for dashboard analytics.
 * Keep stage shapes identical to previous inline pipelines.
 */

export function notDeletedMatch(extra: Record<string, unknown> = {}): PipelineStage {
	return { $match: { deleted_at: null, ...extra } };
}

/** Daily count series grouped by calendar day (newest first, then limited). */
export function dailyCountPipeline(options: {
	countField: string;
	dateField?: string;
	limit?: number;
	/** When false, caller/repository already applies deleted_at (e.g. paranoid aggregate). */
	includeDeletedFilter?: boolean;
}): PipelineStage[] {
	const {
		countField,
		dateField = "created_at",
		limit = 50,
		includeDeletedFilter = true,
	} = options;

	const stages: PipelineStage[] = [];
	if (includeDeletedFilter) {
		stages.push(notDeletedMatch());
	}

	stages.push(
		{
			$group: {
				_id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` } },
				[countField]: { $sum: 1 },
			},
		} as PipelineStage,
		{ $sort: { _id: -1 } },
		{ $limit: limit },
		{ $project: { _id: 0, created_date: "$_id", [countField]: 1 } } as PipelineStage,
	);

	return stages;
}

/** Group by a status-like field and rename `_id` → outputField. */
export function statusCountPipeline(options: {
	statusField: string;
	outputField: string;
	includeDeletedFilter?: boolean;
	extraMatch?: Record<string, unknown>;
}): PipelineStage[] {
	const { statusField, outputField, includeDeletedFilter = true, extraMatch = {} } = options;
	const stages: PipelineStage[] = [];
	if (includeDeletedFilter) {
		stages.push(notDeletedMatch(extraMatch));
	} else if (Object.keys(extraMatch).length) {
		stages.push({ $match: extraMatch });
	}

	stages.push(
		{ $group: { _id: `$${statusField}`, count: { $sum: 1 } } },
		{ $project: { _id: 0, [outputField]: "$_id", count: 1 } } as PipelineStage,
	);
	return stages;
}

/** $sum expression that only counts non-null / non-zero partial amounts. */
export function partialAmountSum(fieldPath: string) {
	return {
		$sum: {
			$cond: [
				{ $and: [{ $ne: [fieldPath, 0] }, { $ne: [fieldPath, null] }] },
				fieldPath,
				0,
			],
		},
	};
}

/** Shared $project for invoice / custom-invoice revenue-by-status rows. */
export function revenueByPayStatusProject(): PipelineStage {
	return {
		$project: {
			_id: 0,
			pay_status: "$_id",
			total_amount: { $round: ["$total_amount", 2] },
			total_partial_amount: { $round: ["$total_partial_amount", 2] },
			total_remaining_amount: {
				$round: [{ $subtract: ["$total_amount", "$total_partial_amount"] }, 2],
			},
			count: 1,
		},
	};
}

export function revenueGroupByPayStatus(options: {
	statusField: string;
	totalField: string;
	partialField: string;
}): PipelineStage {
	const { statusField, totalField, partialField } = options;
	return {
		$group: {
			_id: statusField.startsWith("$") ? statusField : `$${statusField}`,
			total_amount: { $sum: totalField.startsWith("$") ? totalField : `$${totalField}` },
			total_partial_amount: partialAmountSum(
				partialField.startsWith("$") ? partialField : `$${partialField}`,
			),
			count: { $sum: 1 },
		},
	} as PipelineStage;
}
