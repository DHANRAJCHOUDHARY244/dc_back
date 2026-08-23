import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

/**
 * Admin-managed Solar / Battery rebate & STC schemes (federal + state).
 * Used by the shared rebate engine for Quote + Calculator.
 */
const RebateSchemeSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    /** Stable key e.g. federal_solar_stc, vic_pv_rebate, wa_synergy_battery */
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    jurisdiction: {
      type: String,
      enum: ["federal", "state"],
      default: "state",
      index: true,
    },
    /** Empty / ALL for federal; VIC|NSW|… for state */
    state: { type: String, default: "", index: true },
    product_type: {
      type: String,
      enum: ["solar", "battery", "hot_water", "vpp", "any"],
      default: "any",
    },
    customer_type: {
      type: String,
      enum: ["residential", "commercial", "any"],
      default: "any",
    },
    start_date: { type: Date, default: null },
    end_date: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
    /** fixed | per_kwh | per_stc | percent | battery_stc_bands | solar_stc */
    rebate_type: {
      type: String,
      enum: ["fixed", "per_kwh", "per_stc", "percent", "battery_stc_bands", "solar_stc"],
      default: "fixed",
    },
    /** Unit amount ($ or % depending on type) */
    amount: { type: Number, default: 0 },
    max_amount: { type: Number, default: 0 },
    min_system_kw: { type: Number, default: 0 },
    max_system_kw: { type: Number, default: 0 },
    min_battery_kwh: { type: Number, default: 0 },
    max_battery_kwh: { type: Number, default: 0 },
    vpp_required: { type: Boolean, default: false },
    /** e.g. Synergy | Horizon Power */
    retailer_required: { type: String, default: "" },
    stackable: { type: Boolean, default: true },
    /** When true, never deduct from Final Payable — show as finance only */
    is_loan: { type: Boolean, default: false },
    /** Requires salesperson confirmation before applying */
    requires_confirmation: { type: Boolean, default: true },
    eligibility_text: { type: String, default: "" },
    explanation: { type: String, default: "" },
    /** Structured rules / capacity bands / date windows */
    rules: jsonObject,
    sort_order: { type: Number, default: 100 },
    created_by: { type: Number },
    updated_by: { type: Number },
  },
  collectionOptions("rebate_schemes"),
);

applyBasePlugins(RebateSchemeSchema, { collection: "rebate_schemes", paranoid: true });

const RebateScheme =
  mongoose.models.RebateScheme ?? mongoose.model("RebateScheme", RebateSchemeSchema);

export default RebateScheme;
