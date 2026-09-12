/**
 * Default company / CRM configuration.
 * Used as fallback across the app and when seeding the first `crm_settings` row.
 * Admins can override everything via Management → CRM Settings.
 */

import type { CrmMetadataField } from "../types/crmSettings.types";
import { emptyLetterSignatorySettings } from "./letterSignatories.config";
import { ensureAddressBook } from "./companyAddresses.config";

export const COMPANY_CONFIG = {
	name: "DC CRM Pty Ltd",
	nameShort: "DC CRM",
	abn: "12 345 678 901",
	abnRaw: "12345678901",
	arnNumber: "ARN-000000",
	email: "info@dccrm.example.com",
	emailSupport: "support@dccrm.example.com",
	website: "https://www.dccrm.example.com",
	websiteDisplay: "www.dccrm.example.com",
	address: "123 Demo Street, Melbourne VIC 3000, Australia",
	phoneNumber: "+61400000000",
	companyLogoUrl: "",
	watermarkLogoUrl: "",
	faviconUrl: "",
	quoteLogoUrl: "",
	invoiceLogoUrl: "",
	companySignatureUrl: "",
	emailLogoUrl: "",
	/** Authorised signatory on salary slips, letters and contracts. */
	directorName: "",
	directorTitle: "Director",
	/** HR signatory for joining / offer / Letter Studio (falls back to director). */
	hrName: "",
	hrTitle: "HR Manager",
	hrSignatureUrl: "",
	/** Per-letter overrides (joining / offer / appointment). Empty → fall back to director / HR. */
	joiningAuthName: "",
	joiningAuthTitle: "",
	joiningAuthSignatureUrl: "",
	joiningHrName: "",
	joiningHrTitle: "",
	joiningHrSignatureUrl: "",
	offerAuthName: "",
	offerAuthTitle: "",
	offerAuthSignatureUrl: "",
	offerHrName: "",
	offerHrTitle: "",
	offerHrSignatureUrl: "",
	appointmentAuthName: "",
	appointmentAuthTitle: "",
	appointmentAuthSignatureUrl: "",
	appointmentHrName: "",
	appointmentHrTitle: "",
	appointmentHrSignatureUrl: "",
	referFriendEarnBonusPageUrl: "https://www.dccrm.example.com/refer",
	contactUsPageUrl: "https://www.dccrm.example.com/contact",
} as const;

export const DEFAULT_CRM_METADATA: CrmMetadataField[] = [
	{
		id: "refer-friend",
		key: "refer_friend_url",
		label: "Refer a Friend URL",
		value: COMPANY_CONFIG.referFriendEarnBonusPageUrl,
		type: "url",
		sort_order: 0,
		visible: true,
	},
	{
		id: "contact-us",
		key: "contact_us_url",
		label: "Contact Us Page URL",
		value: COMPANY_CONFIG.contactUsPageUrl,
		type: "url",
		sort_order: 1,
		visible: true,
	},
];

/** Payload used when no `crm_settings` document exists yet. */
export function getDefaultCrmSettings() {
	const seeded = ensureAddressBook([], COMPANY_CONFIG.address, "");
	return {
		company_name: COMPANY_CONFIG.name,
		company_name_short: COMPANY_CONFIG.nameShort,
		abn: COMPANY_CONFIG.abn,
		arn_number: COMPANY_CONFIG.arnNumber,
		mobile: COMPANY_CONFIG.phoneNumber,
		phone: COMPANY_CONFIG.phoneNumber,
		email: COMPANY_CONFIG.email,
		support_email: COMPANY_CONFIG.emailSupport,
		address: seeded.addresses[0]?.address || COMPANY_CONFIG.address,
		company_addresses: seeded.addresses,
		default_address_id: seeded.defaultAddressId,
		salary_address_id: seeded.defaultAddressId,
		letter_address_id: seeded.defaultAddressId,
		joining_address_id: seeded.defaultAddressId,
		offer_address_id: seeded.defaultAddressId,
		appointment_address_id: seeded.defaultAddressId,
		salary_name: "",
		salary_title: "",
		salary_signature_url: "",
		logo_url: COMPANY_CONFIG.companyLogoUrl,
		watermark_logo_url: COMPANY_CONFIG.watermarkLogoUrl,
		favicon_url: COMPANY_CONFIG.faviconUrl,
		quote_logo_url: COMPANY_CONFIG.quoteLogoUrl,
		invoice_logo_url: COMPANY_CONFIG.invoiceLogoUrl,
		company_signature_url: COMPANY_CONFIG.companySignatureUrl,
		email_logo_url: COMPANY_CONFIG.emailLogoUrl,
		director_name: COMPANY_CONFIG.directorName,
		director_title: COMPANY_CONFIG.directorTitle,
		hr_name: COMPANY_CONFIG.hrName,
		hr_title: COMPANY_CONFIG.hrTitle,
		hr_signature_url: COMPANY_CONFIG.hrSignatureUrl,
		...emptyLetterSignatorySettings(),
		website: COMPANY_CONFIG.website,
		website_display: COMPANY_CONFIG.websiteDisplay,
		refer_friend_url: COMPANY_CONFIG.referFriendEarnBonusPageUrl,
		contact_us_url: COMPANY_CONFIG.contactUsPageUrl,
		google_api_key: "",
		google_maps_api_key: "",
		metadata_fields: DEFAULT_CRM_METADATA,
	};
}
