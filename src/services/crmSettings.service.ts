import { getDefaultCrmSettings } from "@config/company.config";
import {
  ensureAddressBook,
  normalizeCompanyAddresses,
  resolveAddressText,
  type CompanyAddressEntry,
} from "@config/companyAddresses.config";
import { crmSettingsRepository } from "@repositories";
import { cacheDel, cacheGetJson, cacheSetJson } from "@services/redisCache.service";

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
  companyAddresses: CompanyAddressEntry[];
  defaultAddressId: string;
  salaryAddressId: string;
  salaryAddress: string;
  letterAddressId: string;
  letterAddress: string;
  joiningAddressId: string;
  joiningAddress: string;
  offerAddressId: string;
  offerAddress: string;
  appointmentAddressId: string;
  appointmentAddress: string;
  salaryName: string;
  salaryTitle: string;
  salarySignatureUrl: string;
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
  directorName: string;
  directorTitle: string;
  hrName: string;
  hrTitle: string;
  hrSignatureUrl: string;
  joiningAuthName: string;
  joiningAuthTitle: string;
  joiningAuthSignatureUrl: string;
  joiningHrName: string;
  joiningHrTitle: string;
  joiningHrSignatureUrl: string;
  offerAuthName: string;
  offerAuthTitle: string;
  offerAuthSignatureUrl: string;
  offerHrName: string;
  offerHrTitle: string;
  offerHrSignatureUrl: string;
  appointmentAuthName: string;
  appointmentAuthTitle: string;
  appointmentAuthSignatureUrl: string;
  appointmentHrName: string;
  appointmentHrTitle: string;
  appointmentHrSignatureUrl: string;
  referFriendEarnBonusPageUrl: string;
  contactUsPageUrl: string;
  googleMapsApiKey: string;
};

const CRM_SETTINGS_KEY = "crm:settings";
const CRM_SETTINGS_TTL = 10 * 60;

let cachedSettings: any = null;

export async function clearCrmSettingsCache() {
  cachedSettings = null;
  // Await Redis delete so the next read cannot race and rehydrate stale data.
  await cacheDel(CRM_SETTINGS_KEY);
}

export function mapSettingsToCompanyConfig(settings: any): CompanyConfigSnapshot {
  const mobile = settings?.mobile || settings?.phone || "";
  const book = ensureAddressBook(
    normalizeCompanyAddresses(settings?.company_addresses),
    String(settings?.address || ""),
    String(settings?.default_address_id || ""),
  );
  const pickAddressId = (raw: unknown) => {
    const id = String(raw || "").trim();
    return id && book.addresses.some((a) => a.id === id) ? id : book.defaultAddressId;
  };
  const salaryAddressId = pickAddressId(settings?.salary_address_id);
  const letterAddressId = pickAddressId(settings?.letter_address_id);
  const joiningAddressId = pickAddressId(settings?.joining_address_id || settings?.letter_address_id);
  const offerAddressId = pickAddressId(settings?.offer_address_id || settings?.letter_address_id);
  const appointmentAddressId = pickAddressId(settings?.appointment_address_id || settings?.letter_address_id);
  const address = resolveAddressText(book.addresses, book.defaultAddressId, settings?.address || "");
  const salaryAddress = resolveAddressText(book.addresses, salaryAddressId, address);
  const letterAddress = resolveAddressText(book.addresses, letterAddressId, address);
  const joiningAddress = resolveAddressText(book.addresses, joiningAddressId, letterAddress);
  const offerAddress = resolveAddressText(book.addresses, offerAddressId, letterAddress);
  const appointmentAddress = resolveAddressText(book.addresses, appointmentAddressId, letterAddress);

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
    address,
    companyAddresses: book.addresses,
    defaultAddressId: book.defaultAddressId,
    salaryAddressId,
    salaryAddress,
    letterAddressId,
    letterAddress,
    joiningAddressId,
    joiningAddress,
    offerAddressId,
    offerAddress,
    appointmentAddressId,
    appointmentAddress,
    salaryName: settings?.salary_name || "",
    salaryTitle: settings?.salary_title || "",
    salarySignatureUrl: settings?.salary_signature_url || "",
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
    directorName: settings?.director_name || "",
    directorTitle: settings?.director_title || "Director",
    hrName: settings?.hr_name || "",
    hrTitle: settings?.hr_title || "HR Manager",
    hrSignatureUrl: settings?.hr_signature_url || "",
    joiningAuthName: settings?.joining_auth_name || "",
    joiningAuthTitle: settings?.joining_auth_title || "",
    joiningAuthSignatureUrl: settings?.joining_auth_signature_url || "",
    joiningHrName: settings?.joining_hr_name || "",
    joiningHrTitle: settings?.joining_hr_title || "",
    joiningHrSignatureUrl: settings?.joining_hr_signature_url || "",
    offerAuthName: settings?.offer_auth_name || "",
    offerAuthTitle: settings?.offer_auth_title || "",
    offerAuthSignatureUrl: settings?.offer_auth_signature_url || "",
    offerHrName: settings?.offer_hr_name || "",
    offerHrTitle: settings?.offer_hr_title || "",
    offerHrSignatureUrl: settings?.offer_hr_signature_url || "",
    appointmentAuthName: settings?.appointment_auth_name || "",
    appointmentAuthTitle: settings?.appointment_auth_title || "",
    appointmentAuthSignatureUrl: settings?.appointment_auth_signature_url || "",
    appointmentHrName: settings?.appointment_hr_name || "",
    appointmentHrTitle: settings?.appointment_hr_title || "",
    appointmentHrSignatureUrl: settings?.appointment_hr_signature_url || "",
    referFriendEarnBonusPageUrl: settings?.refer_friend_url || "",
    contactUsPageUrl: settings?.contact_us_url || "",
    googleMapsApiKey: settings?.google_maps_api_key || "",
  };
}

