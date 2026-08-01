import Expense from "@models/expense.model";
import { BaseRepository } from "./BaseRepository";

export class ExpenseRepository extends BaseRepository {
  constructor() {
    super(Expense, false);
  }
}

export const expenseRepository = new ExpenseRepository();
