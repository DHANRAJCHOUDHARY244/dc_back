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

    suburb: { type: String },
    country: { type: String, default: "Australia" },
    campaign_name: { type: String },
    ad_name: { type: String },
    landing_page: { type: String },
    public_id: { type: String, index: true },
    created_by: { type: Number, index: true },
    team_leader_id: { type: Number, index: true },
    previous_owner_id: { type: Number },

    solar_requirement: { type: String },
    battery_requirement: { type: String },
    solar_system_size: { type: String },
    battery_size: { type: String },
    existing_inverter: { type: String },
    installation_location: { type: String },
    customer_type: { type: String },
    purchase_timeframe: { type: String },
    estimated_system_value: { type: Number, default: 0 },
    estimated_sales_value: { type: Number, default: 0 },

    buying_intent: { type: String },
    conversion_probability: { type: Number, default: 0 },
    ai_summary: { type: String },
    recommended_action: { type: String },
    recommended_follow_up_at: { type: Date },
    customer_objections: jsonArray,

    first_contacted_at: { type: Date },
    opened_at: { type: Date },
    received_at: { type: Date },
    response_seconds: { type: Number },

    /** Last uncontacted follow-up escalation notified (stops 5‑min cron spam). */
    followup_notified_level: { type: Number, default: 0 },
    followup_notified_at: { type: Date },

    notes: jsonArray,
    transfers: jsonArray,
    audit_log: jsonArray,
    linked_lead_ids: jsonArray,
    merged_into_id: { type: Number, index: true },

    external_id: { type: String, index: true },
    utm_source: { type: String },
    utm_campaign: { type: String },
    utm_medium: { type: String },

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

LeadSchema.virtual("team_leader", {
  ref: "User",
  localField: "team_leader_id",
  foreignField: "id",
  justOne: true,
});

LeadSchema.virtual("creator", {
  ref: "User",
  localField: "created_by",
  foreignField: "id",
  justOne: true,
});

LeadSchema.virtual("previous_owner", {
  ref: "User",
  localField: "previous_owner_id",
  foreignField: "id",
  justOne: true,
});

applyBasePlugins(LeadSchema, { collection: "leads", paranoid: true });

const Lead = mongoose.models.Lead ?? mongoose.model("Lead", LeadSchema);
export default Lead;
