import mongoose, { Schema } from "mongoose";
import crypto from "crypto";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const DocumentSchema = new Schema(
  {
    /** Business id (UUID string). Distinct from Mongo `_id`. */
    id: { type: String, unique: true, required: true, default: () => crypto.randomUUID() },
    user_id: { type: Number, required: true },
    uploader_id: { type: Number, required: true },
    title: { type: String, required: true },
    original_name: { type: String, required: true },
    stored_name: { type: String, required: true },
    mime_type: { type: String, required: true },
    size_bytes: { type: Number, required: true },
    file_path: { type: String, required: true },
    verification_hash: { type: String, required: true },
    description: jsonArray,
    downloads: { type: Number, default: 0 },
  },
  {
    ...collectionOptions("documents"),
    /** Disable Mongoose's default `id` virtual so our string `id` path persists */
    id: false,
  },
);

DocumentSchema.pre("validate", function () {
  if (!this.get("id")) {
    this.set("id", crypto.randomUUID());
  }
});

applyBasePlugins(DocumentSchema, { collection: "documents", paranoid: false, numericId: false });

const Document = mongoose.models.Document ?? mongoose.model("Document", DocumentSchema);
export default Document;
