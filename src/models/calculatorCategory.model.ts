import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const CalculatorCategorySchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    rebate_options: { type: [String], default: [] },
    size_fields: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 0 },
  },
  collectionOptions("calculator_categories"),
);

applyBasePlugins(CalculatorCategorySchema, { collection: "calculator_categories", paranoid: true });

const CalculatorCategory =
  mongoose.models.CalculatorCategory ?? mongoose.model("CalculatorCategory", CalculatorCategorySchema);
export default CalculatorCategory;
