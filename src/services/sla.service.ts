import {
	DEFAULT_DELAY_REASONS,
	DEFAULT_SLA_STAGE_CONFIGS,
	SLA_MANAGEMENT_ROLES,
	SLA_UNTIMED_STAGES,
	SlaResponsibilityType,
	SlaStatus,
} from "@constants/sla.constants";
import { QUOTE_PIPELINE_SHORT_LABELS } from "@constants/quotePipeline.constants";
import {
	slaDelayReasonRepository,
	slaStageConfigRepository,
	slaStageRunRepository,
	quoteRepository,
	userRepository,
	taskRepository,
} from "@repositories";
import { dispatchNotification } from "@services/notificationHandler.service";
import { notifySlaBadgeChanged } from "@services/badgeNotify.service";
import logger from "@utils/pino";

let seedPromise: Promise<void> | null = null;

export function canManageSla(role?: string | null) {
	return !!role && SLA_MANAGEMENT_ROLES.has(String(role).toUpperCase());
}

export function hoursBetween(from: Date, to: Date) {
	return Math.max(0, (to.getTime() - from.getTime()) / 3600000);
}

export function computeSlaStatus(
	elapsedHours: number,
	cfg: { warning_hours: number; escalation_hours: number; critical_hours: number },
): SlaStatus {
	if (elapsedHours >= cfg.critical_hours) return SlaStatus.CRITICAL;
	if (elapsedHours >= cfg.escalation_hours) return SlaStatus.DELAYED;
	if (elapsedHours >= cfg.warning_hours) return SlaStatus.WARNING;
	return SlaStatus.ON_TRACK;
}

function pushEvent(events: any[], type: string, meta: Record<string, unknown> = {}) {
	events.push({ type, at: new Date(), ...meta });
	return events;
}

export async function ensureSlaSeeds() {
	if (!seedPromise) {
		seedPromise = (async () => {
			for (const row of DEFAULT_SLA_STAGE_CONFIGS) {
				const existing = await slaStageConfigRepository.findOne({ stage: row.stage }, { lean: true });
				if (!existing) {
					await slaStageConfigRepository.create({ ...row });
				}
			}
			for (const row of DEFAULT_DELAY_REASONS) {
				const existing = await slaDelayReasonRepository.findOne({ code: row.code }, { lean: true });
				if (!existing) {
					await slaDelayReasonRepository.create({ ...row, active: true });
				}
			}
		})().catch((e) => {
			seedPromise = null;
			throw e;
		});
	}
	await seedPromise;
}

export async function getStageConfig(stage: string) {
	await ensureSlaSeeds();
	return slaStageConfigRepository.findOne({ stage }, { lean: true });
}

export async function listStageConfigs() {
	await ensureSlaSeeds();
	return slaStageConfigRepository.find({}, { lean: true, sort: { id: 1 } });
}

export async function upsertStageConfigs(
	rows: Array<Record<string, unknown>>,
	actorId?: number | null,
) {
	await ensureSlaSeeds();
	const out: any[] = [];
	for (const row of rows) {
		const stage = String(row.stage || "");
		if (!stage) continue;
		const existing: any = await slaStageConfigRepository.findOne({ stage }, { lean: true });
		const patch = {
			label: row.label ?? existing?.label ?? stage,
			enabled: row.enabled !== undefined ? !!row.enabled : existing?.enabled !== false,
			standard_hours: Number(row.standard_hours ?? existing?.standard_hours ?? 24),
			warning_hours: Number(row.warning_hours ?? existing?.warning_hours ?? 18),
			escalation_hours: Number(row.escalation_hours ?? existing?.escalation_hours ?? 24),
			critical_hours: Number(row.critical_hours ?? existing?.critical_hours ?? 48),
			responsible_department: String(
				row.responsible_department ?? existing?.responsible_department ?? "Operations",
			),
			responsible_role: String(row.responsible_role ?? existing?.responsible_role ?? ""),
			version: (existing?.version || 1) + 1,
			updated_by: actorId ?? null,
		};
		if (existing?.id) {
			await slaStageConfigRepository.updateMany({ id: existing.id }, { $set: patch });
			out.push({ ...existing, ...patch });
		} else {
			const created = await slaStageConfigRepository.create({ stage, ...patch });
			out.push(created);
		}
	}
	return out;
}

