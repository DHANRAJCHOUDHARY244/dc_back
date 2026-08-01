import { Request, Response } from "express";
import {
  expenseRepository,
  salaryRepository,
  invoiceRepository,
  customInvoiceRepository,
  quoteRepository,
  stockOrderRepository,
  paymentHistoryRepository,
  companyBudgetYearRepository,
  companyBudgetMonthRepository,
} from "@repositories";
import { ReS, ReE } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE } from "@constants/serverCode";
import type { AuthenticatedRequest } from "../constants/common.interface";

type CurrencyLedger = {
  revenue: number;
  expense: number;
  salary: number;
  net: number;
};

type CurrencyMap = Record<string, CurrencyLedger>;

type InvoiceCategoryBucket = {
  total: number;
  count: number;
  byStatus: Record<string, number>;
  monthly: Array<{ year: number; month: number; label: string; total: number; count: number }>;
  yearly: Array<{ year: number; total: number; count: number }>;
};

function emptyInvoiceBucket(): InvoiceCategoryBucket {
  return { total: 0, count: 0, byStatus: {}, monthly: [], yearly: [] };
}

function foldStatusRows(
  rows: Array<{ pay_status?: string; total?: number; count?: number }>,
  target: InvoiceCategoryBucket,
) {
  rows.forEach((r) => {
    const amt = Number(r.total) || 0;
    const count = Number(r.count) || 0;
    const key = String(r.pay_status || "PENDING");
    target.byStatus[key] = (target.byStatus[key] || 0) + amt;
    target.total += amt;
    target.count += count;
  });
}

function foldPeriodRows(
  rows: Array<{ year?: number; month?: number; total?: number; count?: number }>,
  kind: "monthly" | "yearly",
  target: InvoiceCategoryBucket,
) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (kind === "monthly") {
    target.monthly = rows
      .map((r) => {
        const year = Number(r.year) || 0;
        const month = Number(r.month) || 0;
        return {
          year,
          month,
          label: `${monthNames[Math.max(0, month - 1)] || "?"} ${year}`,
          total: Number(r.total) || 0,
          count: Number(r.count) || 0,
        };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);
  } else {
    target.yearly = rows
      .map((r) => ({
        year: Number(r.year) || 0,
        total: Number(r.total) || 0,
        count: Number(r.count) || 0,
      }))
      .sort((a, b) => a.year - b.year);
  }
}

