import {
	DEFAULT_ESCALATION_RULES,
	DEFAULT_TASK_TYPES,
	MASTER_TASK_MANAGER_ROLES,
	MasterTaskStatus,
	TASK_DONE_STATUSES,
	TASK_OPEN_STATUSES,
	TaskPriority,
} from "@constants/masterTask.constants";
import { getNextSequence } from "@db/counter.model";
import {
	crmFollowUpRepository,
	employeeProfileRepository,
	escalationRuleRepository,
	taskRepository,
	taskTypeCatalogRepository,
	userRepository,
} from "@repositories";
import notificationController from "@controllers/notification.controller";
import { notifyMasterTaskBadgeChanged } from "@services/badgeNotify.service";
import logger from "@utils/pino";

let seedPromise: Promise<void> | null = null;

export function canManageMasterTasks(role?: string | null) {
	return !!role && MASTER_TASK_MANAGER_ROLES.has(String(role).toUpperCase());
}

export async function ensureMasterTaskSeeds() {
	if (!seedPromise) {
		seedPromise = (async () => {
			for (const t of DEFAULT_TASK_TYPES) {
				const ex = await taskTypeCatalogRepository.findOne({ code: t.code }, { lean: true });
				if (!ex) await taskTypeCatalogRepository.create({ ...t, active: true });
			}
			for (const r of DEFAULT_ESCALATION_RULES) {
				const ex = await escalationRuleRepository.findOne({ task_type: r.task_type }, { lean: true });
				if (!ex) {
					await escalationRuleRepository.create({
						...r,
						label: r.task_type === "*" ? "Default" : r.task_type,
						active: true,
					});
				}
			}
		})().catch((e) => {
			seedPromise = null;
			throw e;
		});
	}
	await seedPromise;
}

export async function nextTaskCode() {
	const year = new Date().getFullYear();
	const seq = await getNextSequence(`task_code_${year}`);
	return `TASK-SE-${year}-${String(seq).padStart(6, "0")}`;
}

export async function nextFollowUpCode() {
	const year = new Date().getFullYear();
	const seq = await getNextSequence(`follow_up_code_${year}`);
	return `FU-SE-${year}-${String(seq).padStart(6, "0")}`;
}

async function enrichAssignee(userId: number) {
	const user: any = await userRepository.findOne({ id: userId }, { lean: true, select: "id name email role" });
	const profile: any = await employeeProfileRepository
		.findOne({ user_id: userId }, { lean: true })
		.catch(() => null);
	return {
		user,
		employee_code: profile?.employee_code || (userId ? `SE-${String(userId).padStart(4, "0")}` : ""),
		department: profile?.department || "",
		team: profile?.team || "",
		team_leader_id: profile?.team_leader_id || null,
	};
}

export async function createMasterTask(input: Record<string, any>, actorId: number) {
	await ensureMasterTaskSeeds();
	const type = String(input.type || "OTHER").toUpperCase();
	const catalog: any = await taskTypeCatalogRepository.findOne({ code: type }, { lean: true });
	const assigneeId = Number(input.user_id);
	if (!assigneeId) throw new Error("user_id (assignee) is required");

	const enrich = await enrichAssignee(assigneeId);
	const title = String(input.title || input.name || "Untitled task").trim();
	const description = String(input.description || input.instruction || "").trim();
	const task_code = await nextTaskCode();

	const task = await taskRepository.create({
		task_code,
		type,
		category: catalog?.category || input.category || "General",
		priority: input.priority || TaskPriority.NORMAL,
		user_id: assigneeId,
		owner_id: input.owner_id != null ? Number(input.owner_id) : assigneeId,
		assigned_by: actorId,
		manager_id: input.manager_id != null ? Number(input.manager_id) : enrich.team_leader_id,
		created_by: actorId,
		lead_id: input.lead_id != null ? Number(input.lead_id) : null,
		quote_id: input.quote_id != null ? Number(input.quote_id) : null,
		customer_id: input.customer_id != null ? Number(input.customer_id) : null,
		customer_name: input.customer_name || "",
		employee_code: enrich.employee_code,
		department: input.department || enrich.department,
		team: input.team || enrich.team,
		name: title,
		title,
		instruction: description,
		description,
		status: input.status || MasterTaskStatus.PENDING,
		due_date: input.due_date ? new Date(input.due_date) : null,
		start_date: input.start_date ? new Date(input.start_date) : new Date(),
		due_time: input.due_time || "",
		start_time: input.start_time || "",
		reminder_minutes: input.reminder_minutes != null ? Number(input.reminder_minutes) : null,
		recurrence: input.recurrence || "NONE",
		checklist: Array.isArray(input.checklist) ? input.checklist : [],
		comments: [],
		attachments: Array.isArray(input.attachments) ? input.attachments : [],
		related_record: input.related_record || null,
		is_follow_up: !!input.is_follow_up,
		progress: [
			{
				type: "CREATED",
				message: "Task created",
				updated_by: actorId,
				updated_at: new Date(),
			},
		],
		escalation_history: [],
	});

	await notificationController
		.createNotification({
			userId: assigneeId,
			message: `New task ${task_code}: ${title}`,
			route: "master-tasks",
			meta: { type: "TASK", taskId: (task as any).id, task_code, priority: input.priority },
		})
		.catch(() => undefined);

	notifyMasterTaskBadgeChanged();
	return task;
}

