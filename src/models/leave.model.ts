import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

const LeaveTypeSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		code: { type: String, required: true, unique: true },
		name: { type: String, required: true },
		is_paid: { type: Boolean, default: true },
		default_days: { type: Number, default: 0 },
		is_active: { type: Boolean, default: true },
	},
	collectionOptions("leave_types"),
);

applyBasePlugins(LeaveTypeSchema, { collection: "leave_types", paranoid: true });

const LeaveBalanceSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, index: true },
		leave_type_id: { type: Number, required: true, index: true },
		year: { type: Number, required: true, index: true },
		allocated: { type: Number, default: 0 },
		used: { type: Number, default: 0 },
		pending: { type: Number, default: 0 },
	},
	collectionOptions("leave_balances"),
);

LeaveBalanceSchema.index({ user_id: 1, leave_type_id: 1, year: 1 }, { unique: true });

applyBasePlugins(LeaveBalanceSchema, { collection: "leave_balances", paranoid: true });

const LeaveRequestSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, index: true },
		leave_type_id: { type: Number, required: true },
		start_date: { type: Date, required: true },
		end_date: { type: Date, required: true },
		days: { type: Number, required: true },
		reason: { type: String, default: "" },
		attachment: jsonObject,
		status: {
			type: String,
			enum: ["PENDING_TL", "PENDING_HR", "APPROVED", "REJECTED", "CANCELLED"],
			default: "PENDING_TL",
			index: true,
		},
		tl_approver_id: { type: Number, default: null },
		tl_action_at: { type: Date, default: null },
		tl_note: { type: String, default: "" },
		hr_approver_id: { type: Number, default: null },
		hr_action_at: { type: Date, default: null },
		hr_note: { type: String, default: "" },
	},
	collectionOptions("leave_requests"),
);

LeaveRequestSchema.virtual("user", {
	ref: "User",
	localField: "user_id",
	foreignField: "id",
	justOne: true,
});
LeaveRequestSchema.virtual("leave_type", {
	ref: "LeaveType",
	localField: "leave_type_id",
	foreignField: "id",
	justOne: true,
});

applyBasePlugins(LeaveRequestSchema, { collection: "leave_requests", paranoid: true });

export const LeaveType = mongoose.models.LeaveType ?? mongoose.model("LeaveType", LeaveTypeSchema);
export const LeaveBalance =
	mongoose.models.LeaveBalance ?? mongoose.model("LeaveBalance", LeaveBalanceSchema);
export const LeaveRequest =
	mongoose.models.LeaveRequest ?? mongoose.model("LeaveRequest", LeaveRequestSchema);
