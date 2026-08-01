import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const InstallerAgreementSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    installer_id: { type: Number, required: true },
    name: { type: String, required: true },
    license: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    job_type: { type: String, required: true },
    html_content: { type: String, required: true },
    signature_url: { type: String },
    accepted: { type: Boolean, default: false },
    accepted_at: { type: Date },
    accepted_ip: { type: String },
    sender: { type: Number, required: true },
    status: { type: String, default: "draft" },
    pdf_url: { type: String },
    bypass_token: { type: String },
    terms_conditions: jsonArray,
  },
  collectionOptions("installer_agreements"),
);

InstallerAgreementSchema.virtual("installer", {
  ref: "User",
  localField: "installer_id",
  foreignField: "id",
  justOne: true,
});
InstallerAgreementSchema.virtual("sended_by", {
  ref: "User",
  localField: "sender",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(InstallerAgreementSchema, { collection: "installer_agreements", paranoid: true });

const InstallerAgreement =
  mongoose.models.InstallerAgreement ?? mongoose.model("InstallerAgreement", InstallerAgreementSchema);
export default InstallerAgreement;
