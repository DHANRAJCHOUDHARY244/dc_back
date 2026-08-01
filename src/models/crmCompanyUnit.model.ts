import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonObject } from "@db/plugins";

const CrmCompanyUnitSchema = new Schema(
	{
		id: { type: Number, unique: true, index: true },
		company_name: { type: String, required: true },
		trading_name: { type: String, default: "" },
		abn: { type: String, default: "" },
		acn: { type: String, default: "" },
		business_address: { type: String, default: "" },
		postal_address: { type: String, default: "" },
		state_code: { type: String, required: true, index: true },
		phone: { type: String, default: "" },
		mobile: { type: String, default: "" },
		email: { type: String, default: "" },
		website: { type: String, default: "" },
		logo_url: { type: String, default: "" },
		seal_url: { type: String, default: "" },
		company_signature_url: { type: String, default: "" },
		watermark_logo_url: { type: String, default: "" },
		quote_logo_url: { type: String, default: "" },
		invoice_logo_url: { type: String, default: "" },
		email_logo_url: { type: String, default: "" },
		favicon_url: { type: String, default: "" },
		director_name: { type: String, default: "" },
		accounts_email: { type: String, default: "" },
		support_email: { type: String, default: "" },
		sales_email: { type: String, default: "" },
		bank_bsb: { type: String, default: "" },
		bank_account_number: { type: String, default: "" },
		bank_swift: { type: String, default: "" },
		payment_terms: { type: String, default: "" },
		gst_registered: { type: Boolean, default: true },
		invoice_prefix: { type: String, default: "INV" },
		quote_prefix: { type: String, default: "QT" },
		job_prefix: { type: String, default: "JOB" },
		receipt_prefix: { type: String, default: "RCP" },
		proposal_prefix: { type: String, default: "PROP" },
		google_review_link: { type: String, default: "" },
		business_hours: { type: String, default: "" },
		social_links: jsonObject,
		state_config: jsonObject,
		is_active: { type: Boolean, default: true },
		sort_order: { type: Number, default: 0 },
	},
	collectionOptions("crm_company_units"),
);

applyBasePlugins(CrmCompanyUnitSchema, { collection: "crm_company_units", paranoid: true });

const CrmCompanyUnit =
	mongoose.models.CrmCompanyUnit ?? mongoose.model("CrmCompanyUnit", CrmCompanyUnitSchema);
export default CrmCompanyUnit;
