import Salary from "@models/salary.model";
import { BaseRepository } from "./BaseRepository";

export class SalaryRepository extends BaseRepository {
  constructor() {
    super(Salary, true);
  }
}

export const salaryRepository = new SalaryRepository();
