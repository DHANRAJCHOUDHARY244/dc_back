import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const SiteInfoSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    quote_id: { type: Number, required: true },
    assessment_id: { type: Number },
    installation_date: { type: Date, required: true },
    installation_time: { type: String, default: "" },
    job_type: { type: String, default: "MIXED" },
    installer_id: { type: Number },
    installer_name: { type: String },
    installer_email: { type: String },
    installer_phone: { type: String },
    installer_address: { type: String },
    installer_mobile_no: { type: String },
    installer_details: { type: Schema.Types.Mixed },
  },
  collectionOptions("site_info"),
);

SiteInfoSchema.virtual("installer", { ref: "User", localField: "installer_id", foreignField: "id", justOne: true });
SiteInfoSchema.virtual("quote", { ref: "Quote", localField: "quote_id", foreignField: "id", justOne: true });
SiteInfoSchema.virtual("assessment", { ref: "Assessment", localField: "assessment_id", foreignField: "id", justOne: true });

applyBasePlugins(SiteInfoSchema, { collection: "site_info", paranoid: false });

const SiteInfo = mongoose.models.SiteInfo ?? mongoose.model("SiteInfo", SiteInfoSchema);
export default SiteInfo;
