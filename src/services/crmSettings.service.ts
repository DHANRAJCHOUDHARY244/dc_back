import { getDefaultCrmSettings } from "@config/company.config";
import { crmSettingsRepository } from "@repositories";

/** Normalized company config used across backend templates and API responses */
export type CompanyConfigSnapshot = {
  name: string;
  nameShort: string;
  abn: string;
  abnRaw: string;
  arnNumber: string;
  email: string;
  emailSupport: string;
  website: string;
  websiteDisplay: string;
  address: string;
  phoneNumber: string;
  mobile: string;
  phone: string;
  companyLogoUrl: string;
  watermarkLogoUrl: string;
  faviconUrl: string;
  quoteLogoUrl: string;
  invoiceLogoUrl: string;
  companySignatureUrl: string;
  emailLogoUrl: string;
  referFriendEarnBonusPageUrl: string;
  contactUsPageUrl: string;
};

let cachedSettings: any = null;

export function clearCrmSettingsCache() {
  cachedSettings = null;
}

export function mapSettingsToCompanyConfig(settings: any): CompanyConfigSnapshot {
  const mobile = settings?.mobile || settings?.phone || "";
  return {
    name: settings?.company_name || "DC CRM Pty Ltd",
    nameShort: settings?.company_name_short || settings?.company_name || "DC CRM",
    abn: settings?.abn || "",
    abnRaw: settings?.arn_number || settings?.abn?.replace(/\s/g, "") || "",
    arnNumber: settings?.arn_number || "",
    email: settings?.email || "",
    emailSupport: settings?.support_email || settings?.email || "",
    website: settings?.website || "",
    websiteDisplay: settings?.website_display || settings?.website || "",
    address: settings?.address || "",
    phoneNumber: mobile,
    mobile: settings?.mobile || "",
    phone: settings?.phone || "",
    companyLogoUrl: settings?.logo_url || "",
    watermarkLogoUrl: settings?.watermark_logo_url || "",
    faviconUrl: settings?.favicon_url || "",
    quoteLogoUrl: settings?.quote_logo_url || "",
    invoiceLogoUrl: settings?.invoice_logo_url || "",
    companySignatureUrl: settings?.company_signature_url || "",
    emailLogoUrl: settings?.email_logo_url || "",
    referFriendEarnBonusPageUrl: settings?.refer_friend_url || "",
    contactUsPageUrl: settings?.contact_us_url || "",
  };
}

export async function getOrCreateSettings() {
  if (cachedSettings) return cachedSettings;

  let settings = await crmSettingsRepository.findOne({}, { sort: { id: 1 } });
  if (!settings) {
    settings = await crmSettingsRepository.create(getDefaultCrmSettings());
  }
  cachedSettings = settings;
  return settings;
}

export async function getCompanyConfig(): Promise<CompanyConfigSnapshot> {
  const settings = await getOrCreateSettings();
  return mapSettingsToCompanyConfig(settings);
}

export function getDefaultCompanyConfig(): CompanyConfigSnapshot {
  return mapSettingsToCompanyConfig(getDefaultCrmSettings());
}

/** Public API payload: camelCase + snake_case aliases for frontend and legacy clients */
export function pickPublicCompanyConfig(settings: any) {
  const cfg = mapSettingsToCompanyConfig(settings);
  return {
    ...cfg,
    company_name: cfg.name,
    company_name_short: cfg.nameShort,
    abn: cfg.abn,
    arn_number: cfg.arnNumber,
    mobile: cfg.mobile,
    phone: cfg.phone,
    email: cfg.email,
    support_email: cfg.emailSupport,
    address: cfg.address,
    logo_url: cfg.companyLogoUrl,
    favicon_url: cfg.faviconUrl,
    watermark_logo_url: cfg.watermarkLogoUrl,
    quote_logo_url: cfg.quoteLogoUrl,
    invoice_logo_url: cfg.invoiceLogoUrl,
    company_signature_url: cfg.companySignatureUrl,
    email_logo_url: cfg.emailLogoUrl,
    website: cfg.website,
    website_display: cfg.websiteDisplay,
    refer_friend_url: cfg.referFriendEarnBonusPageUrl,
    contact_us_url: cfg.contactUsPageUrl,
  };
}
