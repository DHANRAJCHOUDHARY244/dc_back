import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import { INSTALLER_AVAILABILITY_STATUSES } from "@constants/installerJob.constants";

const InstallerAvailabilitySchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    installer_id: { type: Number, required: true, index: true },
    slot_date: { type: Date, required: true, index: true },
    start_time: { type: String, default: "" },
    end_time: { type: String, default: "" },
    status: { type: String, enum: INSTALLER_AVAILABILITY_STATUSES, default: "AVAILABLE", index: true },
    job_id: { type: Number, index: true },
    notes: { type: String, default: "" },
  },
  collectionOptions("installer_availability"),
);

InstallerAvailabilitySchema.virtual("installer", { ref: "User", localField: "installer_id", foreignField: "id", justOne: true });
InstallerAvailabilitySchema.virtual("job", { ref: "InstallerJob", localField: "job_id", foreignField: "id", justOne: true });

applyBasePlugins(InstallerAvailabilitySchema, { collection: "installer_availability", paranoid: true });

const InstallerAvailability =
  mongoose.models.InstallerAvailability ?? mongoose.model("InstallerAvailability", InstallerAvailabilitySchema);
export default InstallerAvailability;
