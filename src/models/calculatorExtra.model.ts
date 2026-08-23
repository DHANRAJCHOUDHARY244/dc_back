import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import { StatePriceSchema } from "../schemas/statePrice.schema";

const CalculatorExtraSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    category: { type: String },
    prices: { type: StatePriceSchema, default: () => ({}) },
    active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 0 },
  },
  collectionOptions("calculator_extras"),
);

applyBasePlugins(CalculatorExtraSchema, { collection: "calculator_extras", paranoid: true });

const CalculatorExtra =
  mongoose.models.CalculatorExtra ?? mongoose.model("CalculatorExtra", CalculatorExtraSchema);
export default CalculatorExtra;
