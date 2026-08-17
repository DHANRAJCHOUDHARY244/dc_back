import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";
import { AGENT_AVAILABILITY } from "@constants/leadPipeline.constants";

const LeadAgentSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, unique: true, index: true },
		availability: {
			type: String,
			enum: [...AGENT_AVAILABILITY],
			default: "Available",
			index: true,
		},
		max_daily_leads: { type: Number, default: 20 },
		max_active_leads: { type: Number, default: 40 },
		max_follow_ups: { type: Number, default: 25 },
		max_concurrent_opportunities: { type: Number, default: 15 },
		product_expertise: jsonArray,
		service_states: jsonArray,
		service_postcodes: jsonArray,
		languages: jsonArray,
		working_hours_start: { type: String, default: "09:00" },
		working_hours_end: { type: String, default: "17:30" },
		do_not_assign: { type: Boolean, default: false, index: true },
		notes: { type: String, default: "" },
	},
	collectionOptions("lead_agents"),
);

LeadAgentSchema.virtual("user", {
	ref: "User",
	localField: "user_id",
	foreignField: "id",
	justOne: true,
});

applyBasePlugins(LeadAgentSchema, { collection: "lead_agents", paranoid: true });

const LeadAgent = mongoose.models.LeadAgent ?? mongoose.model("LeadAgent", LeadAgentSchema);
export default LeadAgent;
