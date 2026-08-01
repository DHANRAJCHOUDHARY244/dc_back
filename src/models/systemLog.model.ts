import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const SystemLogSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    level: { type: String },
    message: { type: String },
    status: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  collectionOptions("system_logs"),
);

applyBasePlugins(SystemLogSchema, { collection: "system_logs", paranoid: false });

const SystemLog = mongoose.models.SystemLog ?? mongoose.model("SystemLog", SystemLogSchema);
export default SystemLog;
