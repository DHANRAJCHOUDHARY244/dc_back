import {
	leadAgentRepository,
	leadDistributionSettingsRepository,
	leadRepository,
	leadServiceAreaRepository,
	roleRepository,
	userRepository,
} from "@repositories";
import { Roles } from "src/data/dataInserter";
import { dispatchNotification } from "@services/notificationHandler.service";
import { resolveAssigneeTeamLeaderId } from "@services/leadAssignment.service";
import { pushAudit } from "@services/leadAudit.service";

const DEFAULT_SETTINGS = {
	enabled: true,
	mode: "ai_smart",
	auto_reassign: false,
	notify_only: true,
	max_leads_per_agent: 20,
	response_time_minutes: 30,
	follow_up_l1_hours: 2,
	follow_up_l2_hours: 6,
	follow_up_l3_hours: 24,
};

export async function getDistributionSettings() {
	let row: any = await leadDistributionSettingsRepository.findOne({}, { lean: true, sort: { id: 1 } });
	if (!row) {
		row = await leadDistributionSettingsRepository.create({ ...DEFAULT_SETTINGS });
	}
	return row;
}

export async function saveDistributionSettings(patch: Record<string, unknown>) {
	const current = await getDistributionSettings();
	await leadDistributionSettingsRepository.updateById(current.id, { $set: patch });
	return getDistributionSettings();
}

const SALES_ROLES = [
	Roles.SALES_PERSON,
	Roles.SALES_LEADER,
	Roles.SALES_EXECUTIVE,
	Roles.SENIOR_SALES_EXECUTIVE,
	Roles.BUSINESS_DEVELOPMENT_EXECUTIVE,
];

export async function listSalesUsers() {
	const roles: any[] = await roleRepository.find(
		{ name: { $in: SALES_ROLES } },
		{ select: "id name", lean: true },
	);
	const roleIds = roles.map((r) => r.id).filter(Boolean);
	if (!roleIds.length) return [];
	return userRepository.find(
		{ role_id: { $in: roleIds } },
		{ select: "id name email mobile_no role_id", lean: true, limit: 300 },
	);
}

function withinWorkingHours(agent: any) {
	const start = String(agent?.working_hours_start || "09:00");
	const end = String(agent?.working_hours_end || "17:30");
	const now = new Date();
	const hh = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	return hh >= start && hh <= end;
}

export async function findServiceAreaForLead(lead: {
	state?: string;
	suburb?: string;
	postcode?: string;
	address?: string;
}) {
	const areas: any[] = await leadServiceAreaRepository.find({ active: { $ne: false } }, { lean: true });
	const state = String(lead.state || "").toUpperCase();
	const suburb = String(lead.suburb || "").toLowerCase();
	const postcode = String(lead.postcode || "");
	const address = String(lead.address || "").toLowerCase();

	return (
		areas.find((a) => {
			const states = (a.states || []).map((s: string) => String(s).toUpperCase());
			const suburbs = (a.suburbs || []).map((s: string) => String(s).toLowerCase());
			const postcodes = (a.postcodes || []).map(String);
			if (postcode && postcodes.includes(postcode)) return true;
			if (suburb && suburbs.includes(suburb)) return true;
			if (state && states.includes(state)) return true;
			if (suburb && address.includes(suburb) && suburbs.length) return true;
			return false;
		}) || null
	);
}

