import { customInvoiceRepository } from "./customInvoice.repository";
import { expenseRepository } from "./expense.repository";
import { invoiceRepository } from "./invoice.repository";
import { quoteRepository } from "./quote.repository";
import { userRepository } from "./user.repository";

/** Dashboard & analytics queries using MongoDB aggregation pipelines */
export class AnalyticsRepository {
  async usersByRole() {
    return userRepository.aggregateRaw([
      { $match: { deleted_at: null } },
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
    return userRepository.aggregateRaw([
      { $match: { deleted_at: null } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
          },
          user_count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
      { $project: { _id: 0, created_date: "$_id", user_count: 1 } },
    ]);
  }

  async quoteStatusCounts() {
    return quoteRepository.aggregateRaw([
      { $match: { deleted_at: null } },
      { $group: { _id: "$customer_accepted", count: { $sum: 1 } } },
      { $project: { _id: 0, customer_accepted: "$_id", count: 1 } },
    ]);
  }

  async quoteDailyCounts(limit = 50) {
    return quoteRepository.aggregateRaw([
      { $match: { deleted_at: null } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          quote_count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
      { $project: { _id: 0, created_date: "$_id", quote_count: 1 } },
    ]);
  }

  async quoteStats() {
    const [row] = await quoteRepository.aggregateRaw([
      { $match: { deleted_at: null } },
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
    return invoiceRepository.aggregateRaw([
      { $match: { deleted_at: null } },
      { $group: { _id: "$pay_status", count: { $sum: 1 } } },
      { $project: { _id: 0, pay_status: "$_id", count: 1 } },
    ]);
  }

  async invoiceDailyCounts(limit = 50) {
    return invoiceRepository.aggregateRaw([
      { $match: { deleted_at: null } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          invoice_count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
      { $project: { _id: 0, created_date: "$_id", invoice_count: 1 } },
    ]);
  }

  async invoiceStats() {
    const [row] = await invoiceRepository.aggregateRaw([
      { $match: { deleted_at: null } },
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
    return expenseRepository.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]);
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
    return expenseRepository.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          expense_count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
      { $project: { _id: 0, created_date: "$_id", expense_count: 1 } },
    ]);
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
      { $match: { deleted_at: null, customer_accepted: "ACCEPTED" } },
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
      {
        $group: {
          _id: "$invoice.pay_status",
          total_amount: { $sum: "$total" },
          total_partial_amount: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$invoice.partialAmount", 0] }, { $ne: ["$invoice.partialAmount", null] }] },
                "$invoice.partialAmount",
                0,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      {
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
      },
    ]);
  }

  async customInvoiceRevenueByPayStatus(dateFilter: Record<string, unknown> = {}) {
    return customInvoiceRepository.aggregateRaw([
      { $match: { deleted_at: null, ...dateFilter } },
      {
        $group: {
          _id: "$pay_status",
          total_amount: { $sum: "$total" },
          total_partial_amount: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$partialAmount", 0] }, { $ne: ["$partialAmount", null] }] },
                "$partialAmount",
                0,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      {
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
      },
    ]);
  }

  buildDateFilter(field: string, interval: string): Record<string, unknown> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const match: Record<string, unknown> = {};

    switch (interval) {
      case "TODAY":
        match[field] = { $gte: startOfDay };
        break;
      case "YESTERDAY": {
        const y = new Date(startOfDay);
        y.setDate(y.getDate() - 1);
        match[field] = { $gte: y, $lt: startOfDay };
        break;
      }
      case "LAST_7_DAYS": {
        const d = new Date(startOfDay);
        d.setDate(d.getDate() - 7);
        match[field] = { $gte: d };
        break;
      }
      case "LAST_30_DAYS": {
        const d = new Date(startOfDay);
        d.setDate(d.getDate() - 30);
        match[field] = { $gte: d };
        break;
      }
      case "THIS_MONTH":
        match[field] = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        };
        break;
      case "LAST_MONTH":
        match[field] = {
          $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          $lt: new Date(now.getFullYear(), now.getMonth(), 1),
        };
        break;
      case "THIS_YEAR":
        match[field] = { $gte: new Date(now.getFullYear(), 0, 1) };
        break;
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
}

export default new AnalyticsRepository();
