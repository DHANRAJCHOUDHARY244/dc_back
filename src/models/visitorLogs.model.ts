import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const VisitorLogsSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    quote_id: { type: Number, required: true },
    logs: jsonArray,
    online: { type: Boolean, default: false },
  },
  collectionOptions("visitor_logs"),
);

applyBasePlugins(VisitorLogsSchema, { collection: "visitor_logs", paranoid: true });

const VisitorLogs = mongoose.models.VisitorLogs ?? mongoose.model("VisitorLogs", VisitorLogsSchema);
export default VisitorLogs;