export async function getOrCreateSettings() {
  // Redis is the shared source of truth across workers/instances.
  // Never return process memory if Redis was flushed — that caused stale CRM branding after settings update.
  const fromRedis = await cacheGetJson<any>(CRM_SETTINGS_KEY);
  if (fromRedis) {
    cachedSettings = fromRedis;
    return fromRedis;
  }

  // Redis miss (or Redis down): drop local memory and reload from DB.
  cachedSettings = null;

  let settings = await crmSettingsRepository.findOne({}, { sort: { id: 1 } });
  if (!settings) {
    settings = await crmSettingsRepository.create(getDefaultCrmSettings());
  }
  // Persist a plain object so Redis JSON round-trips cleanly.
  const plain =
    settings && typeof (settings as any).toObject === "function"
      ? (settings as any).toObject()
      : settings;
  cachedSettings = plain;
  await cacheSetJson(CRM_SETTINGS_KEY, plain, CRM_SETTINGS_TTL);
  return plain;
}

export async function getCompanyConfig(): Promise<CompanyConfigSnapshot> {
  const settings = await getOrCreateSettings();
  return mapSettingsToCompanyConfig(settings);
}

/** Google Gemini key — CRM settings first, then legacy env fallback. */
export async function getGoogleApiKeyFromSettings(): Promise<string> {
  const settings = await getOrCreateSettings();
  return String(settings?.google_api_key || "").trim() || process.env.GOOGLE_API_KEY?.trim() || "";
}

