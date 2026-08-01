import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const ExpenseSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    category: {
      type: String,
      enum: [
        "FOOD",
        "TRAVEL",
        "OFFICE",
        "SALARY",
        "UTILITIES",
        "MARKETING",
        "SOFTWARE",
        "MAINTENANCE",
        "COMISSION",
        "LEAD_COST",
        "PRE_APPROVAL",
        "GRID_CONNECTION",
        "OTHER",
      ],
    },
    payment_mode: { type: String, enum: ["CASH", "UPI", "BANK", "CARD"] },
    status: { type: String, default: "PENDING", enum: ["PENDING", "APPROVED", "REJECTED", "PAID"] },
    expense_date: { type: Date, required: true },
    notes: { type: String },
    receipt_url: { type: String },
    /** Optional invoice number (used by marketing / accounts modules) */
    invoice_number: { type: String, default: "" },
    /** Marketing channel / platform (Facebook, Google, etc.) */
    marketing_channel: { type: String, default: "" },
    /** Photo / PDF attachments: { url, name, mime, size, uploaded_at } */
    attachments: jsonArray,
    created_by: { type: Number, required: true },
  },
  collectionOptions("expenses"),
);

ExpenseSchema.virtual("creator", {
  ref: "User",
  localField: "created_by",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(ExpenseSchema, { collection: "expenses", paranoid: false });

const Expense = mongoose.models.Expense ?? mongoose.model("Expense", ExpenseSchema);
export default Expense;
