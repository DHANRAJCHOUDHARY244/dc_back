import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

/**
 * Manual monthly budget entry (must be filled by accounts).
 * Unique per (year, month). Annual total lives on CompanyBudgetYear.
 */
const CompanyBudgetMonthSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: "AUD" },
    notes: { type: String },
    updated_by: { type: Number },
  },
  collectionOptions("company_budget_months"),
);

CompanyBudgetMonthSchema.index({ year: 1, month: 1 }, { unique: true });

CompanyBudgetMonthSchema.virtual("budgetYear", {
  ref: "CompanyBudgetYear",
  localField: "year",
  foreignField: "year",
  justOne: true,
});

applyBasePlugins(CompanyBudgetMonthSchema, { collection: "company_budget_months", paranoid: true });

const CompanyBudgetMonth =
  mongoose.models.CompanyBudgetMonth ??
  mongoose.model("CompanyBudgetMonth", CompanyBudgetMonthSchema);

export default CompanyBudgetMonth;
