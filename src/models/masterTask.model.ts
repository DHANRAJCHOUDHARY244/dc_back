import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const TaskTypeCatalogSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		code: { type: String, required: true, unique: true, index: true },
		label: { type: String, required: true },
		category: { type: String, required: true, index: true },
		active: { type: Boolean, default: true },
	},
	collectionOptions("task_type_catalog"),
);

applyBasePlugins(TaskTypeCatalogSchema, { collection: "task_type_catalog", paranoid: true });

export const TaskTypeCatalog =
	mongoose.models.TaskTypeCatalog ?? mongoose.model("TaskTypeCatalog", TaskTypeCatalogSchema);

const EscalationRuleSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		task_type: { type: String, required: true, index: true },
		label: { type: String, default: "" },
		warning_hours: { type: Number, default: 24 },
		escalate_l1_hours: { type: Number, default: 48 },
		escalate_l2_hours: { type: Number, default: 72 },
		escalate_l3_hours: { type: Number, default: 96 },
		active: { type: Boolean, default: true },
	},
	collectionOptions("task_escalation_rules"),
);

applyBasePlugins(EscalationRuleSchema, { collection: "task_escalation_rules", paranoid: true });

export const EscalationRule =
	mongoose.models.EscalationRule ?? mongoose.model("EscalationRule", EscalationRuleSchema);

const CrmFollowUpSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		follow_up_code: { type: String, unique: true, sparse: true, index: true },
		customer_id: { type: Number, index: true },
		customer_name: { type: String, default: "" },
		quote_id: { type: Number, index: true },
		lead_id: { type: Number, index: true },
		user_id: { type: Number, required: true, index: true },
		employee_code: { type: String, default: "" },
		follow_up_at: { type: Date, required: true, index: true },
		follow_up_type: { type: String, default: "GENERAL" },
		notes: { type: String, default: "" },
		outcome: { type: String, default: null },
		next_follow_up_at: { type: Date, default: null },
		status: {
			type: String,
			enum: ["SCHEDULED", "COMPLETED", "MISSED", "CANCELLED"],
			default: "SCHEDULED",
			index: true,
		},
		task_id: { type: Number, default: null },
		created_by: { type: Number },
		completed_at: { type: Date, default: null },
		missed_at: { type: Date, default: null },
		history: jsonArray,
	},
	collectionOptions("crm_follow_ups"),
);

applyBasePlugins(CrmFollowUpSchema, { collection: "crm_follow_ups", paranoid: true });

export const CrmFollowUp =
	mongoose.models.CrmFollowUp ?? mongoose.model("CrmFollowUp", CrmFollowUpSchema);

export default { TaskTypeCatalog, EscalationRule, CrmFollowUp };
