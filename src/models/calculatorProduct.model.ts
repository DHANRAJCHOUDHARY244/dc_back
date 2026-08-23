import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import { StatePriceSchema } from "../schemas/statePrice.schema";

const VariantSchema = new Schema(
  {
    label: { type: String, required: true },
    size_kw: { type: Number },
    battery_kwh: { type: Number },
    inverter_kw: { type: Number },
    capacity: { type: String },
    prices: { type: StatePriceSchema, default: () => ({}) },
    installation_prices: { type: StatePriceSchema, default: () => ({}) },
    // Manually-entered rebate amounts per variant: STC (solar), BSTC (battery).
    stc_rebate: { type: Number, default: 0 },
    bstc_rebate: { type: Number, default: 0 },
  },
  { _id: false },
);

const CalculatorProductSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    category_id: { type: Number, required: true, index: true },
    brand_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    phase: { type: String, enum: ["single", "three", "both"], default: "both" },
    variants: { type: [VariantSchema], default: [] },
    active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 0 },
  },
  collectionOptions("calculator_products"),
);

applyBasePlugins(CalculatorProductSchema, { collection: "calculator_products", paranoid: true });

const CalculatorProduct =
  mongoose.models.CalculatorProduct ?? mongoose.model("CalculatorProduct", CalculatorProductSchema);
export default CalculatorProduct;
