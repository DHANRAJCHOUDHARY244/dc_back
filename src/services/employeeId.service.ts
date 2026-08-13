/**
 * Employee ID display format — cosmetic label only.
 * System identity is always `users.id` / `employee_profiles.user_id`.
 * Example: user_id 25 → display "SE-0025"
 */
const PREFIX = "SE";
const PAD = 4;

/** Display label from CRM user id (show purpose only) */
export function displayEmployeeCode(userId: number): string {
	return `${PREFIX}-${String(userId).padStart(PAD, "0")}`;
}

/** Parse display code back to user id when it matches SE-XXXX pattern */
export function userIdFromEmployeeCode(code: string): number | null {
	const m = String(code || "").trim().match(/^SE-(\d+)$/i);
	return m ? Number(m[1]) : null;
}

export function isDisplayEmployeeCode(code: string, userId: number): boolean {
	return String(code || "").trim().toUpperCase() === displayEmployeeCode(userId).toUpperCase();
}

/** Ensure profile has the correct display code for its user_id */
export function resolveEmployeeCode(userId: number, existingCode?: string | null): string {
	const expected = displayEmployeeCode(userId);
	const code = String(existingCode || "").trim();
	if (!code || code.startsWith("EMP-") || !isDisplayEmployeeCode(code, userId)) {
		return expected;
	}
	return code;
}

/** Backfill display codes for all profiles (EMP-* → SE-{user_id}) */
export async function syncAllEmployeeDisplayCodes(): Promise<{ updated: number; total: number }> {
	const { employeeProfileRepository } = await import("@repositories");
	const profiles: any[] = await employeeProfileRepository.find({}, { lean: true });
	let updated = 0;
	for (const p of profiles) {
		const expected = displayEmployeeCode(p.user_id);
		if (String(p.employee_code || "").trim() !== expected) {
			await employeeProfileRepository.updateById(p.id, { $set: { employee_code: expected } });
			updated += 1;
		}
	}
	return { updated, total: profiles.length };
}
