import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";
import { AttendanceSource } from "@constants/attendance.constants";

const AttendancePunchSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		user_id: { type: Number, required: true, index: true },
		attendance_record_id: { type: Number, default: null, index: true },
		date_key: { type: String, required: true, index: true },
		check_in_at: { type: Date, required: true },
		check_out_at: { type: Date, default: null },
		duration_minutes: { type: Number, default: 0 },
		check_in_location: jsonObject,
		check_out_location: jsonObject,
		live_location: jsonObject,
		check_in_ip: { type: String, default: "" },
		check_out_ip: { type: String, default: "" },
		source: {
			type: String,
			enum: Object.values(AttendanceSource),
			default: AttendanceSource.SELF_PUNCH,
		},
	},
	collectionOptions("attendance_punches"),
);

AttendancePunchSchema.index({ user_id: 1, date_key: 1, check_in_at: 1 });
AttendancePunchSchema.index({ user_id: 1, check_out_at: 1 });

applyBasePlugins(AttendancePunchSchema, { collection: "attendance_punches", paranoid: true });

const AttendancePunch =
	mongoose.models.AttendancePunch ?? mongoose.model("AttendancePunch", AttendancePunchSchema);
export default AttendancePunch;
