import { permissionRepository, roleRepository, userPermissionRepository } from "@repositories";
import { Roles } from "src/data/dataInserter";

/** SUPER_ADMIN always; otherwise the role must have is_admin on one of the named permissions. */
export async function hasAdminPermission(
	user: { role?: string; role_id?: number } | undefined,
	permissionNames: string[],
): Promise<boolean> {
	if (!user?.role) return false;
	if (user.role === Roles.SUPER_ADMIN) return true;
	if (!permissionNames.length) return false;

	let roleId = user.role_id;
	if (roleId == null) {
		const role = await roleRepository.findOne({ name: user.role }, { select: "id", lean: true });
		roleId = (role as any)?.id;
	}
	if (roleId == null) return false;

	const perms = await permissionRepository.find(
		{ name: { $in: permissionNames } },
		{ select: "id", lean: true },
	);
	const ids = (perms as any[]).map((p) => p.id).filter((id) => id != null);
	if (!ids.length) return false;

	const hit = await userPermissionRepository.findOne(
		{
			role_id: roleId,
			permission_id: { $in: ids },
			is_admin: true,
		},
		{ select: "id", lean: true },
	);
	return !!hit;
}

export async function isQuoteAdmin(user: { role?: string; role_id?: number } | undefined) {
	if (user?.role === Roles.CUSTOMER_SUPPORT_EXECUTIVE) return true;
	return hasAdminPermission(user, ["quotient"]);
}
