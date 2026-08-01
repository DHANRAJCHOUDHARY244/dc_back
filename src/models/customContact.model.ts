import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const CustomContactSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    installer_id: { type: Number, required: true },
    name: { type: String, required: true },
    id_type: { type: String },
    id_value: { type: String },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    job_type: { type: String, required: true, default: "CONTRACT" },
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
  collectionOptions("custom_contacts"),
);

CustomContactSchema.virtual("installer", {
  ref: "User",
  localField: "installer_id",
  foreignField: "id",
  justOne: true,
});
CustomContactSchema.virtual("sended_by", {
  ref: "User",
  localField: "sender",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(CustomContactSchema, { collection: "custom_contacts", paranoid: true });

const CustomContact = mongoose.models.CustomContact ?? mongoose.model("CustomContact", CustomContactSchema);
export default CustomContact;
