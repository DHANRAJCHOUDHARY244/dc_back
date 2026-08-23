import {
	classifyLeadBucket,
	TERMINAL_LEAD_STATUSES,
} from "@constants/leadPipeline.constants";
import {
	employeeProfileRepository,
	leadRepository,
	roleRepository,
	userRepository,
} from "@repositories";
import { getLeadAccess } from "@services/leadAccess.service";
import {
	listUsersByRoles,
	SALES_LEADER_ROLES,
	SALES_TEAM_ROLES,
	type AssignableUser,
} from "@services/leadAssignment.service";

export type MemberLeadStats = {
	total_assigned: number;
	active: number;
	pending: number;
	converted: number;
	dead: number;
	cancelled: number;
	follow_up_due: number;
	transferred: number;
	total_sales: number;
	conversion_rate: number;
};

const emptyStats = (): MemberLeadStats => ({
	total_assigned: 0,
	active: 0,
	pending: 0,
	converted: 0,
	dead: 0,
	cancelled: 0,
	follow_up_due: 0,
	transferred: 0,
	total_sales: 0,
	conversion_rate: 0,
});

function roleLabel(role?: string, designation?: string) {
	if (designation) return designation;
	return String(role || "").replace(/_/g, " ") || "Sales";
}

async function userNameMap(ids: number[]) {
	const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
	if (!unique.length) return new Map<number, string>();
	const users: any[] = await userRepository.find(
		{ id: { $in: unique } },
		{ select: "id name email", lean: true },
	);
	return new Map(users.map((u) => [Number(u.id), u.name || u.email || `User #${u.id}`]));
}

export async function hydrateLeadOwnership(lead: any) {
	if (!lead) return lead;
	const ids = [
		lead.owner_id,
		lead.previous_owner_id,
		lead.team_leader_id,
		lead.created_by,
		...(Array.isArray(lead.transfers)
			? lead.transfers.flatMap((t: any) => [t.from_user_id, t.to_user_id, t.by])
			: []),
		...(Array.isArray(lead.audit_log) ? lead.audit_log.map((e: any) => e.by) : []),
		...(Array.isArray(lead.timeline) ? lead.timeline.map((e: any) => e.by) : []),
		...(Array.isArray(lead.notes) ? lead.notes.map((e: any) => e.by) : []),
		...(Array.isArray(lead.call_logs) ? lead.call_logs.map((e: any) => e.by) : []),
	]
		.map(Number)
		.filter(Boolean);
	const names = await userNameMap(ids);
	const transfers = (Array.isArray(lead.transfers) ? lead.transfers : []).map((t: any) => ({
		...t,
		from_user_name: t.from_user_name || names.get(Number(t.from_user_id)) || (t.from_user_id ? `User #${t.from_user_id}` : "Unassigned"),
		to_user_name: t.to_user_name || names.get(Number(t.to_user_id)) || (t.to_user_id ? `User #${t.to_user_id}` : "—"),
		by_name: t.by_name || names.get(Number(t.by)) || (t.by ? `User #${t.by}` : "System"),
	}));
	const withActorName = (list: any[]) =>
		list.map((e) => ({
			...e,
			by_name: e.by_name || names.get(Number(e.by)) || (e.by ? `User #${e.by}` : "System"),
		}));
	return {
		...lead,
		current_owner_id: lead.owner_id || null,
		current_owner_name: lead.owner?.name || names.get(Number(lead.owner_id)) || (lead.owner_id ? `User #${lead.owner_id}` : "Unassigned"),
		previous_owner_name:
			lead.previous_owner?.name || names.get(Number(lead.previous_owner_id)) || (lead.previous_owner_id ? `User #${lead.previous_owner_id}` : null),
		transfers,
		audit_log: withActorName(Array.isArray(lead.audit_log) ? lead.audit_log : []),
		timeline: withActorName(Array.isArray(lead.timeline) ? lead.timeline : []),
		notes: withActorName(Array.isArray(lead.notes) ? lead.notes : []),
		call_logs: withActorName(Array.isArray(lead.call_logs) ? lead.call_logs : []),
	};
}

function assertCanViewMember(access: Awaited<ReturnType<typeof getLeadAccess>>, memberId: number) {
	if (access.is_admin) return;
	if (access.owner_ids?.includes(Number(memberId))) return;
	throw new Error("You can only view sales people in your team");
}

async function loadExtraTeamLeaders(existing: AssignableUser[]) {
	const known = new Set(existing.map((u) => u.id));
	const leaderIds = [...new Set(existing.map((u) => Number(u.team_leader_id)).filter((id) => id && !known.has(id)))];
	if (!leaderIds.length) return [] as AssignableUser[];
	const users: any[] = await userRepository.find(
		{ id: { $in: leaderIds } },
		{ select: "id name email role_id", lean: true },
	);
	const roles: any[] = await roleRepository.find(
		{ id: { $in: users.map((u) => u.role_id).filter(Boolean) } },
		{ select: "id name", lean: true },
	);
	const roleById = new Map(roles.map((r) => [r.id, r.name]));
	const profiles: any[] = await employeeProfileRepository.find(
		{ user_id: { $in: leaderIds } },
		{ select: "user_id designation team_leader_id", lean: true },
	);
	const designationByUser = new Map(profiles.map((p) => [Number(p.user_id), String(p.designation || "")]));
	return users.map((u) => ({
		id: Number(u.id),
		name: u.name || u.email || `User #${u.id}`,
		email: u.email,
		role: roleById.get(u.role_id) || "SALES_LEADER",
		kind: "team_leader" as const,
		team_leader_id: null,
		designation: designationByUser.get(Number(u.id)) || "",
	}));
}

