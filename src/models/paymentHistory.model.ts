import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const PaymentHistorySchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    quote_id: { type: Number, required: true },
    installer_id: { type: Number },
    sales_person_id: { type: Number },
    installer_total_amount: { type: Number, default: 0 },
    installer_partial_paid_amount: { type: Number, default: 0 },
    installer_tax: { type: Number, default: 0 },
    installer_payment_status: {
      type: String,
      default: "PENDING",
      enum: ["PENDING", "PAID", "CANCELLED", "EXPIRED", "PARTIALLY_PAID"],
    },
    installer_payment_date: { type: Date },
    installer_transaction_id: { type: String },
    sales_person_total_amount: { type: Number, default: 0 },
    sales_person_partial_paid_amount: { type: Number, default: 0 },
    sales_person_tax: { type: Number, default: 0 },
    sales_person_payment_status: {
      type: String,
      default: "PENDING",
      enum: ["PENDING", "PAID", "CANCELLED", "EXPIRED", "PARTIALLY_PAID"],
    },
    sales_person_payment_date: { type: Date },
    sales_person_transaction_id: { type: String },
  },
  collectionOptions("payment_history"),
);

applyBasePlugins(PaymentHistorySchema, { collection: "payment_history", paranoid: true });

const PaymentHistory =
  mongoose.models.PaymentHistory ?? mongoose.model("PaymentHistory", PaymentHistorySchema);
export default PaymentHistory;
