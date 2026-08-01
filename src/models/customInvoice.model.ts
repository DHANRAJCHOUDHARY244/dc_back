import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const CustomInvoiceSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    customer_id: { type: Number },
    currency: { type: String, required: true },
    subTotal: { type: Number, required: true },
    address: { type: String },
    mobile_no: { type: String },
    name: { type: String, required: true },
    bypass_token: { type: String },
    taxRate: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    discountRate: { type: Number, required: true },
    /** rate = % of (subtotal − rebates); amount = fixed $. Legacy invoices default to rate. */
    discountMode: {
      type: String,
      enum: ["rate", "amount"],
      default: "rate",
    },
    total: { type: Number, required: true },
    items: jsonArray,
    pay_status: {
      type: String,
      default: "PENDING",
      enum: ["PENDING", "PAID", "CANCELLED", "EXPIRED", "PARTIALLY_PAID", "REFUNDED"],
    },
    partialAmount: { type: Number },
    loan_enabled: { type: Boolean, required: true, default: false },
    loan_meta: { type: Schema.Types.Mixed },
    dateOfDue: { type: Date, required: true },
    paid_date: { type: Date },
    status_updated_date: { type: Date },
    signed_date: { type: Date },
    progress: jsonArray,
  },
  collectionOptions("custom_invoices"),
);

CustomInvoiceSchema.virtual("customer", {
  ref: "User",
  localField: "customer_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(CustomInvoiceSchema, { collection: "custom_invoices", paranoid: true });

const CustomInvoice =
  mongoose.models.CustomInvoice ?? mongoose.model("CustomInvoice", CustomInvoiceSchema);
export default CustomInvoice;
