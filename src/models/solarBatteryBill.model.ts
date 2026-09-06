import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

/** Saved electricity bill copies for Solar Battery Analytics reuse. */
const SolarBatteryBillSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    original_name: { type: String, default: "" },
    stored_name: { type: String, required: true },
    /** Public path e.g. /uploads/solar-battery-analytics/12/file.pdf */
    file_path: { type: String, required: true },
    mime_type: { type: String, default: "" },
    size_bytes: { type: Number, default: 0 },
    /** Last AI-extracted inputs snapshot */
    inputs: { type: Schema.Types.Mixed, default: null },
    extracted: { type: Schema.Types.Mixed, default: null },
    customer_name: { type: String, default: "" },
    nmi: { type: String, default: "" },
    retailer: { type: String, default: "" },
  },
  collectionOptions("solar_battery_bills"),
);

applyBasePlugins(SolarBatteryBillSchema, { collection: "solar_battery_bills", paranoid: true });

const SolarBatteryBill =
  mongoose.models.SolarBatteryBill ?? mongoose.model("SolarBatteryBill", SolarBatteryBillSchema);
export default SolarBatteryBill;
