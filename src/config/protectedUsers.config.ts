/** Built-in owner account — always seeded, verified, and cannot be removed. */
export const PROTECTED_SUPER_ADMIN_EMAIL = "choudharydhanraj239@gmail.com";

export const PROTECTED_SUPER_ADMIN_NAME = "Dhanraj Choudhary";

export const PROTECTED_SUPER_ADMIN_USERNAME = "choudharydhanraj239";

export function isProtectedSuperAdminEmail(email?: string | null): boolean {
  return (
    String(email || "")
      .trim()
      .toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase()
  );
}
