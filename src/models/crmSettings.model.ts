import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";
import { COMPANY_CONFIG } from "@config/company.config";

const CrmSettingsSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    company_name: { type: String, required: true, default: COMPANY_CONFIG.name },
    company_name_short: { type: String, default: COMPANY_CONFIG.nameShort },
    abn: { type: String, default: COMPANY_CONFIG.abn },
    arn_number: { type: String, default: COMPANY_CONFIG.arnNumber },
    mobile: { type: String, default: COMPANY_CONFIG.phoneNumber },
    phone: { type: String, default: COMPANY_CONFIG.phoneNumber },
    email: { type: String, default: COMPANY_CONFIG.email },
    support_email: { type: String, default: COMPANY_CONFIG.emailSupport },
    address: { type: String, default: COMPANY_CONFIG.address },
    /** Multiple company addresses — pick default / salary separately. */
    company_addresses: jsonArray,
    default_address_id: { type: String, default: "" },
    salary_address_id: { type: String, default: "" },
    salary_name: { type: String, default: "" },
    salary_title: { type: String, default: "" },
    salary_signature_url: { type: String, default: "" },
    logo_url: { type: String, default: COMPANY_CONFIG.companyLogoUrl },
    watermark_logo_url: { type: String, default: COMPANY_CONFIG.watermarkLogoUrl },
    favicon_url: { type: String, default: COMPANY_CONFIG.faviconUrl },
    quote_logo_url: { type: String, default: COMPANY_CONFIG.quoteLogoUrl },
    invoice_logo_url: { type: String, default: COMPANY_CONFIG.invoiceLogoUrl },
    company_signature_url: { type: String, default: COMPANY_CONFIG.companySignatureUrl },
    email_logo_url: { type: String, default: COMPANY_CONFIG.emailLogoUrl },
    director_name: { type: String, default: COMPANY_CONFIG.directorName },
    director_title: { type: String, default: COMPANY_CONFIG.directorTitle },
    hr_name: { type: String, default: COMPANY_CONFIG.hrName },
    hr_title: { type: String, default: COMPANY_CONFIG.hrTitle },
    hr_signature_url: { type: String, default: COMPANY_CONFIG.hrSignatureUrl },
    joining_auth_name: { type: String, default: "" },
    joining_auth_title: { type: String, default: "" },
    joining_auth_signature_url: { type: String, default: "" },
    joining_hr_name: { type: String, default: "" },
    joining_hr_title: { type: String, default: "" },
    joining_hr_signature_url: { type: String, default: "" },
    offer_auth_name: { type: String, default: "" },
    offer_auth_title: { type: String, default: "" },
    offer_auth_signature_url: { type: String, default: "" },
    offer_hr_name: { type: String, default: "" },
    offer_hr_title: { type: String, default: "" },
    offer_hr_signature_url: { type: String, default: "" },
    appointment_auth_name: { type: String, default: "" },
    appointment_auth_title: { type: String, default: "" },
    appointment_auth_signature_url: { type: String, default: "" },
    appointment_hr_name: { type: String, default: "" },
    appointment_hr_title: { type: String, default: "" },
    appointment_hr_signature_url: { type: String, default: "" },
    website: { type: String, default: COMPANY_CONFIG.website },
    website_display: { type: String, default: COMPANY_CONFIG.websiteDisplay },
    refer_friend_url: { type: String, default: COMPANY_CONFIG.referFriendEarnBonusPageUrl },
    contact_us_url: { type: String, default: COMPANY_CONFIG.contactUsPageUrl },
    /** Google Gemini / AI API key (server-side only — not exposed on public branding). */
    google_api_key: { type: String, default: "" },
    /** Google Maps / Places / Solar API key (used by maps UI and server solar proxy). */
    google_maps_api_key: { type: String, default: "" },
    metadata_fields: jsonArray,
  },
  collectionOptions("crm_settings"),
);

applyBasePlugins(CrmSettingsSchema, { collection: "crm_settings", paranoid: false });

const CrmSettings = mongoose.models.CrmSettings ?? mongoose.model("CrmSettings", CrmSettingsSchema);
export default CrmSettings;
