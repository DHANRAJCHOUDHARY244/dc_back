import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const ProductItemSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    category: { type: String, required: true },
    name: { type: String, required: true },
    img: { type: String },
    pdf: { type: String },
    compliance_pdf: { type: String },
    warranty_pdf: { type: String },
    description: { type: String },
    moreDescription: jsonArray,
    rebate: jsonArray,
    price: jsonArray,
    phase: { type: String, default: "Phase 1" },
    size: jsonArray,
    stock_status: {
      type: String,
      default: "IN_STOCK",
      enum: ["IN_STOCK", "OUT_OF_STOCK", "LOW_STOCK"],
    },
    stock_quantity: { type: Number, required: true, default: 0 },
    created_by: { type: Number, required: true },
    updated_by: { type: Number },
  },
  collectionOptions("product_items"),
);

applyBasePlugins(ProductItemSchema, { collection: "product_items", paranoid: true });

const ProductItem = mongoose.models.ProductItem ?? mongoose.model("ProductItem", ProductItemSchema);
export default ProductItem;
