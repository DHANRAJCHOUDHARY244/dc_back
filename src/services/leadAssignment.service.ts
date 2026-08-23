import {
	employeeProfileRepository,
	leadRepository,
	roleRepository,
	userRepository,
} from "@repositories";
import { getLeadAccess } from "@services/leadAccess.service";
import { Roles } from "src/data/dataInserter";

export const SALES_PERSON_ROLES = [
	Roles.SALES_PERSON,
	Roles.SALES_EXECUTIVE,
	Roles.SENIOR_SALES_EXECUTIVE,
	Roles.BUSINESS_DEVELOPMENT_EXECUTIVE,
];

export const SALES_LEADER_ROLES = [Roles.SALES_LEADER];

export const SALES_TEAM_ROLES = [...SALES_PERSON_ROLES, ...SALES_LEADER_ROLES];

export type AssignableUser = {
	id: number;
	name: string;
	email?: string;
	role: string;
	kind: "team_leader" | "salesperson";
	team_leader_id?: number | null;
	designation?: string;
};

function kindForRole(role?: string): AssignableUser["kind"] {
	return SALES_LEADER_ROLES.includes(String(role)) ? "team_leader" : "salesperson";
}

export async function listUsersByRoles(roleNames: string[]): Promise<AssignableUser[]> {
	const roles: any[] = await roleRepository.find(
		{ name: { $in: roleNames } },
		{ select: "id name", lean: true },
	);
	if (!roles.length) return [];
	const roleById = new Map(roles.map((r) => [r.id, r.name]));
	const users: any[] = await userRepository.find(
		{ role_id: { $in: roles.map((r) => r.id) }, is_active: { $ne: false } },
		{ select: "id name email role_id", lean: true, limit: 400 },
	);
	const profiles: any[] = await employeeProfileRepository.find(
		{ user_id: { $in: users.map((u) => u.id) } },
		{ select: "user_id team_leader_id designation", lean: true },
	);
	const leaderByUser = new Map(profiles.map((p) => [Number(p.user_id), p.team_leader_id ?? null]));
	const designationByUser = new Map(profiles.map((p) => [Number(p.user_id), String(p.designation || "")]));
	return users
		.filter((u) => u.id != null)
		.map((u) => {
			const role = roleById.get(u.role_id) || "";
			return {
				id: Number(u.id),
				name: u.name || u.email || `User #${u.id}`,
				email: u.email,
				role,
				kind: kindForRole(role),
				team_leader_id: leaderByUser.get(Number(u.id)) ?? null,
				designation: designationByUser.get(Number(u.id)) || "",
			};
		});
}

export function isSalesTeamRole(role?: string | null) {
	return !!role && SALES_TEAM_ROLES.includes(role);
}

export async function resolveAssigneeTeamLeaderId(userId: number, role?: string | null) {
	if (role && SALES_LEADER_ROLES.includes(role)) return Number(userId);
	const profile: any = await employeeProfileRepository.findOne({ user_id: Number(userId) }, { lean: true });
	if (profile?.team_leader_id) return Number(profile.team_leader_id);
	const user: any = await userRepository.findOne({ id: Number(userId) }, { select: "id role_id", lean: true });
	if (!user) return null;
	const roleDoc: any = user.role_id
		? await roleRepository.findOne({ id: user.role_id }, { select: "name", lean: true })
		: null;
	if (roleDoc?.name && SALES_LEADER_ROLES.includes(roleDoc.name)) return Number(userId);
	return null;
}

export async function listAssignableSalesTeam(actor: { id?: number; role?: string; role_id?: number }) {
	const access = await getLeadAccess(actor);
	const selfId = Number(actor.id);
	const all = await listUsersByRoles(SALES_TEAM_ROLES);
	const leaders = all.filter((u) => u.kind === "team_leader");
	const salespeople = all.filter((u) => u.kind === "salesperson");

	if (access.is_admin) {
		return {
			can_assign: true,
			scope: "admin" as const,
			users: all.filter((u) => u.id !== selfId || all.length === 1),
		};
	}

	if (access.is_team_leader || SALES_LEADER_ROLES.includes(String(actor.role))) {
		const users = [...leaders.filter((u) => u.id !== selfId), ...salespeople.filter((u) => u.id !== selfId)];
		return { can_assign: true, scope: "team_leader" as const, users };
	}

	if (!isSalesTeamRole(actor.role) && !access.owner_ids?.includes(selfId)) {
		return { can_assign: false, scope: "none" as const, users: [] };
	}

	const profile: any = await employeeProfileRepository.findOne({ user_id: selfId }, { lean: true });
	const myLeaderId = profile?.team_leader_id ? Number(profile.team_leader_id) : null;
	const teammateIds = new Set<number>();
	if (myLeaderId) {
		const mates: any[] = await employeeProfileRepository.find(
			{ team_leader_id: myLeaderId },
			{ select: "user_id", lean: true },
		);
		for (const m of mates) {
			const id = Number(m.user_id);
			if (id && id !== selfId) teammateIds.add(id);
		}
	}

	const users = all.filter((u) => {
		if (u.id === selfId) return false;
		if (myLeaderId && u.id === myLeaderId) return true;
		if (u.kind === "salesperson" && (teammateIds.has(u.id) || !myLeaderId)) return true;
		if (u.kind === "salesperson") return true;
		return false;
	});

	return { can_assign: true, scope: "salesperson" as const, users };
}

export async function assertCanAssignLead(
	actor: { id?: number; role?: string; role_id?: number },
	lead: { owner_id?: number | null },
) {
	const access = await getLeadAccess(actor);
	const actorId = Number(actor.id);
	if (access.is_admin) return;
	if (access.is_team_leader) {
		if (!lead.owner_id) return;
		if (access.owner_ids?.includes(Number(lead.owner_id))) return;
		throw new Error("You can only assign leads owned by your team");
	}
	if (!lead.owner_id || Number(lead.owner_id) === actorId) return;
	throw new Error("You can only assign unassigned leads or leads you own");
}

export async function assertAssigneeAllowed(
	actor: { id?: number; role?: string; role_id?: number },
	toUserId: number,
) {
	const { users, can_assign } = await listAssignableSalesTeam(actor);
	if (!can_assign) throw new Error("You cannot assign leads");
	if (!users.some((u) => u.id === Number(toUserId))) {
		throw new Error("You can only assign to your team leader or sales team");
	}
}
