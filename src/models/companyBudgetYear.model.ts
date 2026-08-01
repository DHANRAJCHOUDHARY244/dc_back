import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

/**
 * One document per calendar year.
 * `annual_amount` is always the sum of linked CompanyBudgetMonth rows (auto-set on save).
 */
const CompanyBudgetYearSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    year: { type: Number, required: true, unique: true, index: true },
    annual_amount: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: "AUD" },
    notes: { type: String },
    updated_by: { type: Number },
  },
  collectionOptions("company_budget_years"),
);

applyBasePlugins(CompanyBudgetYearSchema, { collection: "company_budget_years", paranoid: true });

const CompanyBudgetYear =
  mongoose.models.CompanyBudgetYear ??
  mongoose.model("CompanyBudgetYear", CompanyBudgetYearSchema);

export default CompanyBudgetYear;
