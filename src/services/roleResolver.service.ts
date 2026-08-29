import { roleRepository } from "@repositories";
import { Roles } from "src/data/dataInserter";

/** Map enum key → stored name, or pass through DB role name as-is. */
export function normalizeRoleName(role: unknown): string {
	if (role == null || role === "") return "";
	const raw = String(role).trim();
	if (!raw) return "";
	const fromEnum = Roles[raw as keyof typeof Roles];
	return fromEnum ?? raw;
}

function escapeRegex(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve a role document from enum key, role name, or numeric role id. */
export async function resolveRoleDocFromInput(roleInput: unknown) {
	const name = normalizeRoleName(roleInput);
	if (!name) return null;

	const byName = await roleRepository.findOne(
		{ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") } },
		{ select: "id name", lean: true },
	);
	if (byName) return byName;

	const num = Number(roleInput);
	if (!Number.isNaN(num) && num > 0) {
		return roleRepository.findOne({ id: num }, { select: "id name", lean: true });
	}

	return null;
}

export async function resolveRoleIdFromInput(roleInput: unknown): Promise<number> {
	const doc: any = await resolveRoleDocFromInput(roleInput);
	if (!doc?.id) throw new Error("INVALID_ROLE");
	return doc.id;
}
