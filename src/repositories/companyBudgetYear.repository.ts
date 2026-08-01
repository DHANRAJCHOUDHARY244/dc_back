import CompanyBudgetYear from "@models/companyBudgetYear.model";
import { BaseRepository } from "./BaseRepository";

export class CompanyBudgetYearRepository extends BaseRepository {
  constructor() {
    super(CompanyBudgetYear, true);
  }
}

export const companyBudgetYearRepository = new CompanyBudgetYearRepository();
