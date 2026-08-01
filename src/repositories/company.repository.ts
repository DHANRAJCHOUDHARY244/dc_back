import Company from "@models/company.model";
import { BaseRepository } from "./BaseRepository";

export class CompanyRepository extends BaseRepository {
  constructor() {
    super(Company, true);
  }
}

export const companyRepository = new CompanyRepository();