export async function listDelayReasons() {
	await ensureSlaSeeds();
	return slaDelayReasonRepository.find({ active: true }, { lean: true, sort: { id: 1 } });
}

function enrichRun(run: any, now = new Date()) {
	if (!run) return null;
	const end = run.ended_at ? new Date(run.ended_at) : now;
	const started = new Date(run.started_at);
	const elapsed_hours = hoursBetween(started, end);
	const delay_hours =
		elapsed_hours > Number(run.standard_hours || 0)
			? elapsed_hours - Number(run.standard_hours || 0)
			: 0;
	const live_status = run.active
		? computeSlaStatus(elapsed_hours, {
				warning_hours: Number(run.warning_hours),
				escalation_hours: Number(run.escalation_hours),
				critical_hours: Number(run.critical_hours),
			})
		: run.sla_status;
	return {
		...run,
		elapsed_hours: Number(elapsed_hours.toFixed(2)),
		delay_hours: Number(delay_hours.toFixed(2)),
		live_status,
		stage_label:
			(QUOTE_PIPELINE_SHORT_LABELS as any)[run.stage] || run.stage,
	};
}

export async function closeActiveRunsForQuote(
	quoteId: number,
	meta: { reason?: string; actorId?: number | null } = {},
) {
	const open = await slaStageRunRepository.find(
		{ quote_id: Number(quoteId), active: true },
		{ lean: true },
	);
	const now = new Date();
	for (const run of open as any[]) {
		const elapsed = hoursBetween(new Date(run.started_at), now);
		const status = computeSlaStatus(elapsed, run);
		const delay =
			elapsed > Number(run.standard_hours) ? elapsed - Number(run.standard_hours) : 0;
		const events = pushEvent([...(run.events || [])], "STAGE_ENDED", {
			by: meta.actorId ?? null,
			reason: meta.reason || "pipeline_advance",
			elapsed_hours: Number(elapsed.toFixed(2)),
		});
		await slaStageRunRepository.updateMany(
			{ id: run.id },
			{
				$set: {
					active: false,
					ended_at: now,
					sla_status: status,
					delay_hours: Number(delay.toFixed(2)),
					events,
				},
			},
		);
	}
}

export async function openStageRun(
	quoteId: number,
	stage: string,
	meta: { actorId?: number | null; startedAt?: Date } = {},
) {
	if (!stage || SLA_UNTIMED_STAGES.has(stage)) return null;
	const cfg: any = await getStageConfig(stage);
	if (!cfg || cfg.enabled === false) return null;

	await closeActiveRunsForQuote(quoteId, {
		reason: "new_stage",
		actorId: meta.actorId,
	});

	const startedAt = meta.startedAt || new Date();
	const events = pushEvent([], "STAGE_STARTED", { by: meta.actorId ?? null, stage });
	const created = await slaStageRunRepository.create({
		quote_id: Number(quoteId),
		stage,
		active: true,
		started_at: startedAt,
		ended_at: null,
		standard_hours: cfg.standard_hours,
		warning_hours: cfg.warning_hours,
		escalation_hours: cfg.escalation_hours,
		critical_hours: cfg.critical_hours,
		sla_status: SlaStatus.ON_TRACK,
		delay_hours: 0,
		responsible_department: cfg.responsible_department,
		responsible_role: cfg.responsible_role,
		events,
	});
	return created;
}

