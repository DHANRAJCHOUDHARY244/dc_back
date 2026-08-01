import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const PopupFormSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String },
    email: { type: String },
    mobile: { type: String },
    address: { type: String },
    product: { type: String },
    message: { type: String },
  },
  collectionOptions("popup_forms"),
);

applyBasePlugins(PopupFormSchema, { collection: "popup_forms", paranoid: true });

const PopupForm = mongoose.models.PopupForm ?? mongoose.model("PopupForm", PopupFormSchema);
export default PopupForm;