async function getRevenueByStatus(start: Date, end: Date) {
  const invoice = emptyInvoiceBucket();
  const customInvoice = emptyInvoiceBucket();

  const invoiceMatch = [
    { $match: { created_at: { $gte: start, $lte: end }, deleted_at: null } },
    {
      $lookup: {
        from: "quotes",
        localField: "quote_id",
        foreignField: "id",
        as: "quote",
      },
    },
    { $unwind: "$quote" },
    { $match: { "quote.deleted_at": null } },
  ];

  const customMatch = [{ $match: { created_at: { $gte: start, $lte: end }, deleted_at: null } }];

  const [
    invoiceStatusRows,
    customStatusRows,
    invoiceMonthlyRows,
    customMonthlyRows,
    invoiceYearlyRows,
    customYearlyRows,
  ] = await Promise.all([
    invoiceRepository.aggregateRaw([
      ...invoiceMatch,
      {
        $group: {
          _id: "$pay_status",
          total: { $sum: "$quote.total" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, pay_status: "$_id", total: 1, count: 1 } },
    ]),
    customInvoiceRepository.aggregateRaw([
      ...customMatch,
      {
        $group: {
          _id: "$pay_status",
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, pay_status: "$_id", total: 1, count: 1 } },
    ]),
    invoiceRepository.aggregateRaw([
      ...invoiceMatch,
      {
        $group: {
          _id: { year: { $year: "$created_at" }, month: { $month: "$created_at" } },
          total: { $sum: "$quote.total" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, year: "$_id.year", month: "$_id.month", total: 1, count: 1 } },
    ]),
    customInvoiceRepository.aggregateRaw([
      ...customMatch,
      {
        $group: {
          _id: { year: { $year: "$created_at" }, month: { $month: "$created_at" } },
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, year: "$_id.year", month: "$_id.month", total: 1, count: 1 } },
    ]),
    invoiceRepository.aggregateRaw([
      ...invoiceMatch,
      {
        $group: {
          _id: { year: { $year: "$created_at" } },
          total: { $sum: "$quote.total" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, year: "$_id.year", total: 1, count: 1 } },
    ]),
    customInvoiceRepository.aggregateRaw([
      ...customMatch,
      {
        $group: {
          _id: { year: { $year: "$created_at" } },
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, year: "$_id.year", total: 1, count: 1 } },
    ]),
  ]);

  foldStatusRows(invoiceStatusRows as any[], invoice);
  foldStatusRows(customStatusRows as any[], customInvoice);
  foldPeriodRows(invoiceMonthlyRows as any[], "monthly", invoice);
  foldPeriodRows(customMonthlyRows as any[], "monthly", customInvoice);
  foldPeriodRows(invoiceYearlyRows as any[], "yearly", invoice);
  foldPeriodRows(customYearlyRows as any[], "yearly", customInvoice);

  const revenueStatus: Record<string, number> = {};
  let totalRevenue = 0;
  [invoice, customInvoice].forEach((bucket) => {
    Object.entries(bucket.byStatus).forEach(([status, amt]) => {
      revenueStatus[status] = (revenueStatus[status] || 0) + amt;
    });
    totalRevenue += bucket.total;
  });

  return {
    revenueStatus,
    totalRevenue,
    invoice,
    customInvoice,
  };
}

type ExpenseCurrencyBreakdown = {
  category: Record<string, number>;
  paymentMode: Record<string, number>;
};

type LedgerCurrency = "AUD" | "INR" | "USD";

const LEDGER_CURRENCIES: LedgerCurrency[] = ["AUD", "INR", "USD"];

function emptyBreakdown(): ExpenseCurrencyBreakdown {
  return { category: {}, paymentMode: {} };
}

function emptyExpenseBreakdown(): Record<LedgerCurrency, ExpenseCurrencyBreakdown> {
  return {
    AUD: emptyBreakdown(),
    INR: emptyBreakdown(),
    USD: emptyBreakdown(),
  };
}

async function getExpenseGraphs(start: Date, end: Date) {
  const rows = await expenseRepository.aggregate([
    { $match: { expense_date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { currency: "$currency", category: "$category", payment_mode: "$payment_mode" },
        total: { $sum: "$amount" },
      },
    },
    {
      $project: {
        _id: 0,
        currency: "$_id.currency",
        category: "$_id.category",
        payment_mode: "$_id.payment_mode",
        total: 1,
      },
    },
  ]);

  const expenseByCurrency: Record<string, number> = {};
  const expenseBreakdown = emptyExpenseBreakdown();

  rows.forEach((r: any) => {
    const amt = Number(r.total) || 0;
    const currency = (r.currency as LedgerCurrency) || "INR";
    const bucket = LEDGER_CURRENCIES.includes(currency) ? currency : "INR";

    expenseByCurrency[currency] = (expenseByCurrency[currency] || 0) + amt;

    expenseBreakdown[bucket].category[r.category] =
      (expenseBreakdown[bucket].category[r.category] || 0) + amt;

    expenseBreakdown[bucket].paymentMode[r.payment_mode] =
      (expenseBreakdown[bucket].paymentMode[r.payment_mode] || 0) + amt;
  });

  return { expenseByCurrency, expenseBreakdown };
}

async function getSalaryGraph(start: Date, end: Date) {
  const [salaryAgg] = await salaryRepository.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        basic: { $sum: "$basic" },
        bonus: { $sum: "$bonus" },
        tds: { $sum: "$tds" },
        pf: { $sum: "$pf" },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const salaryComposition = {
    basic: Number(salaryAgg?.basic) || 0,
    bonus: Number(salaryAgg?.bonus) || 0,
    tds: Number(salaryAgg?.tds) || 0,
    pf: Number(salaryAgg?.pf) || 0,
  };

  const salaryTotal =
    salaryComposition.basic +
    salaryComposition.bonus -
    salaryComposition.tds -
    salaryComposition.pf;

  return { salaryComposition, salaryTotal };
}

function buildCurrencyLedger(
  revenueTotal: number,
  expenseByCurrency: Record<string, number>,
  salaryTotal: number,
): CurrencyMap {
  const ledger: CurrencyMap = {};

  ledger.AUD = {
    revenue: revenueTotal,
    expense: expenseByCurrency.AUD || 0,
    salary: 0,
    net: revenueTotal - (expenseByCurrency.AUD || 0),
  };

  ledger.INR = {
    revenue: 0,
    expense: expenseByCurrency.INR || 0,
    salary: salaryTotal,
    net: 0 - (expenseByCurrency.INR || 0) - salaryTotal,
  };

  ledger.USD = {
    revenue: 0,
    expense: expenseByCurrency.USD || 0,
    salary: 0,
    net: 0 - (expenseByCurrency.USD || 0),
  };

  return ledger;
}

/** Stock orders in range joined to their quote totals, grouped by status. */
async function getStockAccounts(start: Date, end: Date) {
  const rows = await stockOrderRepository.aggregateRaw([
    { $match: { created_at: { $gte: start, $lte: end }, deleted_at: null } },
    {
      $lookup: {
        from: "quotes",
        localField: "quote_id",
        foreignField: "id",
        as: "quote",
      },
    },
    { $unwind: { path: "$quote", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$stock_order_status",
        total: { $sum: { $ifNull: ["$quote.total", 0] } },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, status: "$_id", total: 1, count: 1 } },
  ]);

  const byStatus: Record<string, { total: number; count: number }> = {};
  rows.forEach((r: any) => {
    byStatus[r.status] = { total: Number(r.total) || 0, count: Number(r.count) || 0 };
  });

  const sumStatuses = (statuses: string[]) =>
    statuses.reduce(
      (acc, s) => ({
        total: acc.total + (byStatus[s]?.total || 0),
        count: acc.count + (byStatus[s]?.count || 0),
      }),
      { total: 0, count: 0 },
    );

  return {
    byStatus,
    stockInvoices: sumStatuses(["ORDERED", "CONFIRMED", "DRIVER_ASSIGNED", "DELIVERED"]),
    stockDelivered: sumStatuses(["DELIVERED"]),
  };
}

/** Installer payments + sales person commissions from payment history. */
async function getPaymentAccounts(start: Date, end: Date) {
  const [agg] = await paymentHistoryRepository.aggregateRaw([
    { $match: { created_at: { $gte: start, $lte: end }, deleted_at: null } },
    {
      $group: {
        _id: null,
        installer_total: { $sum: { $ifNull: ["$installer_total_amount", 0] } },
        installer_paid: {
          $sum: {
            $cond: [
              { $eq: ["$installer_payment_status", "PAID"] },
              { $ifNull: ["$installer_total_amount", 0] },
              { $ifNull: ["$installer_partial_paid_amount", 0] },
            ],
          },
        },
        sales_total: { $sum: { $ifNull: ["$sales_person_total_amount", 0] } },
        sales_paid: {
          $sum: {
            $cond: [
              { $eq: ["$sales_person_payment_status", "PAID"] },
              { $ifNull: ["$sales_person_total_amount", 0] },
              { $ifNull: ["$sales_person_partial_paid_amount", 0] },
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const installerTotal = Number(agg?.installer_total) || 0;
  const installerPaid = Number(agg?.installer_paid) || 0;
  const salesTotal = Number(agg?.sales_total) || 0;
  const salesPaid = Number(agg?.sales_paid) || 0;

  return {
    installerPayments: {
      total: installerTotal,
      paid: installerPaid,
      pending: Math.max(installerTotal - installerPaid, 0),
    },
    salesCommissions: {
      total: salesTotal,
      paid: salesPaid,
      pending: Math.max(salesTotal - salesPaid, 0),
    },
    recordCount: Number(agg?.count) || 0,
  };
}

/** Total rebates (STC / Solar VIC / catalog) across quote items in range. */
async function getRebateAccounts(start: Date, end: Date) {
  const quotes = await quoteRepository.find(
    { created_at: { $gte: start, $lte: end } },
    { select: "items", lean: true },
  );

  let total = 0;
  let stcTotal = 0;
  let solarVicTotal = 0;

  quotes.forEach((q: any) => {
    (Array.isArray(q.items) ? q.items : []).forEach((item: any) => {
      const qty = Number(item?.quantity) || 1;
      const hasNewFields = item?.stcRebate != null || item?.solarVicTotal != null;
      if (hasNewFields) {
        const stc = item?.stcEligible !== false ? Number(item?.stcRebate) || 0 : 0;
        const vic = item?.solarVicEligible !== false ? Number(item?.solarVicTotal) || 0 : 0;
        const catalog =
          item?.catalogRebateEligible !== false ? (Number(item?.rebate) || 0) * qty : 0;
        stcTotal += stc;
        solarVicTotal += vic;
        total += stc + vic + catalog;
      } else {
        total += (Number(item?.rebate) || 0) * qty;
      }
    });
  });

  return { total, stcTotal, solarVicTotal, quoteCount: quotes.length };
}

/** Expense totals grouped by category (all currencies combined). */
async function getExpenseCategoryTotals(start: Date, end: Date) {
  const rows = await expenseRepository.aggregate([
    { $match: { expense_date: { $gte: start, $lte: end } } },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
    { $project: { _id: 0, category: "$_id", total: 1 } },
  ]);

  const byCategory: Record<string, number> = {};
  let total = 0;
  rows.forEach((r: any) => {
    const amt = Number(r.total) || 0;
    byCategory[r.category || "OTHER"] = (byCategory[r.category || "OTHER"] || 0) + amt;
    total += amt;
  });

  return { byCategory, total };
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function emptyMonthlyMap(): Record<number, number> {
  const map: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) map[m] = 0;
  return map;
}

function normalizeYearMonths(raw: unknown): Record<number, number> {
  const map = emptyMonthlyMap();
  if (!raw || typeof raw !== "object") return map;
  for (let m = 1; m <= 12; m++) {
    const val = Number((raw as any)[String(m)] ?? (raw as any)[m] ?? 0);
    map[m] = Number.isFinite(val) && val > 0 ? val : 0;
  }
  return map;
}

function sumMonths(months: Record<number, number>) {
  return Object.values(months).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Load 12 monthly amounts from company_budget_months for a year. */
async function getYearMonthsFromDb(year: number): Promise<Record<number, number>> {
  const rows = await companyBudgetMonthRepository.find(
    { year },
    { select: "month amount", lean: true },
  );
  const map = emptyMonthlyMap();
  rows.forEach((row: any) => {
    const m = Number(row.month);
    if (m >= 1 && m <= 12) map[m] = Number(row.amount) || 0;
  });
  return map;
}

/** Upsert year + 12 month rows; annual_amount = sum of months. */
async function saveYearMonthlyBudgets(
  year: number,
  months: Record<number, number>,
  updatedBy?: number,
) {
  const annual = sumMonths(months);
  const currency = "AUD";

  let yearDoc = await companyBudgetYearRepository.findOne({ year });
  if (yearDoc) {
    yearDoc = await companyBudgetYearRepository.updateById((yearDoc as any).id, {
      $set: {
        annual_amount: annual,
        currency,
        ...(updatedBy != null ? { updated_by: updatedBy } : {}),
      },
    });
  } else {
    yearDoc = await companyBudgetYearRepository.create({
      year,
      annual_amount: annual,
      currency,
      ...(updatedBy != null ? { updated_by: updatedBy } : {}),
    });
  }

  for (let month = 1; month <= 12; month++) {
    const amount = months[month] || 0;
    const existing = await companyBudgetMonthRepository.findOne({ year, month });
    if (existing) {
      await companyBudgetMonthRepository.updateById((existing as any).id, {
        $set: {
          amount,
          currency,
          ...(updatedBy != null ? { updated_by: updatedBy } : {}),
        },
      });
    } else {
      await companyBudgetMonthRepository.create({
        year,
        month,
        amount,
        currency,
        ...(updatedBy != null ? { updated_by: updatedBy } : {}),
      });
    }
  }

  return yearDoc;
}

/** Monthly outflow (expenses + net salary + paid installer/sales) for a calendar year. */
async function getMonthlyOutflow(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const spent = emptyMonthlyMap();

  const [expenseRows, salaryRows, paymentRows] = await Promise.all([
    expenseRepository.aggregate([
      { $match: { expense_date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $month: "$expense_date" },
          total: { $sum: "$amount" },
        },
      },
    ]),
    salaryRepository.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $month: "$date" },
          basic: { $sum: "$basic" },
          bonus: { $sum: "$bonus" },
          tds: { $sum: "$tds" },
          pf: { $sum: "$pf" },
        },
      },
    ]),
    paymentHistoryRepository.aggregateRaw([
      { $match: { created_at: { $gte: start, $lte: end }, deleted_at: null } },
      {
        $group: {
          _id: { $month: "$created_at" },
          installer_paid: {
            $sum: {
              $cond: [
                { $eq: ["$installer_payment_status", "PAID"] },
                { $ifNull: ["$installer_total_amount", 0] },
                { $ifNull: ["$installer_partial_paid_amount", 0] },
              ],
            },
          },
          sales_paid: {
            $sum: {
              $cond: [
                { $eq: ["$sales_person_payment_status", "PAID"] },
                { $ifNull: ["$sales_person_total_amount", 0] },
                { $ifNull: ["$sales_person_partial_paid_amount", 0] },
              ],
            },
          },
        },
      },
    ]),
  ]);

  expenseRows.forEach((r: any) => {
    const m = Number(r._id);
    if (m >= 1 && m <= 12) spent[m] += Number(r.total) || 0;
  });

  salaryRows.forEach((r: any) => {
    const m = Number(r._id);
    if (m >= 1 && m <= 12) {
      spent[m] +=
        (Number(r.basic) || 0) + (Number(r.bonus) || 0) - (Number(r.tds) || 0) - (Number(r.pf) || 0);
    }
  });

  paymentRows.forEach((r: any) => {
    const m = Number(r._id);
    if (m >= 1 && m <= 12) {
      spent[m] += (Number(r.installer_paid) || 0) + (Number(r.sales_paid) || 0);
    }
  });

  return spent;
}

async function buildBudgetPayload(year: number, monthlySpent: Record<number, number>) {
  const monthsMap = await getYearMonthsFromDb(year);
  const annual = sumMonths(monthsMap);
  const yearSpent = sumMonths(monthlySpent);
  let monthsFilled = 0;

  const months = MONTH_LABELS.map((label, idx) => {
    const month = idx + 1;
    const budget = monthsMap[month] || 0;
    const spent = monthlySpent[month] || 0;
    const filled = budget > 0;
    if (filled) monthsFilled += 1;
    return {
      month,
      label,
      short: label.slice(0, 3),
      budget,
      spent,
      remaining: budget - spent,
      filled,
      usedPercent: budget > 0 ? Math.min(Math.round((spent / budget) * 100), 999) : spent > 0 ? 100 : 0,
    };
  });

  return {
    year,
    annual,
    total: annual,
    spent: yearSpent,
    remaining: annual - yearSpent,
    monthsFilled,
    monthsRequired: 12,
    months,
  };
}

class FinanceController {
  /** Aggregated company accounts overview (budget, invoices, stock, payments, rebates, expenses, salary). */
  async accounts(req: Request, res: Response) {
    try {
      const { start_date, end_date, budget_year } = req.query;

      const start = start_date
        ? new Date(start_date as string)
        : new Date(new Date().getFullYear(), 0, 1);
      const end = end_date ? new Date(end_date as string) : new Date();

      const budgetYear = Number(budget_year) || end.getFullYear() || new Date().getFullYear();

      const [revenueData, stockData, paymentData, rebateData, expenseData, salaryData, monthlySpent] =
        await Promise.all([
          getRevenueByStatus(start, end),
          getStockAccounts(start, end),
          getPaymentAccounts(start, end),
          getRebateAccounts(start, end),
          getExpenseCategoryTotals(start, end),
          getSalaryGraph(start, end),
          getMonthlyOutflow(budgetYear),
        ]);

      const cat = expenseData.byCategory;
      const budget = await buildBudgetPayload(budgetYear, monthlySpent);

      return ReS(res, SUCCESS_CODE, "Finance accounts data", {
        budget,
        invoices: {
          total: revenueData.totalRevenue,
          byStatus: revenueData.revenueStatus,
          categories: {
            invoice: revenueData.invoice,
            customInvoice: revenueData.customInvoice,
          },
        },
        stockInvoices: stockData.stockInvoices,
        stockDelivered: stockData.stockDelivered,
        stockByStatus: stockData.byStatus,
        installerPayments: paymentData.installerPayments,
        salesCommissions: {
          ...paymentData.salesCommissions,
          expenseCommission: cat.COMISSION || 0,
        },
        rebates: rebateData,
        preApprovalGrid: {
          preApproval: cat.PRE_APPROVAL || 0,
          gridConnection: cat.GRID_CONNECTION || 0,
          total: (cat.PRE_APPROVAL || 0) + (cat.GRID_CONNECTION || 0),
        },
        marketingAds: cat.MARKETING || 0,
        leadCost: cat.LEAD_COST || 0,
        systemMaintenance: cat.MAINTENANCE || 0,
        salary: {
          total: salaryData.salaryTotal,
          composition: salaryData.salaryComposition,
        },
        expenses: {
          total: expenseData.total,
          byCategory: cat,
        },
      });
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Accounts calculation failed");
    }
  }

  /**
   * Save monthly company budgets for a year into dedicated models.
   * Body: { year: 2026, months: { "1": 50000, ... "12": 60000 } }
   * Annual is auto-calculated as the sum of months.
   */
  async updateBudget(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body || {};
      const year = Number(body.year) || new Date().getFullYear();
      if (year < 2000 || year > 2100) {
        return ReE(res, SERVER_ERROR_CODE, "year must be between 2000 and 2100");
      }

      const months = normalizeYearMonths(body.months);
      const updatedBy = req.user?.id;
      await saveYearMonthlyBudgets(year, months, updatedBy);

      const monthlySpent = await getMonthlyOutflow(year);
      return ReS(res, SUCCESS_CODE, "Company monthly budgets saved", {
        budget: await buildBudgetPayload(year, monthlySpent),
      });
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Budget update failed");
    }
  }

  async dashboard(req: Request, res: Response) {
    try {
      const { start_date, end_date } = req.query;

      const start = start_date
        ? new Date(start_date as string)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const end = end_date ? new Date(end_date as string) : new Date();

      const [revenueData, expenseData, salaryData] = await Promise.all([
        getRevenueByStatus(start, end),
        getExpenseGraphs(start, end),
        getSalaryGraph(start, end),
      ]);

      const currencyBuckets = buildCurrencyLedger(
        revenueData.totalRevenue,
        expenseData.expenseByCurrency,
        salaryData.salaryTotal,
      );

      return ReS(res, SUCCESS_CODE, "Finance dashboard data", {
        currencyBuckets,
        revenueStatus: revenueData.revenueStatus,
        expenseBreakdown: expenseData.expenseBreakdown,
        salaryComposition: salaryData.salaryComposition,
      });
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Dashboard calculation failed");
    }
  }
}

export default new FinanceController();
