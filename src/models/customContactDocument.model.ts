import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const CustomContactDocumentSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    installer_id: { type: Number, required: true },
    agreement_id: { type: Number, required: true },
    document_type: { type: String, required: true },
    url: { type: String, required: true },
  },
  collectionOptions("custom_contact_documents"),
);

applyBasePlugins(CustomContactDocumentSchema, { collection: "custom_contact_documents", paranoid: true });

const CustomContactDocument =
  mongoose.models.CustomContactDocument ?? mongoose.model("CustomContactDocument", CustomContactDocumentSchema);
export default CustomContactDocument;
