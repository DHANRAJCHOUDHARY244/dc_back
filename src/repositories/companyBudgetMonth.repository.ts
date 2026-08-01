import CompanyBudgetMonth from "@models/companyBudgetMonth.model";
import { BaseRepository } from "./BaseRepository";

export class CompanyBudgetMonthRepository extends BaseRepository {
  constructor() {
    super(CompanyBudgetMonth, true);
  }
}

export const companyBudgetMonthRepository = new CompanyBudgetMonthRepository();
