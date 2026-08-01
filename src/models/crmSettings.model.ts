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
    logo_url: { type: String, default: COMPANY_CONFIG.companyLogoUrl },
    watermark_logo_url: { type: String, default: COMPANY_CONFIG.watermarkLogoUrl },
    favicon_url: { type: String, default: COMPANY_CONFIG.faviconUrl },
    quote_logo_url: { type: String, default: COMPANY_CONFIG.quoteLogoUrl },
    invoice_logo_url: { type: String, default: COMPANY_CONFIG.invoiceLogoUrl },
    company_signature_url: { type: String, default: COMPANY_CONFIG.companySignatureUrl },
    email_logo_url: { type: String, default: COMPANY_CONFIG.emailLogoUrl },
    website: { type: String, default: COMPANY_CONFIG.website },
    website_display: { type: String, default: COMPANY_CONFIG.websiteDisplay },
    refer_friend_url: { type: String, default: COMPANY_CONFIG.referFriendEarnBonusPageUrl },
    contact_us_url: { type: String, default: COMPANY_CONFIG.contactUsPageUrl },
    metadata_fields: jsonArray,
  },
  collectionOptions("crm_settings"),
);

applyBasePlugins(CrmSettingsSchema, { collection: "crm_settings", paranoid: false });

const CrmSettings = mongoose.models.CrmSettings ?? mongoose.model("CrmSettings", CrmSettingsSchema);
export default CrmSettings;
