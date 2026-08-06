import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const StockOrderSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    quote_id: { type: Number, required: true },
    address: { type: String },
    sender_id: { type: Number, required: true },
    stock_order_status: {
      type: String,
      default: "PENDING",
      enum: ["PENDING", "ORDERED", "CONFIRMED", "DRIVER_ASSIGNED", "DELIVERED", "CANCELLED", "NOT_REQUIRED"],
    },
    stock_confirm_documents: jsonArray,
    stock_confirm_date: { type: Date },
    stock_delivered_date: { type: Date },
    stock_order_date: { type: Date },
    stock_delivered_documents: jsonArray,
    stock_product_metadata: jsonArray,
    driver_name: { type: String },
    driver_vehicle_name: { type: String },
    driver_vehicle_no: { type: String },
    driver_email: { type: String },
    driver_mob: { type: String },
    /** Expected delivery window shown to the customer */
    expected_delivery_date: { type: Date },
    expected_delivery_time: { type: String },
    tracking_number: { type: String },
    company_id: { type: Number, required: true },
    emails_sent: { type: Schema.Types.Mixed, default: { to: "", cc: [], bcc: [] } },
    bypass_token: { type: Schema.Types.Mixed, default: { crm: "", company: "", driver: "" } },
    progress: jsonArray,
  },
  collectionOptions("stocks"),
);

StockOrderSchema.virtual("sender", { ref: "User", localField: "sender_id", foreignField: "id", justOne: true });
StockOrderSchema.virtual("quote", { ref: "Quote", localField: "quote_id", foreignField: "id", justOne: true });
StockOrderSchema.virtual("company", { ref: "Company", localField: "company_id", foreignField: "id", justOne: true });

applyBasePlugins(StockOrderSchema, { collection: "stocks", paranoid: true });

const StockOrder = mongoose.models.StockOrder ?? mongoose.model("StockOrder", StockOrderSchema);
export default StockOrder;
