import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray, jsonObject } from "@db/plugins";

export const FEEDBACK_KINDS = ["COMPLAINT", "SUGGESTION"] as const;
export const FEEDBACK_STATUSES = [
	"SUBMITTED",
	"UNDER_REVIEW",
	"INVESTIGATION",
	"ACTION_REQUIRED",
	"WAITING_FOR_INFORMATION",
	"RESOLVED",
	"CLOSED",
	"REJECTED",
	"ESCALATED",
	"ACCEPTED",
	"IN_DEVELOPMENT",
	"IMPLEMENTED",
	"NOT_FEASIBLE",
] as const;
export const FEEDBACK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const FEEDBACK_MESSAGE_VISIBILITY = ["EMPLOYEE_THREAD", "INTERNAL"] as const;

const FeedbackCaseSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		case_id: { type: String, required: true, unique: true, index: true },
		kind: { type: String, enum: FEEDBACK_KINDS, required: true, index: true },
		category: { type: String, default: "", index: true },
		type: { type: String, default: "" },
		priority: {
			type: String,
			enum: FEEDBACK_PRIORITIES,
			default: "MEDIUM",
			index: true,
		},
		subject: { type: String, required: true },
		details: { type: String, default: "" },
		form_fields: jsonObject,
		is_anonymous: { type: Boolean, default: false, index: true },
		submitter_user_id: { type: Number, required: true, index: true },
		submitter_hash: { type: String, default: "" },
		employee_code: { type: String, default: null },
		department: { type: String, default: "" },
		team: { type: String, default: "" },
		status: {
			type: String,
			enum: FEEDBACK_STATUSES,
			default: "SUBMITTED",
			index: true,
		},
		assignee_id: { type: Number, default: null, index: true },
		related_user_id: { type: Number, default: null },
		related_job_ref: { type: String, default: "" },
		preferred_resolution: { type: String, default: "" },
		suggestion_benefit: { type: String, default: "" },
		suggestion_effort: { type: String, default: "" },
		resolution_summary: { type: String, default: "" },
		attachments: jsonArray,
		identity_unlocked: { type: Boolean, default: false },
		identity_unlocked_by: { type: Number, default: null },
		identity_unlocked_at: { type: Date, default: null },
	},
	collectionOptions("feedback_cases"),
);

applyBasePlugins(FeedbackCaseSchema, { collection: "feedback_cases", paranoid: true });

const FeedbackMessageSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		case_ref: { type: String, required: true, index: true },
		case_numeric_id: { type: Number, required: true, index: true },
		author_user_id: { type: Number, required: true },
		body: { type: String, required: true },
		visibility: {
			type: String,
			enum: FEEDBACK_MESSAGE_VISIBILITY,
			default: "EMPLOYEE_THREAD",
			index: true,
		},
		attachments: jsonArray,
	},
	collectionOptions("feedback_messages"),
);

applyBasePlugins(FeedbackMessageSchema, { collection: "feedback_messages", paranoid: true });

const FeedbackInternalNoteSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		case_ref: { type: String, required: true, index: true },
		case_numeric_id: { type: Number, required: true, index: true },
		author_user_id: { type: Number, required: true },
		body: { type: String, required: true },
	},
	collectionOptions("feedback_internal_notes"),
);

applyBasePlugins(FeedbackInternalNoteSchema, { collection: "feedback_internal_notes", paranoid: true });

const FeedbackAuditLogSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		case_ref: { type: String, default: "", index: true },
		case_numeric_id: { type: Number, default: null, index: true },
		actor_user_id: { type: Number, default: null, index: true },
		employee_code: { type: String, default: "" },
		action: { type: String, required: true, index: true },
		meta: jsonObject,
	},
	collectionOptions("feedback_audit_logs"),
);

applyBasePlugins(FeedbackAuditLogSchema, { collection: "feedback_audit_logs", paranoid: false });

const FeedbackSettingsSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		confidentiality_notice: {
			type: String,
			default:
				"Your submission is confidential. Only authorised Admin/HR/Management can access case details. Misuse of this channel may be investigated.",
		},
		anonymous_notice: {
			type: String,
			default:
				"Anonymous submissions hide your name and employee code from case handlers. Identity is retained in a restricted audit trail and can only be unlocked by Super Admin with an audit record.",
		},
		admin_roles: {
			type: [String],
			default: () => ["SUPER_ADMIN", "ADMIN", "HR_EXECUTIVE", "CEO"],
		},
		identity_unlock_roles: {
			type: [String],
			default: () => ["SUPER_ADMIN"],
		},
	},
	collectionOptions("feedback_settings"),
);

applyBasePlugins(FeedbackSettingsSchema, { collection: "feedback_settings", paranoid: false });

export const FeedbackCase =
	mongoose.models.FeedbackCase ?? mongoose.model("FeedbackCase", FeedbackCaseSchema);
export const FeedbackMessage =
	mongoose.models.FeedbackMessage ?? mongoose.model("FeedbackMessage", FeedbackMessageSchema);
export const FeedbackInternalNote =
	mongoose.models.FeedbackInternalNote ??
	mongoose.model("FeedbackInternalNote", FeedbackInternalNoteSchema);
export const FeedbackAuditLog =
	mongoose.models.FeedbackAuditLog ?? mongoose.model("FeedbackAuditLog", FeedbackAuditLogSchema);
export const FeedbackSettings =
	mongoose.models.FeedbackSettings ?? mongoose.model("FeedbackSettings", FeedbackSettingsSchema);

export default {
	FeedbackCase,
	FeedbackMessage,
	FeedbackInternalNote,
	FeedbackAuditLog,
	FeedbackSettings,
};