/** Called from advanceQuotePipeline when status changes */
export async function onPipelineStageChange(opts: {
	quoteId: number;
	from: string | null;
	to: string | null;
	actorId?: number | null;
	statusChanged: boolean;
}) {
	if (!opts.statusChanged || !opts.to) return;
	try {
		await ensureSlaSeeds();
		await openStageRun(opts.quoteId, opts.to, { actorId: opts.actorId });
	} catch (e: any) {
		logger.error(`SLA onPipelineStageChange failed: ${e?.message || e}`);
	}
}

async function findManagementUsers() {
	const users = await userRepository.find(
		{ role: { $in: Array.from(SLA_MANAGEMENT_ROLES) }, deleted_at: null },
		{ lean: true, select: "id role name email" },
	);
	return users as any[];
}

async function notifyManagers(message: string, meta: Record<string, unknown>) {
	const users = await findManagementUsers();
	await Promise.all(
		users.map((u) =>
			dispatchNotification({
					userId: u.id,
					message,
					route: "sla/delayed-jobs",
					meta: { type: "sla_delay", ...meta },
				})
				.catch(() => undefined),
		),
	);
}

async function createDelayTask(run: any, quote: any) {
	const assignee =
		quote?.sender_id ||
		(await findManagementUsers())[0]?.id ||
		null;
	if (!assignee) return null;
	try {
		const { createMasterTask } = await import("@services/masterTask.service");
		const task: any = await createMasterTask(
			{
				type: "SLA_DELAY_RESOLVE",
				user_id: Number(assignee),
				title: `Resolve Delayed Job SE-${quote.id}`,
				description: [
					`Job SE-${quote.id} (${quote.name || "Customer"}) is delayed.`,
					`Stage: ${run.stage}`,
					`Standard SLA: ${run.standard_hours}h`,
					`Delay reason: ${run.delay_reason_label || "Not set — add reason"}`,
					`Responsible: ${run.responsibility_party || run.responsible_department || "TBD"}`,
				].join("\n"),
				priority: "URGENT",
				quote_id: quote.id,
				customer_name: quote.name || "",
				due_date: new Date(Date.now() + 24 * 3600000),
			},
			assignee,
		);
		return task?.id ?? null;
	} catch {
		return null;
	}
}

export async function evaluateOpenRuns() {
	await ensureSlaSeeds();
	const now = new Date();
	const open = (await slaStageRunRepository.find({ active: true }, { lean: true })) as any[];
	let updated = 0;
	for (const run of open) {
		const elapsed = hoursBetween(new Date(run.started_at), now);
		const next = computeSlaStatus(elapsed, run);
		const delay =
			elapsed > Number(run.standard_hours) ? elapsed - Number(run.standard_hours) : 0;
		const $set: Record<string, unknown> = {
			delay_hours: Number(delay.toFixed(2)),
		};
		let events = [...(run.events || [])];
		let changed = false;

		if (next !== run.sla_status) {
			$set.sla_status = next;
			changed = true;
			events = pushEvent(events, `STATUS_${next}`, {
				elapsed_hours: Number(elapsed.toFixed(2)),
			});
		}
		if (next === SlaStatus.WARNING && !run.warning_at) {
			$set.warning_at = now;
			changed = true;
		}
		if (
			(next === SlaStatus.DELAYED || next === SlaStatus.CRITICAL) &&
			!run.breached_at
		) {
			$set.breached_at = now;
			changed = true;
		}
		if (next === SlaStatus.CRITICAL && !run.critical_at) {
			$set.critical_at = now;
			changed = true;
		}

		const quote: any = await quoteRepository.findOne(
			{ id: run.quote_id },
			{ lean: true, select: "id name sender_id customer_id kanban_status" },
		);

		if (
			(next === SlaStatus.DELAYED || next === SlaStatus.CRITICAL) &&
			!run.notified_breach
		) {
			$set.notified_breach = true;
			changed = true;
			const msg = `DELAYED JOB SE-${run.quote_id} — ${quote?.name || "Customer"} stuck in ${run.stage} (+${delay.toFixed(1)}h)`;
			await notifyManagers(msg, {
				quote_id: run.quote_id,
				run_id: run.id,
				stage: run.stage,
				sla_status: next,
			});
			if (!run.task_id) {
				const taskId = await createDelayTask({ ...run, ...$set }, quote || { id: run.quote_id });
				if (taskId) $set.task_id = taskId;
			}
			events = pushEvent(events, "BREACH_NOTIFIED", {});
		}

		if (next === SlaStatus.CRITICAL && !run.notified_critical) {
			$set.notified_critical = true;
			changed = true;
			await notifyManagers(
				`CRITICAL DELAY SE-${run.quote_id} — ${quote?.name || "Customer"} / ${run.stage} (+${delay.toFixed(1)}h)`,
				{
					quote_id: run.quote_id,
					run_id: run.id,
					stage: run.stage,
					sla_status: SlaStatus.CRITICAL,
				},
			);
			events = pushEvent(events, "CRITICAL_NOTIFIED", {});
		}

		if (changed) {
			$set.events = events;
			await slaStageRunRepository.updateMany({ id: run.id }, { $set });
			updated += 1;
		} else if (Math.abs(Number(run.delay_hours || 0) - delay) > 0.05) {
			await slaStageRunRepository.updateMany(
				{ id: run.id },
				{ $set: { delay_hours: Number(delay.toFixed(2)) } },
			);
		}
	}
	const result = { scanned: open.length, updated };
	if (updated > 0) {
		notifySlaBadgeChanged(await buildAlertsSummaryOnly());
	}
	return result;
}