export async function pickBestAgent(lead: any) {
	const settings = await getDistributionSettings();
	if (!settings.enabled || settings.mode === "manual") return null;

	const users: any[] = await listSalesUsers();
	if (!users.length) return null;

	const agents: any[] = await leadAgentRepository.find(
		{ user_id: { $in: users.map((u) => u.id) } },
		{ lean: true },
	);
	const agentByUser = Object.fromEntries(agents.map((a) => [a.user_id, a]));
	const area = await findServiceAreaForLead(lead);

	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const counts: any[] = await leadRepository.find(
		{ owner_id: { $in: users.map((u) => u.id) } },
		{ select: "id owner_id status assigned_at next_follow_up_at", lean: true },
	);

	const byOwner: Record<number, { active: number; today: number; followups: number }> = {};
	for (const u of users) byOwner[u.id] = { active: 0, today: 0, followups: 0 };
	for (const l of counts) {
		if (!l.owner_id || !byOwner[l.owner_id]) continue;
		if (!["LOST", "CANCELLED", "DUPLICATE", "COMPLETED", "WON"].includes(l.status)) {
			byOwner[l.owner_id].active += 1;
		}
		if (l.assigned_at && new Date(l.assigned_at) >= todayStart) byOwner[l.owner_id].today += 1;
		if (l.next_follow_up_at) byOwner[l.owner_id].followups += 1;
	}

	const blocked = new Set(["Do Not Assign Leads", "On Leave", "Offline", "Temporarily Unavailable"]);
	const interests: string[] = Array.isArray(lead.interested_in) ? lead.interested_in : [];

	const eligible = users.filter((u) => {
		const agent = agentByUser[u.id];
		if (agent?.do_not_assign) return false;
		if (agent && blocked.has(agent.availability)) return false;
		if (agent && !withinWorkingHours(agent)) return false;
		const capDaily = agent?.max_daily_leads ?? settings.max_leads_per_agent ?? 20;
		const capActive = agent?.max_active_leads ?? 40;
		const capFu = agent?.max_follow_ups ?? 25;
		const stats = byOwner[u.id];
		if (stats.today >= capDaily) return false;
		if (stats.active >= capActive) return false;
		if (stats.followups >= capFu) return false;
		if (settings.mode === "area" && area?.salesperson_ids?.length) {
			return area.salesperson_ids.map(Number).includes(u.id);
		}
		if (settings.mode === "product" && agent?.product_expertise?.length && interests.length) {
			return interests.some((i) => agent.product_expertise.includes(i));
		}
		return true;
	});

	if (!eligible.length) return null;

	const scored = eligible.map((u) => {
		const agent = agentByUser[u.id];
		const stats = byOwner[u.id];
		let rank = 1000 - stats.active * 10 - stats.today * 8;
		if (area?.salesperson_ids?.map(Number).includes(u.id)) rank += 40;
		if (agent?.product_expertise?.length && interests.some((i) => agent.product_expertise.includes(i))) rank += 20;
		if (agent?.service_states?.map((s: string) => String(s).toUpperCase()).includes(String(lead.state || "").toUpperCase())) {
			rank += 15;
		}
		if (agent?.availability === "Available") rank += 10;
		if (agent?.availability === "Limited Capacity") rank -= 20;
		return { user: u, agent, stats, rank };
	});

	scored.sort((a, b) => b.rank - a.rank || a.stats.active - b.stats.active || a.stats.today - b.stats.today);
	const winner = scored[0];
	const teamLeaderId =
		(await resolveAssigneeTeamLeaderId(winner.user.id)) || area?.team_leader_id || null;
	return {
		user_id: winner.user.id,
		team_leader_id: teamLeaderId,
		area_name: area?.name || null,
		reason: `Lowest workload among ${eligible.length} eligible agents (${winner.stats.active} active, ${winner.stats.today} today)`,
	};
}

export async function autoAssignLead(lead: any, actorId?: number | null) {
	const pick = await pickBestAgent(lead);
	if (!pick) return { assigned: false, lead };
	const now = new Date();
	const assignee: any = await userRepository.findOne({ id: pick.user_id }, { select: "id name", lean: true });
	const toName = assignee?.name || `User #${pick.user_id}`;
	await leadRepository.updateMany(
		{ id: lead.id },
		{
			$set: {
				previous_owner_id: lead.owner_id || null,
				owner_id: pick.user_id,
				team_leader_id: pick.team_leader_id || lead.team_leader_id || null,
				assigned_at: now,
				status: ["NEW_LEAD", "AI_QUALIFIED"].includes(lead.status) ? "ASSIGNED" : lead.status,
				timeline: [
					...(Array.isArray(lead.timeline) ? lead.timeline : []),
					{
						type: "assign",
						title: `Assigned to ${toName}`,
						detail: `AI distribution assigned this lead to ${toName}. ${pick.reason}${pick.area_name ? ` · ${pick.area_name}` : ""}`,
						at: now,
						by: actorId ?? null,
						to_user_id: pick.user_id,
					},
				],
				audit_log: pushAudit(lead.audit_log, {
					type: "assign",
					title: "Lead assigned",
					detail: `AI distribution assigned this lead to ${toName}. ${pick.reason}${pick.area_name ? ` · ${pick.area_name}` : ""}`,
					by: actorId ?? null,
					changes: [
						{ field: "owner_id", label: "Current owner", from: lead.owner_id || "Unassigned", to: toName },
						{
							field: "status",
							label: "Status",
							from: lead.status,
							to: ["NEW_LEAD", "AI_QUALIFIED"].includes(lead.status) ? "ASSIGNED" : lead.status,
						},
					],
				}),
			},
		},
	);
	await dispatchNotification({
			userId: pick.user_id,
			message: `New lead ${lead.public_id || `#${lead.id}`} (${lead.name}) assigned to you.`,
			route: `${process.env.FRONT_URL}/#/leads`,
			meta: { type: "LEAD_ASSIGNED", lead_id: lead.id },
		})
		.catch(() => undefined);
	const updated = await leadRepository.findOne({ id: lead.id }, { lean: true });
	return { assigned: true, lead: updated, pick };
}
