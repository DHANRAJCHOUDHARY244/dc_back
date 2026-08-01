import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const ProductSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String },
    category: { type: String, required: true, index: true },
    brand: { type: String, index: true },
    description: { type: String },
    img: { type: String },
    pdf: { type: String },
    compliance_pdf: { type: String },
    warranty_pdf: { type: String },
    specifications: jsonArray,
    tags: jsonArray,
    variants: jsonArray,
    status: { type: String, default: "ACTIVE", enum: ["ACTIVE", "INACTIVE", "DRAFT"] },
    created_by: { type: Number, required: true },
    updated_by: { type: Number },
  },
  collectionOptions("products"),
);

ProductSchema.virtual("creator", {
  ref: "User",
  localField: "created_by",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(ProductSchema, { collection: "products", paranoid: true });

const Product = mongoose.models.Product ?? mongoose.model("Product", ProductSchema);
export default Product;
