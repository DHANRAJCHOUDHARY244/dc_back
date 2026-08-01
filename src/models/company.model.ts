import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const CompanySchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    company_name: { type: String, required: true, unique: true },
    company_address: { type: String, required: true },
    company_contact_email: jsonArray,
    company_contact_number: jsonArray,
  },
  collectionOptions("companies"),
);

applyBasePlugins(CompanySchema, { collection: "companies", paranoid: true });

const Company = mongoose.models.Company ?? mongoose.model("Company", CompanySchema);
export default Company;
