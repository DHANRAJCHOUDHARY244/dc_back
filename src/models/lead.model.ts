import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";
import { LEAD_SCORE_TIERS, LEAD_SOURCES, LEAD_STATUSES } from "@constants/leadPipeline.constants";

const LeadSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    date: { type: String },
    time: { type: String },
    name: { type: String, required: true },
    phone: { type: String, index: true },
    email: { type: String, index: true },
    address: { type: String },
    postcode: { type: String },
    state: { type: String },
    note: { type: String },
    remark: { type: String },
    lead_id: { type: String },
    is_csv: { type: Boolean, default: false },
    progress: jsonArray,
    uploaded_by: { type: Number },

    /** AI Lead Management */
    status: {
      type: String,
      enum: [...LEAD_STATUSES],
      default: "NEW_LEAD",
      index: true,
    },
    source: {
      type: String,
      enum: [...LEAD_SOURCES],
      default: "Manual",
      index: true,
    },
    owner_id: { type: Number, index: true },
    assigned_at: { type: Date },
    score: { type: Number, default: 0, index: true },
    score_tier: {
      type: String,
      enum: [...LEAD_SCORE_TIERS],
      default: "COLD",
      index: true,
    },

    property_type: { type: String },
    ownership: { type: String },
    bill_range: { type: String },
    current_system: { type: String },
    interested_in: jsonArray,
    roof_type: { type: String },
    best_time_to_call: { type: String },
    preferred_contact: { type: String },
    language: { type: String, default: "English" },

    next_follow_up_at: { type: Date, index: true },
    last_contacted_at: { type: Date },
    ai_qualified_at: { type: Date },
    ai_welcome_sent_at: { type: Date },
    ai_messages: jsonArray,
    call_logs: jsonArray,
    timeline: jsonArray,

    cf_id: { type: Number },
    popup_id: { type: Number },
    quote_id: { type: Number },
  },
  collectionOptions("leads"),
);

LeadSchema.virtual("uploader", {
  ref: "User",
  localField: "uploaded_by",
  foreignField: "id",
  justOne: true,
});

LeadSchema.virtual("owner", {
  ref: "User",
  localField: "owner_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(LeadSchema, { collection: "leads", paranoid: true });

const Lead = mongoose.models.Lead ?? mongoose.model("Lead", LeadSchema);
export default Lead;
