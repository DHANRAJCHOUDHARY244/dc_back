import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const LeadServiceAreaSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		name: { type: String, required: true },
		states: jsonArray,
		suburbs: jsonArray,
		postcodes: jsonArray,
		team_leader_id: { type: Number, default: null, index: true },
		salesperson_ids: jsonArray,
		active: { type: Boolean, default: true },
	},
	collectionOptions("lead_service_areas"),
);

applyBasePlugins(LeadServiceAreaSchema, { collection: "lead_service_areas", paranoid: true });

const LeadServiceArea =
	mongoose.models.LeadServiceArea ?? mongoose.model("LeadServiceArea", LeadServiceAreaSchema);
export default LeadServiceArea;