export async function buildAlertsSummaryOnly() {
	await ensureSlaSeeds();
	const active = (await slaStageRunRepository.find({ active: true }, { lean: true })) as any[];
	const enriched = active.map((r) => enrichRun(r)!);
	const delayed = enriched.filter(
		(r) => r.live_status === SlaStatus.DELAYED || r.live_status === SlaStatus.CRITICAL,
	);
	return {
		total_delayed: delayed.length,
		critical: enriched.filter((r) => r.live_status === SlaStatus.CRITICAL).length,
		delayed: enriched.filter((r) => r.live_status === SlaStatus.DELAYED).length,
		warning: enriched.filter((r) => r.live_status === SlaStatus.WARNING).length,
		on_track: enriched.filter((r) => r.live_status === SlaStatus.ON_TRACK).length,
		external: delayed.filter((r) => r.responsibility_type === SlaResponsibilityType.EXTERNAL)
			.length,
		internal: delayed.filter((r) => r.responsibility_type === SlaResponsibilityType.INTERNAL)
			.length,
		missing_reason: delayed.filter((r) => !r.delay_reason_code).length,
	};
}

export async function getAlertsSummary() {
	await ensureSlaSeeds();
	await evaluateOpenRuns().catch(() => undefined);
	return buildAlertsSummaryOnly();
}

