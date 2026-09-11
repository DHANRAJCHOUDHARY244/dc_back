/**
 * Per-letter signatory fields for joining / offer / appointment letters.
 * Snake_case matches Mongo CRM settings; camelCase is the public company config.
 */

export const EMPLOYMENT_LETTER_KINDS = ["joining", "offer", "appointment"] as const;
export type EmploymentLetterKind = (typeof EMPLOYMENT_LETTER_KINDS)[number];

export const LETTER_SIGNATORY_ROLES = ["auth", "hr"] as const;
export type LetterSignatoryRole = (typeof LETTER_SIGNATORY_ROLES)[number];

export function letterSignatoryField(
	kind: EmploymentLetterKind,
	role: LetterSignatoryRole,
	part: "name" | "title" | "signature_url",
): string {
	return `${kind}_${role}_${part}`;
}

export function letterSignatoryAssetType(
	kind: EmploymentLetterKind,
	role: LetterSignatoryRole,
): `${EmploymentLetterKind}_${LetterSignatoryRole}_signature` {
	return `${kind}_${role}_signature`;
}

/** Empty defaults for all per-letter signatory snake_case fields. */
export function emptyLetterSignatorySettings(): Record<string, string> {
	const out: Record<string, string> = {};
	for (const kind of EMPLOYMENT_LETTER_KINDS) {
		for (const role of LETTER_SIGNATORY_ROLES) {
			out[letterSignatoryField(kind, role, "name")] = "";
			out[letterSignatoryField(kind, role, "title")] = "";
			out[letterSignatoryField(kind, role, "signature_url")] = "";
		}
	}
	return out;
}
