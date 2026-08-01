import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const QuoteWorkflowSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    quote_id: { type: Number },
    invoice_id: { type: Number },
    stock_id: { type: Number },
    installer_id: { type: Number },
    customer_id: { type: Number },
    sales_person_id: { type: Number },
    installer_payment_status: { type: String },
    installer_payment: { type: Number },
    sales_person_payment_status: { type: String },
    sales_person_payment: { type: Number },
    documents_from_installer: jsonArray,
    rebate_received: { type: Number },
    workflow_status: { type: String },
  },
  collectionOptions("quote_workflows"),
);

QuoteWorkflowSchema.virtual("quote", {
  ref: "Quote",
  localField: "quote_id",
  foreignField: "id",
  justOne: true,
});
QuoteWorkflowSchema.virtual("invoice", {
  ref: "Invoice",
  localField: "invoice_id",
  foreignField: "id",
  justOne: true,
});
QuoteWorkflowSchema.virtual("installer", {
  ref: "User",
  localField: "installer_id",
  foreignField: "id",
  justOne: true,
});
QuoteWorkflowSchema.virtual("sales_person", {
  ref: "User",
  localField: "sales_person_id",
  foreignField: "id",
  justOne: true,
});
QuoteWorkflowSchema.virtual("customer", {
  ref: "User",
  localField: "customer_id",
  foreignField: "id",
  justOne: true,
});
QuoteWorkflowSchema.virtual("stock_order", {
  ref: "StockOrder",
  localField: "stock_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(QuoteWorkflowSchema, { collection: "quote_workflows", paranoid: true });

const QuoteWorkflow = mongoose.models.QuoteWorkflow ?? mongoose.model("QuoteWorkflow", QuoteWorkflowSchema);
export default QuoteWorkflow;