export async function listDelayedJobs(filters: Record<string, any> = {}) {
	await ensureSlaSeeds();
	await evaluateOpenRuns().catch(() => undefined);

	const statusFilter = filters.sla_status
		? String(filters.sla_status)
		: null;
	const query: Record<string, unknown> = { active: true };
	if (statusFilter) {
		query.sla_status = statusFilter;
	} else {
		query.sla_status = { $in: [SlaStatus.DELAYED, SlaStatus.CRITICAL] };
	}
	if (filters.stage) query.stage = String(filters.stage);
	if (filters.reason) query.delay_reason_code = String(filters.reason);
	if (filters.responsibility_type) {
		query.responsibility_type = String(filters.responsibility_type);
	}

	let runs = (await slaStageRunRepository.find(query, {
		lean: true,
		sort: { delay_hours: -1 },
	})) as any[];

	runs = runs.map((r) => enrichRun(r)!);

	const minDelay = filters.min_delay_hours != null ? Number(filters.min_delay_hours) : null;
	if (minDelay != null && !Number.isNaN(minDelay)) {
		runs = runs.filter((r) => r.delay_hours >= minDelay);
	}
	if (filters.quick === "24") runs = runs.filter((r) => r.delay_hours >= 24);
	if (filters.quick === "48") runs = runs.filter((r) => r.delay_hours >= 48);
	if (filters.quick === "72") runs = runs.filter((r) => r.delay_hours >= 72);
	if (filters.quick === "168") runs = runs.filter((r) => r.delay_hours >= 168);

	const quoteIds = [...new Set(runs.map((r) => r.quote_id))];
	const quotes = quoteIds.length
		? ((await quoteRepository.find(
				{ id: { $in: quoteIds } },
				{ lean: true, select: "id name customer_id sender_id kanban_status" },
			)) as any[])
		: [];
	const quoteMap = new Map(quotes.map((q) => [q.id, q]));

	const senderIds = [...new Set(quotes.map((q) => q.sender_id).filter(Boolean))];
	const senders = senderIds.length
		? ((await userRepository.find(
				{ id: { $in: senderIds } },
				{ lean: true, select: "id name email" },
			)) as any[])
		: [];
	const senderMap = new Map(senders.map((u) => [u.id, u]));

	let rows = runs.map((r) => {
		const q = quoteMap.get(r.quote_id);
		const sender = q?.sender_id ? senderMap.get(q.sender_id) : null;
		return {
			...r,
			job_id: `SE-${r.quote_id}`,
			customer: q?.name || "—",
			salesperson: sender?.name || "—",
			salesperson_id: q?.sender_id || null,
			priority:
				r.live_status === SlaStatus.CRITICAL
					? "Critical"
					: r.delay_hours >= 72
						? "High"
						: r.delay_hours >= 24
							? "Medium"
							: "Normal",
		};
	});

	if (filters.customer) {
		const c = String(filters.customer).toLowerCase();
		rows = rows.filter((r) => String(r.customer).toLowerCase().includes(c));
	}
	if (filters.salesperson_id) {
		rows = rows.filter((r) => Number(r.salesperson_id) === Number(filters.salesperson_id));
	}
	if (filters.job_id) {
		const j = String(filters.job_id).replace(/\D/g, "");
		rows = rows.filter((r) => String(r.quote_id) === j || String(r.job_id).includes(j));
	}

	return rows;
}

export async function getQuoteSlaTimeline(quoteId: number) {
	await ensureSlaSeeds();
	const runs = (await slaStageRunRepository.find(
		{ quote_id: Number(quoteId) },
		{ lean: true, sort: { started_at: 1 } },
	)) as any[];
	const active = runs.find((r) => r.active);
	return {
		active: active ? enrichRun(active) : null,
		timeline: runs.map((r) => enrichRun(r)),
	};
}

export async function setDelayReason(
	runId: number,
	payload: {
		delay_reason_code: string;
		delay_explanation?: string;
		responsible_user_id?: number | null;
		actorId?: number | null;
	},
) {
	await ensureSlaSeeds();
	const run: any = await slaStageRunRepository.findOne({ id: Number(runId) }, { lean: true });
	if (!run) throw new Error("SLA run not found");
	const reason: any = await slaDelayReasonRepository.findOne(
		{ code: payload.delay_reason_code },
		{ lean: true },
	);
	if (!reason) throw new Error("Invalid delay reason");

	const events = pushEvent([...(run.events || [])], "DELAY_REASON_SET", {
		by: payload.actorId ?? null,
		code: reason.code,
	});

	await slaStageRunRepository.updateMany(
		{ id: run.id },
		{
			$set: {
				delay_reason_code: reason.code,
				delay_reason_label: reason.label,
				delay_explanation: String(payload.delay_explanation || "").trim(),
				responsibility_type: reason.is_external
					? SlaResponsibilityType.EXTERNAL
					: SlaResponsibilityType.INTERNAL,
				responsibility_party: reason.responsibility_party,
				responsible_user_id:
					payload.responsible_user_id !== undefined
						? payload.responsible_user_id
						: run.responsible_user_id,
				events,
			},
		},
	);

	const updated = enrichRun(
		await slaStageRunRepository.findOne({ id: run.id }, { lean: true }),
	);
	notifySlaBadgeChanged(await buildAlertsSummaryOnly());
	return updated;
}

