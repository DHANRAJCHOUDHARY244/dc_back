import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";
import { INSTALLER_JOB_STATUSES, INSTALLER_JOB_TYPES } from "@constants/installerJob.constants";

const InstallerJobSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    job_number: { type: String, index: true },
    site_info_id: { type: Number, index: true },
    quote_id: { type: Number, required: true, index: true },
    assessment_id: { type: Number, index: true },
    installer_id: { type: Number, required: true, index: true },
    assigned_by: { type: Number },
    installation_date: { type: Date, required: true, index: true },
    installation_time: { type: String, default: "" },
    job_type: { type: String, enum: INSTALLER_JOB_TYPES, default: "MIXED" },
    status: { type: String, enum: INSTALLER_JOB_STATUSES, default: "ASSIGNED", index: true },
    job_pack: { type: Schema.Types.Mixed, default: {} },
    checklist: jsonArray,
    serial_numbers: {
      type: Schema.Types.Mixed,
      default: { panels: [], inverter: "", battery: "", other: [] },
    },
    messages: jsonArray,
    uploads: jsonArray,
    customer_notes: { type: String, default: "" },
    internal_notes: { type: String, default: "" },
    special_instructions: { type: String, default: "" },
    completion_report: { type: String, default: "" },
    cancellation_reason: { type: String, default: "" },
    cancelled_at: { type: Date },
    confirmed_at: { type: Date },
    completed_at: { type: Date },
  },
  collectionOptions("installer_jobs"),
);

InstallerJobSchema.virtual("installer", { ref: "User", localField: "installer_id", foreignField: "id", justOne: true });
InstallerJobSchema.virtual("quote", { ref: "Quote", localField: "quote_id", foreignField: "id", justOne: true });
InstallerJobSchema.virtual("assessment", { ref: "Assessment", localField: "assessment_id", foreignField: "id", justOne: true });
InstallerJobSchema.virtual("site_info", { ref: "SiteInfo", localField: "site_info_id", foreignField: "id", justOne: true });

applyBasePlugins(InstallerJobSchema, { collection: "installer_jobs", paranoid: true });

const InstallerJob = mongoose.models.InstallerJob ?? mongoose.model("InstallerJob", InstallerJobSchema);
export default InstallerJob;
