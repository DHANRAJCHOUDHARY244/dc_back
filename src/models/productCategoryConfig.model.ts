import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const ProductCategoryConfigSchema = new Schema(
  {
    category: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    label: { type: String, required: true },
    icon: { type: String, default: "solar:box-bold-duotone" },
    color: { type: String, default: "#64748b" },
    gradient: { type: String, default: "from-slate-500 to-slate-600" },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  collectionOptions("product_category_configs"),
);

applyBasePlugins(ProductCategoryConfigSchema, { collection: "product_category_configs", paranoid: true });

const ProductCategoryConfig =
  mongoose.models.ProductCategoryConfig ??
  mongoose.model("ProductCategoryConfig", ProductCategoryConfigSchema);
export default ProductCategoryConfig;
