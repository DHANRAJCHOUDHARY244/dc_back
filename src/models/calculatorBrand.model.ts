import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const CalculatorBrandSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    category_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 0 },
  },
  collectionOptions("calculator_brands"),
);

applyBasePlugins(CalculatorBrandSchema, { collection: "calculator_brands", paranoid: true });

const CalculatorBrand =
  mongoose.models.CalculatorBrand ?? mongoose.model("CalculatorBrand", CalculatorBrandSchema);
export default CalculatorBrand;