export async function listMasterTasks(filters: Record<string, any>, viewer: { id: number; role?: string }) {
	await ensureMasterTaskSeeds();
	const page = Number(filters.page || 1);
	const limit = Number(filters.limit || 20);
	const view = String(filters.view || "my").toLowerCase();
	const isMgr = canManageMasterTasks(viewer.role);

	const filter: Record<string, any> = {};

	if (filters.status) {
		if (filters.status === "OPEN") filter.status = { $in: TASK_OPEN_STATUSES };
		else if (filters.status === "COMPLETED_GROUP") filter.status = { $in: TASK_DONE_STATUSES };
		else filter.status = filters.status;
	}
	if (filters.type) filter.type = String(filters.type).toUpperCase();
	if (filters.priority) filter.priority = String(filters.priority).toUpperCase();
	if (filters.category) filter.category = filters.category;
	if (filters.quote_id) filter.quote_id = Number(filters.quote_id);
	if (filters.lead_id) filter.lead_id = Number(filters.lead_id);
	if (filters.customer_id) filter.customer_id = Number(filters.customer_id);
	if (filters.is_follow_up === true || filters.is_follow_up === "true") filter.is_follow_up = true;
	if (filters.escalated === true || filters.escalated === "true") {
		filter.escalation_level = { $gte: 1 };
	}
	if (filters.q) {
		const q = String(filters.q).trim();
		filter.$or = [
			{ title: { $regex: q, $options: "i" } },
			{ name: { $regex: q, $options: "i" } },
			{ task_code: { $regex: q, $options: "i" } },
			{ customer_name: { $regex: q, $options: "i" } },
		];
	}

	if (view === "my") {
		filter.user_id = viewer.id;
	} else if (view === "assigned_by_me") {
		filter.assigned_by = viewer.id;
	} else if (view === "team" || view === "all") {
		if (!isMgr) {
			filter.$or = [{ user_id: viewer.id }, { created_by: viewer.id }, { assigned_by: viewer.id }];
		}
	} else if (view === "overdue") {
		filter.status = { $in: TASK_OPEN_STATUSES };
		filter.due_date = { $lt: new Date() };
		if (!isMgr) filter.user_id = viewer.id;
	} else if (view === "high_priority") {
		filter.priority = { $in: [TaskPriority.HIGH, TaskPriority.URGENT, TaskPriority.CRITICAL] };
		filter.status = { $in: TASK_OPEN_STATUSES };
		if (!isMgr) filter.user_id = viewer.id;
	} else if (view === "escalated") {
		filter.escalation_level = { $gte: 1 };
		if (!isMgr) filter.user_id = viewer.id;
	} else if (view === "recurring") {
		filter.recurrence = { $ne: "NONE" };
		if (!isMgr) filter.user_id = viewer.id;
	} else if (view === "follow_ups") {
		filter.is_follow_up = true;
		if (!isMgr) filter.user_id = viewer.id;
	} else if (view === "pending") {
		filter.status = MasterTaskStatus.PENDING;
		if (!isMgr) filter.user_id = viewer.id;
	} else if (view === "in_progress") {
		filter.status = MasterTaskStatus.IN_PROGRESS;
		if (!isMgr) filter.user_id = viewer.id;
	} else if (view === "completed") {
		filter.status = { $in: TASK_DONE_STATUSES };
		if (!isMgr) filter.user_id = viewer.id;
	}

	const sortField = filters.order_by || "due_date";
	const sortDir = filters.order_direction === "ASC" ? 1 : -1;

	const { count, rows } = await taskRepository.findPaginated(filter, {
		page,
		limit,
		sort: { [sortField]: sortDir, created_at: -1 } as any,
		lean: true,
		populate: [
			{ path: "user", select: "id name email" },
			{ path: "creator", select: "id name" },
			{ path: "lead" },
		],
	});

	const now = Date.now();
	const data = (rows as any[]).map((t) => {
		const raw = t?.toObject?.({ virtuals: true }) ?? t;
		const due = raw.due_date ? new Date(raw.due_date).getTime() : null;
		const overdue = due != null && due < now && TASK_OPEN_STATUSES.includes(raw.status);
		const id = raw.id;
		return {
			...raw,
			id,
			task_code: raw.task_code || (id != null ? `TASK#${id}` : null),
			is_overdue: overdue,
			countdown_ms: due != null ? due - now : null,
			display_title: raw.title || raw.name,
		};
	});

	return {
		currentPage: page,
		totalPages: Math.ceil(count / limit) || 1,
		limit,
		totalTasks: count,
		data,
	};
}

