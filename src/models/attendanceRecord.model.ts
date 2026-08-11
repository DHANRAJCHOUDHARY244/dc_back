import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";
import { AttendanceSource, AttendanceStatus } from "@constants/attendance.constants";

const AttendanceRecordSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, index: true },
		date: { type: Date, required: true, index: true },
		date_key: { type: String, required: true, index: true },
		status: {
			type: String,
			enum: Object.values(AttendanceStatus),
			required: true,
			index: true,
		},
		check_in: { type: Date, default: null },
		check_out: { type: Date, default: null },
		total_minutes: { type: Number, default: 0 },
		break_minutes: { type: Number, default: 0 },
		net_minutes: { type: Number, default: 0 },
		late_minutes: { type: Number, default: 0 },
		early_departure_minutes: { type: Number, default: 0 },
		overtime_minutes: { type: Number, default: 0 },
		check_in_ip: { type: String, default: "" },
		check_out_ip: { type: String, default: "" },
		/** Reserved for future GPS */
		check_in_location: jsonObject,
		check_out_location: jsonObject,
		source: {
			type: String,
			enum: Object.values(AttendanceSource),
			default: AttendanceSource.SELF_PUNCH,
		},
		notes: { type: String, default: "" },
		is_locked: { type: Boolean, default: false },
		/** Special working Sunday override */
		force_working: { type: Boolean, default: false },
		marked_by: { type: Number, default: null },
		leave_request_id: { type: Number, default: null },
		correction_id: { type: Number, default: null },
	},
	collectionOptions("attendance_records"),
);

AttendanceRecordSchema.index({ user_id: 1, date_key: 1 }, { unique: true });

AttendanceRecordSchema.virtual("user", {
	ref: "User",
	localField: "user_id",
	foreignField: "id",
	justOne: true,
});

applyBasePlugins(AttendanceRecordSchema, { collection: "attendance_records", paranoid: true });

const AttendanceRecord =
	mongoose.models.AttendanceRecord ?? mongoose.model("AttendanceRecord", AttendanceRecordSchema);
export default AttendanceRecord;
