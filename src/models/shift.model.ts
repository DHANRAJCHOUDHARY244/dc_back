import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const ShiftSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		name: { type: String, required: true },
		start_time: { type: String, default: "09:00" },
		end_time: { type: String, default: "18:00" },
		grace_minutes: { type: Number, default: 15 },
		late_threshold_minutes: { type: Number, default: 15 },
		half_day_hours: { type: Number, default: 4 },
		min_full_day_hours: { type: Number, default: 7.5 },
		break_minutes: { type: Number, default: 60 },
		is_default: { type: Boolean, default: false },
		is_active: { type: Boolean, default: true },
	},
	collectionOptions("shifts"),
);

applyBasePlugins(ShiftSchema, { collection: "shifts", paranoid: true });

const Shift = mongoose.models.Shift ?? mongoose.model("Shift", ShiftSchema);
export default Shift;
