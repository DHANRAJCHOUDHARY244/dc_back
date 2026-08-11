import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

const AttendanceCorrectionSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, index: true },
		date: { type: Date, required: true },
		date_key: { type: String, required: true, index: true },
		original_record: jsonObject,
		requested_check_in: { type: Date, default: null },
		requested_check_out: { type: Date, default: null },
		requested_status: { type: String, default: "" },
		reason: { type: String, required: true },
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
	collectionOptions("attendance_corrections"),
);

AttendanceCorrectionSchema.virtual("user", {
	ref: "User",
	localField: "user_id",
	foreignField: "id",
	justOne: true,
});

applyBasePlugins(AttendanceCorrectionSchema, {
	collection: "attendance_corrections",
	paranoid: true,
});

const AttendanceCorrection =
	mongoose.models.AttendanceCorrection ??
	mongoose.model("AttendanceCorrection", AttendanceCorrectionSchema);
export default AttendanceCorrection;
