export type CompanyAddressEntry = {
	id: string;
	label: string;
	address: string;
};

export function newAddressId(): string {
	return `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeCompanyAddresses(raw: unknown): CompanyAddressEntry[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((row: any, i: number) => ({
			id: String(row?.id || `addr-${i}`).trim() || `addr-${i}`,
			label: String(row?.label || "").trim() || `Address ${i + 1}`,
			address: String(row?.address || "").trim(),
		}))
		.filter((a) => a.address);
}

/** Resolve address text from list + preferred id, with fallbacks. */
export function resolveAddressText(
	addresses: CompanyAddressEntry[],
	preferredId: string | undefined | null,
	fallbackAddress = "",
): string {
	if (preferredId) {
		const hit = addresses.find((a) => a.id === preferredId);
		if (hit?.address) return hit.address;
	}
	if (addresses[0]?.address) return addresses[0].address;
	return String(fallbackAddress || "").trim();
}

/** Seed list from legacy single `address` when empty. */
export function ensureAddressBook(
	addresses: CompanyAddressEntry[],
	legacyAddress: string,
	defaultId?: string,
): { addresses: CompanyAddressEntry[]; defaultAddressId: string } {
	let list = addresses.length ? addresses : [];
	if (!list.length && legacyAddress.trim()) {
		const id = newAddressId();
		list = [{ id, label: "Primary", address: legacyAddress.trim() }];
		return { addresses: list, defaultAddressId: id };
	}
	const defaultAddressId =
		(defaultId && list.some((a) => a.id === defaultId) ? defaultId : list[0]?.id) || "";
	return { addresses: list, defaultAddressId };
}
