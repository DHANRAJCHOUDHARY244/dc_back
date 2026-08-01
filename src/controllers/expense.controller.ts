import { Request, Response } from "express";
import { expenseRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import {
  BAD_REQUEST_CODE,
  SUCCESS_CODE,
  SERVER_ERROR_CODE,
} from "@constants/serverCode";

class ExpenseController {
  async create(req: any, res: Response) {
    try {
      const expense = await expenseRepository.create({
        ...req.body,
        created_by: req.user.id,
      });

      return ReS(res, SUCCESS_CODE, "Expense created", expense);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to create expense");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const expense = await expenseRepository.findById(Number(req.params.id));
      if (!expense) {
        return ReE(res, BAD_REQUEST_CODE, "Expense not found");
      }

      const updated = await expenseRepository.updateById(Number(req.params.id), {
        $set: req.body,
      });
      return ReS(res, SUCCESS_CODE, "Expense updated", updated);
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, "Failed to update expense");
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const expense = await expenseRepository.findById(Number(req.params.id));
      if (!expense) {
        return ReE(res, BAD_REQUEST_CODE, "Expense not found");
      }

      await expenseRepository.deleteById(Number(req.params.id));
      return ReS(res, SUCCESS_CODE, "Expense deleted");
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Failed to delete expense");
    }
  }

  async list(req: any, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        category,
        currency,
        start_date,
        end_date,
      } = req.body;

      const filter: any = {
        created_by: req.user.id,
        ...(status && { status }),
        ...(category && { category }),
        ...(currency && { currency }),
        ...(start_date &&
          end_date && {
            expense_date: {
              $gte: new Date(start_date),
              $lte: new Date(end_date),
            },
          }),
      };

      const { count, rows } = await expenseRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { expense_date: -1 },
        populate: { path: "creator", select: "id name email" },
      });

      return ReS(res, SUCCESS_CODE, "Expenses fetched", {
        data: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
      });
    } catch (err) {
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch expenses");
    }
  }

  async stats(req: any, res: Response) {
    try {
      const { start_date, end_date } = req.query;
      const match: any = {
        created_by: req.user.id,
      };

      if (start_date && end_date) {
        match.expense_date = {
          $gte: new Date(start_date as string),
          $lte: new Date(end_date as string),
        };
      }

      const [
        totalsByCurrency,
        statusBreakdown,
        categoryBreakdown,
        monthlyTrend,
        totalAmountResult,
        totalCount,
        recent,
      ] = await Promise.all([
        expenseRepository.aggregate([
          { $match: match },
          { $group: { _id: "$currency", total: { $sum: "$amount" } } },
          { $project: { _id: 0, currency: "$_id", total: 1 } },
        ]),
        expenseRepository.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              total: { $sum: "$amount" },
            },
          },
          { $project: { _id: 0, status: "$_id", count: 1, total: 1 } },
        ]),
        expenseRepository.aggregate([
          { $match: match },
          { $group: { _id: "$category", total: { $sum: "$amount" } } },
          { $project: { _id: 0, category: "$_id", total: 1 } },
        ]),
        expenseRepository.aggregate([
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$expense_date" } },
              total: { $sum: "$amount" },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, month: "$_id", total: 1 } },
        ]),
        expenseRepository.aggregate([
          { $match: match },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        expenseRepository.count(match),
        expenseRepository.find(match, {
          sort: { expense_date: -1 },
          limit: 5,
          select: "id title amount currency status category expense_date",
          lean: true,
        }),
      ]);

      return ReS(res, SUCCESS_CODE, "Expense stats fetched", {
        totalsByCurrency,
        statusBreakdown,
        categoryBreakdown,
        monthlyTrend,
        totalAmount: totalAmountResult[0]?.total || 0,
        totalCount,
        recent,
      });
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch expense stats");
    }
  }

  async totals(req: any, res: Response) {
    try {
      const totals = await expenseRepository.aggregate([
        { $match: { created_by: req.user.id } },
        { $group: { _id: "$currency", total: { $sum: "$amount" } } },
        { $project: { _id: 0, currency: "$_id", total: 1 } },
      ]);

      return ReS(res, SUCCESS_CODE, "Totals fetched", totals);
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch totals");
    }
  }

  async categoryChart(req: any, res: Response) {
    try {
      const data = await expenseRepository.aggregate([
        { $match: { created_by: req.user.id } },
        { $group: { _id: "$category", value: { $sum: "$amount" } } },
        { $project: { _id: 0, category: "$_id", value: 1 } },
      ]);

      return ReS(res, SUCCESS_CODE, "Category chart data", data);
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch category chart");
    }
  }

  async monthlyTrend(req: any, res: Response) {
    try {
      const data = await expenseRepository.aggregate([
        { $match: { created_by: req.user.id } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$expense_date" } },
            amount: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, month: "$_id", amount: 1 } },
      ]);

      return ReS(res, SUCCESS_CODE, "Monthly trend", data);
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch trend");
    }
  }
}

export default new ExpenseController();