export async function getTaskSummary(viewer: { id: number; role?: string }) {
	const isMgr = canManageMasterTasks(viewer.role);
	const base: any = isMgr ? {} : { user_id: viewer.id };
	const now = new Date();
	const startToday = new Date(now);
	startToday.setHours(0, 0, 0, 0);
	const endToday = new Date(now);
	endToday.setHours(23, 59, 59, 999);
	const endTomorrow = new Date(endToday);
	endTomorrow.setDate(endTomorrow.getDate() + 1);

	const [total, pending, inProgress, completed, overdue, escalated, dueToday, dueTomorrow] =
		await Promise.all([
			taskRepository.count({ ...base, status: { $in: TASK_OPEN_STATUSES } }),
			taskRepository.count({ ...base, status: MasterTaskStatus.PENDING }),
			taskRepository.count({ ...base, status: MasterTaskStatus.IN_PROGRESS }),
			taskRepository.count({ ...base, status: { $in: TASK_DONE_STATUSES } }),
			taskRepository.count({
				...base,
				status: { $in: TASK_OPEN_STATUSES },
				due_date: { $lt: now },
			}),
			taskRepository.count({ ...base, escalation_level: { $gte: 1 } }),
			taskRepository.count({
				...base,
				status: { $in: TASK_OPEN_STATUSES },
				due_date: { $gte: startToday, $lte: endToday },
			}),
			taskRepository.count({
				...base,
				status: { $in: TASK_OPEN_STATUSES },
				due_date: { $gt: endToday, $lte: endTomorrow },
			}),
		]);

	return {
		total_open: total,
		pending,
		in_progress: inProgress,
		completed,
		overdue,
		escalated,
		due_today: dueToday,
		due_tomorrow: dueTomorrow,
	};
}

function hoursPastDue(due: Date) {
	return Math.max(0, (Date.now() - due.getTime()) / 3600000);
}

async function getRuleForType(taskType: string) {
	await ensureMasterTaskSeeds();
	let rule: any = await escalationRuleRepository.findOne(
		{ task_type: taskType, active: true },
		{ lean: true },
	);
	if (!rule) {
		rule = await escalationRuleRepository.findOne({ task_type: "*", active: true }, { lean: true });
	}
	return rule;
}

async function notifyUser(userId: number | null | undefined, message: string, meta: any) {
	if (!userId) return;
	await notificationController
		.createNotification({
			userId: Number(userId),
			message,
			route: "master-tasks",
			meta,
		})
		.catch(() => undefined);
}

