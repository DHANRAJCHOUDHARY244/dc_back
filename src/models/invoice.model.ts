import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const InvoiceSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    sender_id: { type: Number },
    quote_id: { type: Number, index: true },
    bypass_token: { type: String },
    mobile_no: { type: String },
    name: { type: String, required: true },
    pay_status: {
      type: String,
      default: "PENDING",
      enum: [
        "DRAFT",
        "PENDING",
        "PAID",
        "CANCELLED",
        "EXPIRED",
        "PARTIALLY_PAID",
        "REFUNDED",
        "DISCOUNT",
        "CLOSED",
      ],
    },
    partialAmount: { type: Number },
    dateOfDue: { type: Date, required: true },
    paid_date: { type: Date },
    status_updated_date: { type: Date },
    /** Event date for the current payment status (user-chosen). */
    payment_status_date: { type: Date },
    payment_notes: { type: String, default: "" },
    payment_history: jsonArray,
    address: { type: String },
    progress: jsonArray,
  },
  collectionOptions("invoices"),
);

InvoiceSchema.virtual("sender", { ref: "User", localField: "sender_id", foreignField: "id", justOne: true });
InvoiceSchema.virtual("quote", { ref: "Quote", localField: "quote_id", foreignField: "id", justOne: true });

applyBasePlugins(InvoiceSchema, { collection: "invoices", paranoid: true });

const Invoice = mongoose.models.Invoice ?? mongoose.model("Invoice", InvoiceSchema);
export default Invoice;