export async function resolveDelay(
	runId: number,
	payload: { resolution_notes: string; actorId?: number | null },
) {
	const run: any = await slaStageRunRepository.findOne({ id: Number(runId) }, { lean: true });
	if (!run) throw new Error("SLA run not found");
	if (!run.delay_reason_code) throw new Error("Delay reason is required before resolving");

	const notes = String(payload.resolution_notes || "").trim();
	if (!notes) throw new Error("Resolution notes are required");

	const events = pushEvent([...(run.events || [])], "DELAY_RESOLVED", {
		by: payload.actorId ?? null,
		notes,
	});

	await slaStageRunRepository.updateMany(
		{ id: run.id },
		{
			$set: {
				resolved_at: new Date(),
				resolution_notes: notes,
				resolved_by: payload.actorId ?? null,
				events,
			},
		},
	);

	if (run.task_id) {
		await taskRepository
			.updateMany(
				{ id: run.task_id },
				{ $set: { status: "DONE", closing_date: new Date(), closing_message: notes } },
			)
			.catch(() => undefined);
		const { notifyMasterTaskBadgeChanged } = await import("@services/badgeNotify.service");
		notifyMasterTaskBadgeChanged();
	}

	const updated = enrichRun(
		await slaStageRunRepository.findOne({ id: run.id }, { lean: true }),
	);
	notifySlaBadgeChanged(await buildAlertsSummaryOnly());
	return updated;
}

/** Counts per pipeline stage for quote filter chips */
export async function getSlaCountsByStage() {
	await ensureSlaSeeds();
	const active = (await slaStageRunRepository.find({ active: true }, { lean: true })) as any[];
	const byStage: Record<
		string,
		{ on_track: number; warning: number; delayed: number; critical: number }
	> = {};
	for (const run of active) {
		const e = enrichRun(run)!;
		if (!byStage[e.stage]) {
			byStage[e.stage] = { on_track: 0, warning: 0, delayed: 0, critical: 0 };
		}
		if (e.live_status === SlaStatus.ON_TRACK) byStage[e.stage].on_track += 1;
		else if (e.live_status === SlaStatus.WARNING) byStage[e.stage].warning += 1;
		else if (e.live_status === SlaStatus.DELAYED) byStage[e.stage].delayed += 1;
		else if (e.live_status === SlaStatus.CRITICAL) byStage[e.stage].critical += 1;
	}
	return byStage;
}

export async function backfillActiveQuotes() {
	await ensureSlaSeeds();
	const quotes = (await quoteRepository.find(
		{
			kanban_status: { $nin: Array.from(SLA_UNTIMED_STAGES) },
			deleted_at: null,
		},
		{ lean: true, select: "id kanban_status status_updated_date accepted_date created_at" },
	)) as any[];

	let created = 0;
	for (const q of quotes) {
		const open = await slaStageRunRepository.findOne(
			{ quote_id: q.id, active: true },
			{ lean: true },
		);
		if (open) continue;
		const stage = String(q.kanban_status || "");
		if (SLA_UNTIMED_STAGES.has(stage)) continue;
		const startedAt =
			q.status_updated_date || q.accepted_date || q.created_at || new Date();
		await openStageRun(q.id, stage, { startedAt: new Date(startedAt) });
		created += 1;
	}
	return { created };
}
