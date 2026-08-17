import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const LeadDistributionSettingsSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		enabled: { type: Boolean, default: true },
		mode: { type: String, default: "ai_smart" },
		auto_reassign: { type: Boolean, default: false },
		notify_only: { type: Boolean, default: true },
		max_leads_per_agent: { type: Number, default: 20 },
		response_time_minutes: { type: Number, default: 30 },
		follow_up_l1_hours: { type: Number, default: 2 },
		follow_up_l2_hours: { type: Number, default: 6 },
		follow_up_l3_hours: { type: Number, default: 24 },
	},
	collectionOptions("lead_distribution_settings"),
);

applyBasePlugins(LeadDistributionSettingsSchema, {
	collection: "lead_distribution_settings",
	paranoid: true,
});

const LeadDistributionSettings =
	mongoose.models.LeadDistributionSettings ??
	mongoose.model("LeadDistributionSettings", LeadDistributionSettingsSchema);
export default LeadDistributionSettings;
