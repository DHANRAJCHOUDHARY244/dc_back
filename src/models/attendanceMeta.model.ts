import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

const AttendanceMonthLockSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		year: { type: Number, required: true },
		month: { type: Number, required: true },
		locked: { type: Boolean, default: true },
		locked_by: { type: Number, default: null },
		locked_at: { type: Date, default: null },
		unlocked_by: { type: Number, default: null },
		unlocked_at: { type: Date, default: null },
		note: { type: String, default: "" },
	},
	collectionOptions("attendance_month_locks"),
);

AttendanceMonthLockSchema.index({ year: 1, month: 1 }, { unique: true });

applyBasePlugins(AttendanceMonthLockSchema, {
	collection: "attendance_month_locks",
	paranoid: true,
});

const AttendanceAuditLogSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		actor_id: { type: Number, required: true, index: true },
		target_user_id: { type: Number, default: null, index: true },
		action: { type: String, required: true, index: true },
		entity: { type: String, required: true },
		entity_id: { type: Number, default: null },
		date_key: { type: String, default: "" },
		old_value: jsonObject,
		new_value: jsonObject,
		reason: { type: String, default: "" },
		meta: jsonObject,
	},
	collectionOptions("attendance_audit_logs"),
);

applyBasePlugins(AttendanceAuditLogSchema, {
	collection: "attendance_audit_logs",
	paranoid: true,
});

export const AttendanceMonthLock =
	mongoose.models.AttendanceMonthLock ??
	mongoose.model("AttendanceMonthLock", AttendanceMonthLockSchema);

export const AttendanceAuditLog =
	mongoose.models.AttendanceAuditLog ??
	mongoose.model("AttendanceAuditLog", AttendanceAuditLogSchema);
