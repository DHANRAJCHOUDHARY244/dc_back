import { customInvoiceRepository } from "./customInvoice.repository";
import { expenseRepository } from "./expense.repository";
import { invoiceRepository } from "./invoice.repository";
import { quoteRepository } from "./quote.repository";
import { userRepository } from "./user.repository";
import { buildDateIntervalFilter } from "@utils/dateInterval.helper";
import {
	dailyCountPipeline,
	notDeletedMatch,
	revenueByPayStatusProject,
	revenueGroupByPayStatus,
	statusCountPipeline,
} from "@utils/mongoAnalytics.helper";

/** Dashboard & analytics queries using MongoDB aggregation pipelines */
export class AnalyticsRepository {
	async usersByRole() {
		return userRepository.aggregateRaw([
			notDeletedMatch(),
			{
				$lookup: {
					from: "roles",
					localField: "role_id",
					foreignField: "id",
					as: "role",
				},
			},
			{ $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
			{
				$group: {
					_id: { role_id: "$role_id", name: "$role.name" },
					user_count: { $sum: 1 },
				},
			},
			{
				$project: {
					_id: 0,
					role_id: "$_id.role_id",
					name: "$_id.name",
					user_count: 1,
				},
			},
		]);
	}

	async usersDailyCounts(limit = 50) {
		return userRepository.aggregateRaw(dailyCountPipeline({ countField: "user_count", limit }));
	}

	async quoteStatusCounts() {
		return quoteRepository.aggregateRaw(
			statusCountPipeline({ statusField: "customer_accepted", outputField: "customer_accepted" }),
		);
	}

	async quoteDailyCounts(limit = 50) {
		return quoteRepository.aggregateRaw(dailyCountPipeline({ countField: "quote_count", limit }));
	}

	async quoteStats() {
		const [row] = await quoteRepository.aggregateRaw([
			notDeletedMatch(),
			{
				$group: {
					_id: null,
					total_quotes: { $sum: 1 },
					total_revenue: { $sum: "$total" },
					avg_quote_value: { $avg: "$total" },
				},
			},
			{ $project: { _id: 0 } },
		]);
		return row || { total_quotes: 0, total_revenue: 0, avg_quote_value: 0 };
	}

	async invoicePayStatusCounts() {
		return invoiceRepository.aggregateRaw(
			statusCountPipeline({ statusField: "pay_status", outputField: "pay_status" }),
		);
	}

	async invoiceDailyCounts(limit = 50) {
		return invoiceRepository.aggregateRaw(dailyCountPipeline({ countField: "invoice_count", limit }));
	}

	async invoiceStats() {
		const [row] = await invoiceRepository.aggregateRaw([
			notDeletedMatch(),
			{
				$group: {
					_id: null,
					total_invoices: { $sum: 1 },
					total_amount: { $sum: "$partialAmount" },
				},
			},
			{ $project: { _id: 0 } },
		]);
		return row || { total_invoices: 0, total_amount: 0 };
	}

	async expenseStatusCounts() {
		// expenseRepository.aggregate already applies deleted_at via paranoid
		return expenseRepository.aggregate(
			statusCountPipeline({
				statusField: "status",
				outputField: "status",
				includeDeletedFilter: false,
			}),
		);
	}

	async expenseCategoryCounts() {
		return expenseRepository.aggregate([
			{ $group: { _id: "$category", count: { $sum: 1 }, total: { $sum: "$amount" } } },
			{ $project: { _id: 0, category: "$_id", count: 1, total: 1 } },
		]);
	}

	async expenseCurrencyTotals() {
		return expenseRepository.aggregate([
			{ $group: { _id: "$currency", total: { $sum: "$amount" } } },
			{ $project: { _id: 0, currency: "$_id", total: 1 } },
		]);
	}

	async expenseDailyCounts(limit = 50) {
		return expenseRepository.aggregate(
			dailyCountPipeline({
				countField: "expense_count",
				limit,
				includeDeletedFilter: false,
			}),
		);
	}

	async expenseStats() {
		const [row] = await expenseRepository.aggregate([
			{
				$group: {
					_id: null,
					total_expenses: { $sum: 1 },
					total_amount: { $sum: "$amount" },
				},
			},
			{ $project: { _id: 0 } },
		]);
		return row || { total_expenses: 0, total_amount: 0 };
	}

	async revenueByPayStatus(dateFilter: Record<string, unknown> = {}) {
		return quoteRepository.aggregateRaw([
			notDeletedMatch({ customer_accepted: "ACCEPTED" }),
			{
				$lookup: {
					from: "invoices",
					localField: "id",
					foreignField: "quote_id",
					as: "invoice",
				},
			},
			{ $unwind: "$invoice" },
			{ $match: { "invoice.deleted_at": null, ...dateFilter } },
			revenueGroupByPayStatus({
				statusField: "$invoice.pay_status",
				totalField: "$total",
				partialField: "$invoice.partialAmount",
			}),
			revenueByPayStatusProject(),
		]);
	}

	async customInvoiceRevenueByPayStatus(dateFilter: Record<string, unknown> = {}) {
		return customInvoiceRepository.aggregateRaw([
			notDeletedMatch(dateFilter),
			revenueGroupByPayStatus({
				statusField: "pay_status",
				totalField: "total",
				partialField: "partialAmount",
			}),
			revenueByPayStatusProject(),
		]);
	}

	/** @deprecated Prefer buildDateIntervalFilter from @utils/dateInterval.helper */
	buildDateFilter(field: string, interval: string): Record<string, unknown> {
		return buildDateIntervalFilter(field, interval);
	}
}

export default new AnalyticsRepository();
