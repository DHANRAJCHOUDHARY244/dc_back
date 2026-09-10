/** Safe numeric coercion used across dashboards and aggregates. */
export function toNumber(value: unknown, fallback = 0): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

/** Sum a numeric field across an array of objects. */
export function sumByField<T extends Record<string, unknown>>(
	rows: T[] | null | undefined,
	field: keyof T,
): number {
	if (!rows?.length) return 0;
	return rows.reduce((sum, row) => sum + toNumber(row[field as string]), 0);
}

/**
 * Map aggregate daily rows → chronological count array (oldest → newest).
 * Matches existing dashboard contract: `.map(...).reverse()`.
 */
export function reverseDailyCounts(
	rows: Array<Record<string, unknown>> | null | undefined,
	countField: string,
): number[] {
	if (!rows?.length) return [];
	return rows.map((r) => toNumber(r[countField])).reverse();
}
