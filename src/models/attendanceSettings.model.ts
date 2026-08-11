import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

const AttendanceSettingsSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		/** singleton key */
		key: { type: String, default: "default", unique: true },
		office_start: { type: String, default: "09:00" },
		office_end: { type: String, default: "18:00" },
		grace_minutes: { type: Number, default: 15 },
		late_threshold_minutes: { type: Number, default: 15 },
		half_day_hours: { type: Number, default: 4 },
		min_full_day_hours: { type: Number, default: 7.5 },
		break_minutes: { type: Number, default: 60 },
		overtime_after_minutes: { type: Number, default: 480 },
		weekly_off_days: { type: [Number], default: () => [0] },
		deductible_statuses: {
			type: [String],
			default: () => ["ABSENT", "UNPAID_LEAVE"],
		},
		half_day_deduction_fraction: { type: Number, default: 0.5 },
		attendance_percentage_include_paid_leave: { type: Boolean, default: true },
		allow_wfh: { type: Boolean, default: true },
		extra: jsonObject,
	},
	collectionOptions("attendance_settings"),
);

applyBasePlugins(AttendanceSettingsSchema, { collection: "attendance_settings", paranoid: true });

const AttendanceSettings =
	mongoose.models.AttendanceSettings ?? mongoose.model("AttendanceSettings", AttendanceSettingsSchema);
export default AttendanceSettings;
