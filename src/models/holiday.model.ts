import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const HolidaySchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		name: { type: String, required: true },
		date: { type: Date, required: true, index: true },
		date_key: { type: String, required: true, index: true },
		is_optional: { type: Boolean, default: false },
		notes: { type: String, default: "" },
	},
	collectionOptions("holidays"),
);

applyBasePlugins(HolidaySchema, { collection: "holidays", paranoid: true });

const Holiday = mongoose.models.Holiday ?? mongoose.model("Holiday", HolidaySchema);
export default Holiday;
