import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const ContactFormSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String },
    email: { type: String },
    mobile: { type: String },
    address: { type: String },
    postcode: { type: String },
    suburb: { type: String },
    select_property_type: { type: String },
    installation_date: { type: Date },
    interested_in: jsonArray,
    message: { type: String },
    heard_about_us: jsonArray,
    consent: { type: String, default: "YES" },
    signature_link: { type: String },
  },
  collectionOptions("contact_forms"),
);

applyBasePlugins(ContactFormSchema, { collection: "contact_forms", paranoid: true });

const ContactForm = mongoose.models.ContactForm ?? mongoose.model("ContactForm", ContactFormSchema);
export default ContactForm;
