import { TimeEnum } from "@constants/common.enum";

/**
 * Build a Mongo field range filter for dashboard/analytics time intervals.
 * Same behavior as the previous AnalyticsRepository.buildDateFilter.
 */
export function buildDateIntervalFilter(field: string, interval: string): Record<string, unknown> {
	const now = new Date();
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const match: Record<string, unknown> = {};

	switch (interval) {
		case TimeEnum.TODAY:
		case "TODAY":
			match[field] = { $gte: startOfDay };
			break;
		case TimeEnum.YESTERDAY:
		case "YESTERDAY": {
			const y = new Date(startOfDay);
			y.setDate(y.getDate() - 1);
			match[field] = { $gte: y, $lt: startOfDay };
			break;
		}
		case TimeEnum.LAST_7_DAYS:
		case "LAST_7_DAYS": {
			const d = new Date(startOfDay);
			d.setDate(d.getDate() - 7);
			match[field] = { $gte: d };
			break;
		}
		case TimeEnum.LAST_30_DAYS:
		case "LAST_30_DAYS": {
			const d = new Date(startOfDay);
			d.setDate(d.getDate() - 30);
			match[field] = { $gte: d };
			break;
		}
		case TimeEnum.THIS_MONTH:
		case "THIS_MONTH":
			match[field] = {
				$gte: new Date(now.getFullYear(), now.getMonth(), 1),
			};
			break;
		case TimeEnum.LAST_MONTH:
		case "LAST_MONTH":
			match[field] = {
				$gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
				$lt: new Date(now.getFullYear(), now.getMonth(), 1),
			};
			break;
		case TimeEnum.THIS_YEAR:
		case "THIS_YEAR":
			match[field] = { $gte: new Date(now.getFullYear(), 0, 1) };
			break;
		case TimeEnum.LAST_YEAR:
		case "LAST_YEAR":
			match[field] = {
				$gte: new Date(now.getFullYear() - 1, 0, 1),
				$lt: new Date(now.getFullYear(), 0, 1),
			};
			break;
		default:
			break;
	}

	return match;
}

/** Empty object for ALL_TIME; otherwise interval filter on field. */
export function resolveIntervalDateFilter(
	field: string,
	interval: string | TimeEnum | undefined | null,
): Record<string, unknown> {
	const value = (interval as string) || TimeEnum.ALL_TIME;
	if (value === TimeEnum.ALL_TIME || value === "ALL_TIME") return {};
	return buildDateIntervalFilter(field, value);
}
