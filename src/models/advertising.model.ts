import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const AdvertisingSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone_number: { type: String },
    region: { type: String },
    state: { type: String },
    post_code: { type: String },
    locality: { type: String },
    mail_sent: { type: Boolean, default: false },
  },
  collectionOptions("advertisings"),
);

applyBasePlugins(AdvertisingSchema, { collection: "advertisings", paranoid: false });

const Advertising = mongoose.models.Advertising ?? mongoose.model("Advertising", AdvertisingSchema);
export default Advertising;
