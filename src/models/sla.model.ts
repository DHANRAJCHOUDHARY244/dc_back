import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";
import { SlaResponsibilityType, SlaStatus } from "@constants/sla.constants";

const SlaStageConfigSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		stage: { type: String, required: true, unique: true, index: true },
		label: { type: String, default: "" },
		enabled: { type: Boolean, default: true },
		standard_hours: { type: Number, required: true, default: 24 },
		warning_hours: { type: Number, required: true, default: 18 },
		escalation_hours: { type: Number, required: true, default: 24 },
		critical_hours: { type: Number, required: true, default: 48 },
		responsible_department: { type: String, default: "Operations" },
		responsible_role: { type: String, default: "" },
		version: { type: Number, default: 1 },
		updated_by: { type: Number, default: null },
	},
	collectionOptions("sla_stage_configs"),
);

applyBasePlugins(SlaStageConfigSchema, { collection: "sla_stage_configs", paranoid: true });

export const SlaStageConfig =
	mongoose.models.SlaStageConfig ?? mongoose.model("SlaStageConfig", SlaStageConfigSchema);

const SlaDelayReasonSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		code: { type: String, required: true, unique: true, index: true },
		label: { type: String, required: true },
		category: { type: String, required: true, index: true },
		is_external: { type: Boolean, default: false },
		responsibility_party: { type: String, default: "Operations" },
		active: { type: Boolean, default: true },
	},
	collectionOptions("sla_delay_reasons"),
);

applyBasePlugins(SlaDelayReasonSchema, { collection: "sla_delay_reasons", paranoid: true });

export const SlaDelayReason =
	mongoose.models.SlaDelayReason ?? mongoose.model("SlaDelayReason", SlaDelayReasonSchema);

const SlaStageRunSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		quote_id: { type: Number, required: true, index: true },
		stage: { type: String, required: true, index: true },
		active: { type: Boolean, default: true, index: true },
		started_at: { type: Date, required: true, index: true },
		ended_at: { type: Date, default: null },
		standard_hours: { type: Number, required: true },
		warning_hours: { type: Number, required: true },
		escalation_hours: { type: Number, required: true },
		critical_hours: { type: Number, required: true },
		sla_status: {
			type: String,
			enum: Object.values(SlaStatus),
			default: SlaStatus.ON_TRACK,
			index: true,
		},
		delay_hours: { type: Number, default: 0 },
		delay_reason_code: { type: String, default: null },
		delay_reason_label: { type: String, default: null },
		delay_explanation: { type: String, default: "" },
		responsibility_type: {
			type: String,
			enum: Object.values(SlaResponsibilityType),
			default: null,
		},
		responsibility_party: { type: String, default: null },
		responsible_department: { type: String, default: "" },
		responsible_role: { type: String, default: "" },
		responsible_user_id: { type: Number, default: null },
		breached_at: { type: Date, default: null },
		warning_at: { type: Date, default: null },
		critical_at: { type: Date, default: null },
		resolved_at: { type: Date, default: null },
		resolution_notes: { type: String, default: "" },
		resolved_by: { type: Number, default: null },
		task_id: { type: Number, default: null },
		notified_breach: { type: Boolean, default: false },
		notified_critical: { type: Boolean, default: false },
		events: jsonArray,
	},
	collectionOptions("sla_stage_runs"),
);

SlaStageRunSchema.index({ active: 1, sla_status: 1 });
SlaStageRunSchema.index({ quote_id: 1, active: 1 });

applyBasePlugins(SlaStageRunSchema, { collection: "sla_stage_runs", paranoid: true });

export const SlaStageRun =
	mongoose.models.SlaStageRun ?? mongoose.model("SlaStageRun", SlaStageRunSchema);

export default { SlaStageConfig, SlaDelayReason, SlaStageRun };
