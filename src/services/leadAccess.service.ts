import { employeeProfileRepository } from "@repositories";
import { hasAdminPermission } from "@services/adminPermission.service";
import { Roles } from "src/data/dataInserter";

const ADMIN_ROLES = new Set([
	Roles.SUPER_ADMIN,
	Roles.ADMIN,
	Roles.CEO,
	Roles.CUSTOMER_SUPPORT_EXECUTIVE,
]);

const TEAM_LEADER_ROLES = new Set([Roles.MANAGER, Roles.OPERATIONS_MANAGER, Roles.SALES_LEADER]);

export type LeadAccess = {
	scope: "admin" | "team" | "self";
	is_admin: boolean;
	is_team_leader: boolean;
	owner_ids: number[] | null;
};

export function isLeadAdminRole(role?: string | null) {
	return !!role && ADMIN_ROLES.has(role);
}

export function isLeadTeamLeaderRole(role?: string | null) {
	return !!role && TEAM_LEADER_ROLES.has(role);
}

export async function getLeadAccess(user: { id?: number; role?: string; role_id?: number }): Promise<LeadAccess> {
	const role = String(user?.role || "");
	const flaggedAdmin = await hasAdminPermission(user, ["Leads"]).catch(() => false);
	if (isLeadAdminRole(role) || flaggedAdmin) {
		return { scope: "admin", is_admin: true, is_team_leader: true, owner_ids: null };
	}

	const reports: any[] = user?.id
		? await employeeProfileRepository.find({ team_leader_id: user.id }, { select: "user_id", lean: true })
		: [];
	const teamIds = reports.map((r) => Number(r.user_id)).filter(Boolean);
	if (isLeadTeamLeaderRole(role) || teamIds.length) {
		return {
			scope: "team",
			is_admin: false,
			is_team_leader: true,
			owner_ids: [...new Set([Number(user.id), ...teamIds])],
		};
	}

	return {
		scope: "self",
		is_admin: false,
		is_team_leader: false,
		owner_ids: [Number(user.id)],
	};
}

export function applyLeadScope(filter: Record<string, unknown>, access: LeadAccess) {
	if (access.scope === "admin") return filter;
	if (access.owner_ids?.length === 1) {
		filter.owner_id = access.owner_ids[0];
		return filter;
	}
	filter.owner_id = { $in: access.owner_ids || [] };
	return filter;
}