export async function evaluateTaskEscalations() {
	await ensureMasterTaskSeeds();
	const now = new Date();
	const open = (await taskRepository.find(
		{
			status: { $in: TASK_OPEN_STATUSES },
			due_date: { $ne: null, $lt: now },
		},
		{ lean: true },
	)) as any[];

	let updated = 0;
	for (const task of open) {
		const due = new Date(task.due_date);
		const hours = hoursPastDue(due);
		const rule = await getRuleForType(task.type);
		if (!rule) continue;

		let nextLevel = Number(task.escalation_level || 0);
		const history = [...(task.escalation_history || [])];
		const patch: Record<string, unknown> = {};

		if (task.status !== MasterTaskStatus.OVERDUE && task.status !== MasterTaskStatus.ESCALATED) {
			patch.status = MasterTaskStatus.OVERDUE;
		}

		const tryEscalate = async (level: number, threshold: number, label: string) => {
			if (hours < threshold || nextLevel >= level) return;
			nextLevel = level;
			history.push({
				level,
				label,
				at: new Date(),
				hours_overdue: Number(hours.toFixed(1)),
			});
			patch.escalation_level = level;
			patch.status = MasterTaskStatus.ESCALATED;
			patch.escalation_history = history;

			await notifyUser(
				task.user_id,
				`ESCALATION L${level}: ${task.task_code || task.id} — ${task.title || task.name}`,
				{ type: "TASK_ESCALATION", taskId: task.id, level },
			);
			if (level >= 1) {
				await notifyUser(
					task.manager_id,
					`Team escalation L${level}: ${task.task_code || task.id}`,
					{ type: "TASK_ESCALATION", taskId: task.id, level },
				);
			}
			if (level >= 2) {
				const managers = (await userRepository.find(
					{ role: { $in: Array.from(MASTER_TASK_MANAGER_ROLES) } },
					{ lean: true, select: "id" },
				)) as any[];
				for (const m of managers.slice(0, 10)) {
					await notifyUser(m.id, `Management escalation L${level}: ${task.task_code || task.id}`, {
						type: "TASK_ESCALATION",
						taskId: task.id,
						level,
					});
				}
			}
		};

		await tryEscalate(1, Number(rule.escalate_l1_hours), "Team Leader");
		await tryEscalate(2, Number(rule.escalate_l2_hours), "Operations/Manager");
		await tryEscalate(3, Number(rule.escalate_l3_hours), "Senior Management");

		if (Object.keys(patch).length) {
			const progress = [
				...(task.progress || []),
				{
					type: "ESCALATED",
					message: `Escalation level ${nextLevel} (${hours.toFixed(1)}h overdue)`,
					updated_by: null,
					updated_at: new Date(),
				},
			];
			patch.progress = progress;
			await taskRepository.updateMany({ id: task.id }, { $set: patch });
			updated += 1;
		}
	}

	// Reminders
	const upcoming = (await taskRepository.find(
		{
			status: { $in: TASK_OPEN_STATUSES },
			reminder_minutes: { $ne: null },
			reminder_sent: { $ne: true },
			due_date: { $ne: null },
		},
		{ lean: true },
	)) as any[];

	for (const task of upcoming) {
		const due = new Date(task.due_date).getTime();
		const remindAt = due - Number(task.reminder_minutes) * 60000;
		if (Date.now() >= remindAt && Date.now() < due) {
			await notifyUser(
				task.user_id,
				`Reminder: ${task.task_code || task.id} due soon — ${task.title || task.name}`,
				{ type: "TASK_REMINDER", taskId: task.id },
			);
			await taskRepository.updateMany({ id: task.id }, { $set: { reminder_sent: true } });
		}
	}

	if (updated > 0) notifyMasterTaskBadgeChanged();
	return { scanned: open.length, updated };
}

export async function markMissedFollowUps() {
	const now = new Date();
	const due = (await crmFollowUpRepository.find(
		{ status: "SCHEDULED", follow_up_at: { $lt: now } },
		{ lean: true },
	)) as any[];

	let n = 0;
	for (const fu of due) {
		await crmFollowUpRepository.updateMany(
			{ id: fu.id },
			{
				$set: {
					status: "MISSED",
					missed_at: now,
					history: [
						...(fu.history || []),
						{ type: "MISSED", at: now },
					],
				},
			},
		);
		await notifyUser(
			fu.user_id,
			`Missed follow-up: ${fu.customer_name || fu.follow_up_code || fu.id}`,
			{ type: "FOLLOW_UP_MISSED", follow_up_id: fu.id },
		);
		n += 1;
	}
	return { missed: n };
}

export async function createFollowUp(input: Record<string, any>, actorId: number) {
	const userId = Number(input.user_id || actorId);
	const enrich = await enrichAssignee(userId);
	const code = await nextFollowUpCode();
	const follow_up_at = new Date(input.follow_up_at);
	if (Number.isNaN(follow_up_at.getTime())) throw new Error("Invalid follow_up_at");

	const fu = await crmFollowUpRepository.create({
		follow_up_code: code,
		customer_id: input.customer_id != null ? Number(input.customer_id) : null,
		customer_name: input.customer_name || "",
		quote_id: input.quote_id != null ? Number(input.quote_id) : null,
		lead_id: input.lead_id != null ? Number(input.lead_id) : null,
		user_id: userId,
		employee_code: enrich.employee_code,
		follow_up_at,
		follow_up_type: input.follow_up_type || "GENERAL",
		notes: input.notes || "",
		status: "SCHEDULED",
		created_by: actorId,
		history: [{ type: "CREATED", at: new Date(), by: actorId }],
	});

	// Mirror as task for Master Task Centre
	const task = await createMasterTask(
		{
			type: "FOLLOW_UP",
			user_id: userId,
			title: `Follow-up: ${input.customer_name || code}`,
			description: input.notes || "",
			due_date: follow_up_at,
			priority: TaskPriority.HIGH,
			quote_id: input.quote_id,
			lead_id: input.lead_id,
			customer_id: input.customer_id,
			customer_name: input.customer_name,
			is_follow_up: true,
			reminder_minutes: 60,
		},
		actorId,
	);

	await crmFollowUpRepository.updateMany(
		{ id: (fu as any).id },
		{ $set: { task_id: (task as any).id } },
	);

	return { follow_up: fu, task };
}

