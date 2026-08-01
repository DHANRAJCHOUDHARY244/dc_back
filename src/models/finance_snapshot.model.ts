import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const FinanceSnapshotSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    period_type: { type: String, required: true, enum: ["DAILY", "MONTHLY", "YEARLY"] },
    period_key: { type: String, required: true },
    base_currency: { type: String, default: "INR" },
    revenue_invoice: { type: Number },
    revenue_custom_invoice: { type: Number },
    revenue_total: { type: Number },
    expense_total: { type: Number },
    salary_total: { type: Number },
    net_profit: { type: Number },
    expense_by_category: { type: Schema.Types.Mixed },
    expense_by_payment_mode: { type: Schema.Types.Mixed },
    salary_distribution: { type: Schema.Types.Mixed },
    revenue_by_status: { type: Schema.Types.Mixed },
    revenue_by_source: { type: Schema.Types.Mixed },
    currency_breakdown: { type: Schema.Types.Mixed },
    cash_flow: { type: Schema.Types.Mixed },
  },
  collectionOptions("finance_snapshots"),
);

applyBasePlugins(FinanceSnapshotSchema, { collection: "finance_snapshots", paranoid: true });

const FinanceSnapshot =
  mongoose.models.FinanceSnapshot ?? mongoose.model("FinanceSnapshot", FinanceSnapshotSchema);
export default FinanceSnapshot;
