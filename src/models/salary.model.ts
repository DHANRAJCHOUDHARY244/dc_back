import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

const SalarySchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, required: true },
    creator_id: { type: Number, required: true },
    date: { type: Date, required: true },
    salary_month: { type: String, required: true },
    basic: { type: Number, required: true },
    bank_details: jsonObject,
    bonus: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    pf: { type: Number, default: 0 },
  },
  collectionOptions("salary"),
);

SalarySchema.virtual("user", { ref: "User", localField: "user_id", foreignField: "id", justOne: true });
SalarySchema.virtual("creator", { ref: "User", localField: "creator_id", foreignField: "id", justOne: true });

SalarySchema.pre("validate", function (this: mongoose.Document & { date?: Date; salary_month?: string }) {
  if (!this.salary_month && this.date) {
    const d = new Date(this.date);
    this.salary_month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
});

applyBasePlugins(SalarySchema, { collection: "salary", paranoid: true });

const Salary = mongoose.models.Salary ?? mongoose.model("Salary", SalarySchema);
export default Salary;
