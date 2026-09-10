import { TimeEnum } from "@constants/common.enum";
import { analyticsRepository } from "@repositories";
import { resolveIntervalDateFilter } from "@utils/dateInterval.helper";
import { reverseDailyCounts, sumByField, toNumber } from "@utils/number.helper";

/**
 * Assemble workbench / analysis metrics payload.
 * Response shape is unchanged from the previous controller implementation.
 */
export async function getWorkbenchMetricsPayload() {
	const [
		roleCounts,
		userDailyCounts,
		quoteStatusCounts,
		quoteDailyCounts,
		quoteStats,
		invoicePayStatusCounts,
		invoiceDailyCounts,
		invoiceStats,
		expenseStatusCounts,
		expenseCategoryCounts,
		expenseCurrencyTotals,
		expenseDailyCounts,
		expenseStats,
	] = await Promise.all([
		analyticsRepository.usersByRole(),
		analyticsRepository.usersDailyCounts(),
		analyticsRepository.quoteStatusCounts(),
		analyticsRepository.quoteDailyCounts(),
		analyticsRepository.quoteStats(),
		analyticsRepository.invoicePayStatusCounts(),
		analyticsRepository.invoiceDailyCounts(),
		analyticsRepository.invoiceStats(),
		analyticsRepository.expenseStatusCounts(),
		analyticsRepository.expenseCategoryCounts(),
		analyticsRepository.expenseCurrencyTotals(),
		analyticsRepository.expenseDailyCounts(),
		analyticsRepository.expenseStats(),
	]);

	const totalUserCount = sumByField(roleCounts as Array<Record<string, unknown>>, "user_count");

	return {
		users: {
			role_counts: roleCounts,
			daily_counts: reverseDailyCounts(userDailyCounts as Array<Record<string, unknown>>, "user_count"),
			total_count: totalUserCount,
		},
		quotes: {
			status_counts: quoteStatusCounts,
			daily_counts: reverseDailyCounts(quoteDailyCounts as Array<Record<string, unknown>>, "quote_count"),
			total_count: toNumber((quoteStats as any)?.total_quotes),
			total_revenue: toNumber((quoteStats as any)?.total_revenue),
			avg_quote_value: toNumber((quoteStats as any)?.avg_quote_value),
		},
		invoices: {
			status_counts: invoicePayStatusCounts,
			daily_counts: reverseDailyCounts(invoiceDailyCounts as Array<Record<string, unknown>>, "invoice_count"),
			total_count: toNumber((invoiceStats as any)?.total_invoices),
		},
		expenses: {
			status_counts: expenseStatusCounts,
			category_counts: expenseCategoryCounts,
			currency_totals: expenseCurrencyTotals,
			daily_counts: reverseDailyCounts(expenseDailyCounts as Array<Record<string, unknown>>, "expense_count"),
			total_count: toNumber((expenseStats as any)?.total_expenses),
		},
	};
}

export async function getInvoiceRevenueByInterval(interval?: string | TimeEnum) {
	const dateFilter = resolveIntervalDateFilter("invoice.updated_at", interval);
	return analyticsRepository.revenueByPayStatus(dateFilter);
}

export async function getCustomInvoiceRevenueByInterval(interval?: string | TimeEnum) {
	const dateFilter = resolveIntervalDateFilter("updated_at", interval);
	return analyticsRepository.customInvoiceRevenueByPayStatus(dateFilter);
}