/** Google Maps / Solar key — CRM settings first, then legacy env fallback. */
export async function getGoogleMapsApiKeyFromSettings(): Promise<string> {
  const settings = await getOrCreateSettings();
  return (
    String(settings?.google_maps_api_key || "").trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
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
    company_addresses: cfg.companyAddresses,
    default_address_id: cfg.defaultAddressId,
    salary_address_id: cfg.salaryAddressId,
    letter_address_id: cfg.letterAddressId,
    joining_address_id: cfg.joiningAddressId,
    offer_address_id: cfg.offerAddressId,
    appointment_address_id: cfg.appointmentAddressId,
    companyAddresses: cfg.companyAddresses,
    defaultAddressId: cfg.defaultAddressId,
    salaryAddressId: cfg.salaryAddressId,
    salaryAddress: cfg.salaryAddress,
    letterAddressId: cfg.letterAddressId,
    letterAddress: cfg.letterAddress,
    joiningAddressId: cfg.joiningAddressId,
    joiningAddress: cfg.joiningAddress,
    offerAddressId: cfg.offerAddressId,
    offerAddress: cfg.offerAddress,
    appointmentAddressId: cfg.appointmentAddressId,
    appointmentAddress: cfg.appointmentAddress,
    salary_name: cfg.salaryName,
    salary_title: cfg.salaryTitle,
    salary_signature_url: cfg.salarySignatureUrl,
    salaryName: cfg.salaryName,
    salaryTitle: cfg.salaryTitle,
    salarySignatureUrl: cfg.salarySignatureUrl,
    logo_url: cfg.companyLogoUrl,
    favicon_url: cfg.faviconUrl,
    watermark_logo_url: cfg.watermarkLogoUrl,
    quote_logo_url: cfg.quoteLogoUrl,
    invoice_logo_url: cfg.invoiceLogoUrl,
    company_signature_url: cfg.companySignatureUrl,
    email_logo_url: cfg.emailLogoUrl,
    director_name: cfg.directorName,
    director_title: cfg.directorTitle,
    directorName: cfg.directorName,
    directorTitle: cfg.directorTitle,
    hr_name: cfg.hrName,
    hr_title: cfg.hrTitle,
    hr_signature_url: cfg.hrSignatureUrl,
    hrName: cfg.hrName,
    hrTitle: cfg.hrTitle,
    hrSignatureUrl: cfg.hrSignatureUrl,
    joining_auth_name: cfg.joiningAuthName,
    joining_auth_title: cfg.joiningAuthTitle,
    joining_auth_signature_url: cfg.joiningAuthSignatureUrl,
    joining_hr_name: cfg.joiningHrName,
    joining_hr_title: cfg.joiningHrTitle,
    joining_hr_signature_url: cfg.joiningHrSignatureUrl,
    offer_auth_name: cfg.offerAuthName,
    offer_auth_title: cfg.offerAuthTitle,
    offer_auth_signature_url: cfg.offerAuthSignatureUrl,
    offer_hr_name: cfg.offerHrName,
    offer_hr_title: cfg.offerHrTitle,
    offer_hr_signature_url: cfg.offerHrSignatureUrl,
    appointment_auth_name: cfg.appointmentAuthName,
    appointment_auth_title: cfg.appointmentAuthTitle,
    appointment_auth_signature_url: cfg.appointmentAuthSignatureUrl,
    appointment_hr_name: cfg.appointmentHrName,
    appointment_hr_title: cfg.appointmentHrTitle,
    appointment_hr_signature_url: cfg.appointmentHrSignatureUrl,
    joiningAuthName: cfg.joiningAuthName,
    joiningAuthTitle: cfg.joiningAuthTitle,
    joiningAuthSignatureUrl: cfg.joiningAuthSignatureUrl,
    joiningHrName: cfg.joiningHrName,
    joiningHrTitle: cfg.joiningHrTitle,
    joiningHrSignatureUrl: cfg.joiningHrSignatureUrl,
    offerAuthName: cfg.offerAuthName,
    offerAuthTitle: cfg.offerAuthTitle,
    offerAuthSignatureUrl: cfg.offerAuthSignatureUrl,
    offerHrName: cfg.offerHrName,
    offerHrTitle: cfg.offerHrTitle,
    offerHrSignatureUrl: cfg.offerHrSignatureUrl,
    appointmentAuthName: cfg.appointmentAuthName,
    appointmentAuthTitle: cfg.appointmentAuthTitle,
    appointmentAuthSignatureUrl: cfg.appointmentAuthSignatureUrl,
    appointmentHrName: cfg.appointmentHrName,
    appointmentHrTitle: cfg.appointmentHrTitle,
    appointmentHrSignatureUrl: cfg.appointmentHrSignatureUrl,
    website: cfg.website,
    website_display: cfg.websiteDisplay,
    refer_friend_url: cfg.referFriendEarnBonusPageUrl,
    contact_us_url: cfg.contactUsPageUrl,
    google_maps_api_key: cfg.googleMapsApiKey,
    googleMapsApiKey: cfg.googleMapsApiKey,
  };
}
