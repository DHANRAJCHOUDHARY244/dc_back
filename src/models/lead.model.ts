import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const LeadSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    date: { type: String },
    time: { type: String },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    note: { type: String },
    remark: { type: String },
    lead_id: { type: String },
    is_csv: { type: Boolean, default: false },
    progress: jsonArray,
    uploaded_by: { type: Number },
  },
  collectionOptions("leads"),
);

LeadSchema.virtual("uploader", {
  ref: "User",
  localField: "uploaded_by",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(LeadSchema, { collection: "leads", paranoid: true });

const Lead = mongoose.models.Lead ?? mongoose.model("Lead", LeadSchema);
export default Lead;
