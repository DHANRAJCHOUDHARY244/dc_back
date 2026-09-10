export type PaginationParams = {
	page: number;
	limit: number;
	skip: number;
};

export type SortOrder = 1 | -1;

/**
 * Parse page/limit from query or body. Defaults match existing controllers.
 */
export function parsePaginationParams(
	input: { page?: unknown; limit?: unknown } | null | undefined,
	defaults: { page?: number; limit?: number } = {},
): PaginationParams {
	const defaultPage = defaults.page ?? 1;
	const defaultLimit = defaults.limit ?? 10;
	const page = Math.max(1, Number.parseInt(String(input?.page ?? defaultPage), 10) || defaultPage);
	const limit = Math.max(1, Number.parseInt(String(input?.limit ?? defaultLimit), 10) || defaultLimit);
	return { page, limit, skip: (page - 1) * limit };
}

/** Mongo sort object from sortBy + ASC/DESC (or 1/-1). */
export function parseMongoSort(
	sortBy: unknown = "created_at",
	sortOrder: unknown = "DESC",
): Record<string, SortOrder> {
	const field = String(sortBy || "created_at");
	const raw = String(sortOrder ?? "DESC").toUpperCase();
	const dir: SortOrder = raw === "ASC" || raw === "1" ? 1 : -1;
	return { [field]: dir };
}

/** Standard paginated envelope used by dashboard list endpoints. */
export function paginationMeta(page: number, limit: number, count: number) {
	return {
		currentPage: page,
		totalPages: limit > 0 ? Math.ceil(count / limit) : 0,
		limit,
		count,
	};
}