export async function completeFollowUp(
	id: number,
	payload: { outcome: string; notes?: string; create_next?: boolean; next_follow_up_at?: string },
	actorId: number,
) {
	const fu: any = await crmFollowUpRepository.findOne({ id }, { lean: true });
	if (!fu) throw new Error("Follow-up not found");

	await crmFollowUpRepository.updateMany(
		{ id },
		{
			$set: {
				status: "COMPLETED",
				outcome: payload.outcome,
				notes: payload.notes != null ? payload.notes : fu.notes,
				completed_at: new Date(),
				history: [...(fu.history || []), { type: "COMPLETED", at: new Date(), by: actorId }],
			},
		},
	);

	if (fu.task_id) {
		await taskRepository.updateMany(
			{ id: fu.task_id },
			{
				$set: {
					status: MasterTaskStatus.COMPLETED,
					closing_date: new Date(),
					closing_message: payload.outcome,
					follow_up_outcome: payload.outcome,
				},
			},
		);
	}

	let next = null;
	if (payload.create_next && payload.next_follow_up_at) {
		next = await createFollowUp(
			{
				user_id: fu.user_id,
				customer_id: fu.customer_id,
				customer_name: fu.customer_name,
				quote_id: fu.quote_id,
				lead_id: fu.lead_id,
				follow_up_at: payload.next_follow_up_at,
				follow_up_type: fu.follow_up_type,
				notes: `Next follow-up after ${payload.outcome}`,
			},
			actorId,
		);
	}

	return { follow_up: await crmFollowUpRepository.findOne({ id }, { lean: true }), next };
}

export async function listFollowUps(filters: Record<string, any>, viewer: { id: number; role?: string }) {
	const page = Number(filters.page || 1);
	const limit = Number(filters.limit || 20);
	const filter: any = {};
	if (filters.status) filter.status = filters.status;
	if (!canManageMasterTasks(viewer.role)) filter.user_id = viewer.id;
	else if (filters.user_id) filter.user_id = Number(filters.user_id);

	const { count, rows } = await crmFollowUpRepository.findPaginated(filter, {
		page,
		limit,
		sort: { follow_up_at: 1 },
	});
	return { total: count, page, limit, data: rows };
}

export async function listTaskTypes() {
	await ensureMasterTaskSeeds();
	return taskTypeCatalogRepository.find({ active: true }, { lean: true, sort: { category: 1, id: 1 } });
}

export async function listEscalationRules() {
	await ensureMasterTaskSeeds();
	return escalationRuleRepository.find({ active: true }, { lean: true, sort: { id: 1 } });
}

export async function upsertEscalationRules(rows: any[], _actorId?: number) {
	await ensureMasterTaskSeeds();
	const out = [];
	for (const row of rows) {
		const task_type = String(row.task_type || "").toUpperCase() || "*";
		const existing: any = await escalationRuleRepository.findOne({ task_type }, { lean: true });
		const patch = {
			label: row.label || task_type,
			warning_hours: Number(row.warning_hours ?? 24),
			escalate_l1_hours: Number(row.escalate_l1_hours ?? 48),
			escalate_l2_hours: Number(row.escalate_l2_hours ?? 72),
			escalate_l3_hours: Number(row.escalate_l3_hours ?? 96),
			active: row.active !== false,
		};
		if (existing?.id) {
			await escalationRuleRepository.updateMany({ id: existing.id }, { $set: patch });
			out.push({ ...existing, ...patch });
		} else {
			out.push(await escalationRuleRepository.create({ task_type, ...patch }));
		}
	}
	return out;
}

export async function addTaskComment(taskId: number, message: string, actorId: number) {
	const task: any = await taskRepository.findOne({ id: taskId }, { lean: true });
	if (!task) throw new Error("Task not found");
	const comments = [
		...(task.comments || []),
		{ id: Date.now(), message, by: actorId, at: new Date() },
	];
	const progress = [
		...(task.progress || []),
		{ type: "COMMENT", message, updated_by: actorId, updated_at: new Date() },
	];
	await taskRepository.updateMany({ id: taskId }, { $set: { comments, progress } });
	return taskRepository.findOne({ id: taskId }, { lean: true, populate: [{ path: "user", select: "id name" }] });
}

logger.info("Master task service loaded");
