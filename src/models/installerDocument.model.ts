import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const InstallerDocumentSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    installer_id: { type: Number, required: true },
    document_type: { type: String, required: true },
    url: { type: String, required: true },
  },
  collectionOptions("installer_documents"),
);

applyBasePlugins(InstallerDocumentSchema, { collection: "installer_documents", paranoid: true });

const InstallerDocument =
  mongoose.models.InstallerDocument ?? mongoose.model("InstallerDocument", InstallerDocumentSchema);
export default InstallerDocument;
