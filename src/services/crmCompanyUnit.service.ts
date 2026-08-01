import { DEFAULT_CRM_COMPANY_UNITS } from "@config/crmCompanyUnit.seed";
import { crmCompanyUnitRepository } from "@repositories";
import { pickPublicCompanyConfig } from "@services/crmSettings.service";

export async function ensureDefaultCrmCompanyUnits() {
	const count = await crmCompanyUnitRepository.count({});
	if (count > 0) return;
	for (const row of DEFAULT_CRM_COMPANY_UNITS) {
		await crmCompanyUnitRepository.create({ ...row, is_active: true });
	}
}

export function mapUnitToPublicBranding(unit: Record<string, unknown>) {
	const base = pickPublicCompanyConfig({
		company_name: unit.company_name,
		company_name_short: unit.trading_name || unit.company_name,
		abn: unit.abn,
		mobile: unit.mobile,
		phone: unit.phone,
		email: unit.email,
		support_email: unit.support_email || unit.email,
		address: unit.business_address,
		logo_url: unit.logo_url,
		watermark_logo_url: unit.watermark_logo_url,
		favicon_url: unit.favicon_url,
		quote_logo_url: unit.quote_logo_url,
		invoice_logo_url: unit.invoice_logo_url,
		company_signature_url: unit.company_signature_url,
		email_logo_url: unit.email_logo_url,
		website: unit.website,
	});

	return {
		...base,
		company_unit_id: unit.id,
		state_code: unit.state_code,
		trading_name: unit.trading_name,
		acn: unit.acn,
		postal_address: unit.postal_address,
		accounts_email: unit.accounts_email,
		sales_email: unit.sales_email,
		director_name: unit.director_name,
		bank_bsb: unit.bank_bsb,
		bank_account_number: unit.bank_account_number,
		bank_swift: unit.bank_swift,
		payment_terms: unit.payment_terms,
		gst_registered: unit.gst_registered,
		invoice_prefix: unit.invoice_prefix,
		quote_prefix: unit.quote_prefix,
		job_prefix: unit.job_prefix,
		receipt_prefix: unit.receipt_prefix,
		proposal_prefix: unit.proposal_prefix,
		google_review_link: unit.google_review_link,
		state_config: unit.state_config ?? {},
	};
}

export async function getCompanyUnitById(id: number) {
	await ensureDefaultCrmCompanyUnits();
	return crmCompanyUnitRepository.findById(id, { lean: true });
}

export async function listActiveCompanyUnits() {
	await ensureDefaultCrmCompanyUnits();
	return crmCompanyUnitRepository.find({ is_active: true }, { sort: { sort_order: 1, id: 1 }, lean: true });
}