function tallyLead(stats: MemberLeadStats, lead: any, now: Date) {
	stats.total_assigned += 1;
	const bucket = classifyLeadBucket(lead.status);
	if (bucket === "converted") stats.converted += 1;
	else if (bucket === "dead") stats.dead += 1;
	else if (bucket === "cancelled") stats.cancelled += 1;
	else {
		stats.active += 1;
		if (bucket === "pending") stats.pending += 1;
	}
	if (
		lead.next_follow_up_at &&
		new Date(lead.next_follow_up_at) <= now &&
		!(TERMINAL_LEAD_STATUSES as readonly string[]).includes(String(lead.status || ""))
	) {
		stats.follow_up_due += 1;
	}
	if (bucket === "converted") stats.total_sales += Number(lead.estimated_sales_value) || 0;
}

function finalizeStats(stats: MemberLeadStats): MemberLeadStats {
	stats.conversion_rate = stats.total_assigned
		? Math.round((stats.converted / stats.total_assigned) * 1000) / 10
		: 0;
	stats.total_sales = Math.round(stats.total_sales);
	return stats;
}

export async function getSalesTeamRoster(actor: { id?: number; role?: string; role_id?: number }) {
	const access = await getLeadAccess(actor);
	const sales = await listUsersByRoles(SALES_TEAM_ROLES);
	const extras = await loadExtraTeamLeaders(sales);
	let members: AssignableUser[] = [...sales, ...extras];

	if (access.scope === "self") {
		members = members.filter((m) => m.id === Number(actor.id));
		if (!members.length && actor.id) {
			members = [
				{
					id: Number(actor.id),
					name: "You",
					role: String(actor.role || "SALES_PERSON"),
					kind: SALES_LEADER_ROLES.includes(String(actor.role)) ? "team_leader" : "salesperson",
					team_leader_id: null,
					designation: "",
				},
			];
		}
	} else if (access.scope === "team") {
		const allowed = new Set(access.owner_ids || []);
		members = members.filter((m) => allowed.has(m.id));
	}

	const memberIds = members.map((m) => m.id);
	const now = new Date();
	const owned: any[] = memberIds.length
		? await leadRepository.find(
				{ owner_id: { $in: memberIds }, merged_into_id: null },
				{ select: "id owner_id status next_follow_up_at estimated_sales_value transfers", lean: true },
			)
		: [];
	const transferredOut: any[] = memberIds.length
		? await leadRepository.find(
				{ "transfers.from_user_id": { $in: memberIds }, merged_into_id: null },
				{ select: "id transfers", lean: true },
			)
		: [];

	const statsByOwner = new Map<number, MemberLeadStats>();
	for (const id of memberIds) statsByOwner.set(id, emptyStats());
	for (const lead of owned) {
		const stats = statsByOwner.get(Number(lead.owner_id));
		if (stats) tallyLead(stats, lead, now);
	}
	for (const lead of transferredOut) {
		const seen = new Set<number>();
		for (const t of Array.isArray(lead.transfers) ? lead.transfers : []) {
			const from = Number(t.from_user_id);
			if (!from || seen.has(from)) continue;
			seen.add(from);
			const stats = statsByOwner.get(from);
			if (stats) stats.transferred += 1;
		}
	}

	const leaderNameById = new Map(members.map((m) => [m.id, m.name]));
	const mapped = members.map((m) => {
		const stats = finalizeStats(statsByOwner.get(m.id) || emptyStats());
		return {
			id: m.id,
			name: m.name,
			email: m.email,
			role: m.role,
			kind: m.kind,
			designation: roleLabel(m.role, m.designation),
			team_leader_id: m.team_leader_id || null,
			team_leader_name: m.team_leader_id ? leaderNameById.get(Number(m.team_leader_id)) || null : null,
			...stats,
		};
	});

	const team_leaders = mapped
		.filter((m) => m.kind === "team_leader")
		.sort((a, b) => a.name.localeCompare(b.name));
	const salespeople = mapped
		.filter((m) => m.kind === "salesperson")
		.sort((a, b) => a.name.localeCompare(b.name));

	return {
		is_admin: access.is_admin,
		is_team_leader: access.is_team_leader,
		can_open_profiles: access.is_admin || access.is_team_leader,
		scope: access.scope,
		team_leaders,
		salespeople,
		members: mapped,
	};
}

export async function getMemberLeadDashboard(
	actor: { id?: number; role?: string; role_id?: number },
	memberId: number,
) {
	const access = await getLeadAccess(actor);
	assertCanViewMember(access, memberId);

	const roster = await getSalesTeamRoster(actor);
	const member = roster.members.find((m) => m.id === Number(memberId));
	if (!member) throw new Error("Sales team member not found");

	const team_members = roster.salespeople.filter((m) => Number(m.team_leader_id) === Number(memberId));

	return {
		member,
		stats: {
			total_assigned: member.total_assigned,
			active: member.active,
			pending: member.pending,
			follow_up_due: member.follow_up_due,
			converted: member.converted,
			dead: member.dead,
			cancelled: member.cancelled,
			transferred: member.transferred,
			total_sales: member.total_sales,
			conversion_rate: member.conversion_rate,
		},
		team_members,
		can_open_profiles: roster.can_open_profiles,
	};
}

export async function getUserDisplayMap(ids: number[]) {
	return userNameMap(ids);
}
