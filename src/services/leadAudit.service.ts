const SKIP_FIELDS = new Set([
	"_id",
	"id",
	"__v",
	"timeline",
	"audit_log",
	"notes",
	"transfers",
	"call_logs",
	"ai_messages",
	"progress",
	"linked_lead_ids",
	"follow_up_scripts",
	"response_timer",
	"duplicates",
	"next_best_action",
]);

const FIELD_LABELS: Record<string, string> = {
	name: "Customer name",
	phone: "Phone",
	email: "Email",
	address: "Address",
	suburb: "Suburb",
	postcode: "Postcode",
	state: "State",
	country: "Country",
	note: "Note",
	remark: "Remark",
	status: "Status",
	source: "Lead source",
	owner_id: "Current owner",
	previous_owner_id: "Previous owner",
	team_leader_id: "Team leader",
	score: "Score",
	score_tier: "Priority",
	property_type: "Property type",
	ownership: "Ownership",
	bill_range: "Bill range",
	current_system: "Current system",
	interested_in: "Product / requirement",
	roof_type: "Roof type",
	best_time_to_call: "Best time to call",
	preferred_contact: "Preferred contact",
	language: "Language",
	next_follow_up_at: "Next follow-up",
	last_contacted_at: "Last follow-up",
	assigned_at: "Assigned date",
	solar_requirement: "Solar requirement",
	battery_requirement: "Battery requirement",
	solar_system_size: "Solar system size",
	battery_size: "Battery size",
	existing_inverter: "Existing inverter",
	installation_location: "Installation location",
	customer_type: "Customer type",
	purchase_timeframe: "Purchase timeframe",
	estimated_system_value: "Estimated system value",
	estimated_sales_value: "Estimated sales value",
	campaign_name: "Campaign",
	ad_name: "Ad name",
	landing_page: "Landing page",
	buying_intent: "Buying intent",
	quote_id: "Quote",
};

export type AuditChange = { field: string; label: string; from: unknown; to: unknown };

export type AuditEntry = {
	type: string;
	title?: string;
	detail: string;
	at: Date | string;
	by?: number | null;
	by_name?: string;
	changes?: AuditChange[];
	meta?: Record<string, unknown>;
};

function isPlainObject(v: unknown) {
	return !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
}

export function formatAuditValue(value: unknown): string {
	if (value == null || value === "") return "—";
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map((v) => formatAuditValue(v)).join(", ") || "—";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "object") {
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}
	return String(value);
}

function sameValue(a: unknown, b: unknown) {
	if (a instanceof Date) a = a.toISOString();
	if (b instanceof Date) b = b.toISOString();
	if (Array.isArray(a) || Array.isArray(b)) return formatAuditValue(a) === formatAuditValue(b);
	if (isPlainObject(a) || isPlainObject(b)) return formatAuditValue(a) === formatAuditValue(b);
	return String(a ?? "") === String(b ?? "");
}

export function fieldLabel(field: string) {
	return FIELD_LABELS[field] || field.replace(/_/g, " ");
}

export function diffLeadChanges(before: Record<string, any> | null | undefined, patch: Record<string, any>) {
	const changes: AuditChange[] = [];
	if (!patch) return changes;
	for (const [field, to] of Object.entries(patch)) {
		if (SKIP_FIELDS.has(field) || field.startsWith("$")) continue;
		const from = before ? before[field] : undefined;
		if (sameValue(from, to)) continue;
		changes.push({ field, label: fieldLabel(field), from: from ?? null, to: to ?? null });
	}
	return changes;
}

export function snapshotLeadFields(lead: Record<string, any> | null | undefined, fields?: string[]) {
	const keys = fields || Object.keys(FIELD_LABELS);
	const changes: AuditChange[] = [];
	if (!lead) return changes;
	for (const field of keys) {
		if (lead[field] == null || lead[field] === "") continue;
		changes.push({ field, label: fieldLabel(field), from: null, to: lead[field] });
	}
	return changes;
}

export function describeAuditChanges(changes?: AuditChange[]) {
	if (!changes?.length) return "";
	return changes
		.map((c) => `${c.label}: ${formatAuditValue(c.from)} → ${formatAuditValue(c.to)}`)
		.join("; ");
}

export function pushAudit(existing: any[] | undefined, entry: Partial<AuditEntry> & { type: string; detail: string }) {
	const list = Array.isArray(existing) ? [...existing] : [];
	list.push({
		type: entry.type,
		title: entry.title || entry.type.replace(/_/g, " "),
		detail: entry.detail,
		at: entry.at || new Date(),
		by: entry.by ?? null,
		by_name: entry.by_name || "",
		changes: entry.changes || [],
		meta: entry.meta || {},
	});
	return list;
}

function stamp(value: any) {
	const at = value?.at || value?.created_at;
	return at ? new Date(at).getTime() : 0;
}

export function compileLeadAuditTrail(lead: any): AuditEntry[] {
	if (!lead) return [];
	const rows: AuditEntry[] = [];
	const seen = new Set<string>();
	const covered = new Set<string>();
	const coverKey = (type: string, at: any) => `${type}|${Math.floor(stamp({ at }) / 3000)}`;
	const add = (entry: AuditEntry, mark = true) => {
		const key = `${entry.type}|${stamp(entry)}|${entry.detail}|${entry.by || ""}`;
		if (seen.has(key)) return;
		seen.add(key);
		if (mark) covered.add(coverKey(entry.type, entry.at));
		rows.push(entry);
	};

	for (const e of Array.isArray(lead.audit_log) ? lead.audit_log : []) {
		add({
			type: e.type || "update",
			title: e.title || e.type,
			detail: e.detail || "",
			at: e.at,
			by: e.by ?? null,
			by_name: e.by_name || "",
			changes: Array.isArray(e.changes) ? e.changes : [],
			meta: e.meta || e,
		});
	}

	const maybeAdd = (entry: AuditEntry, aliases: string[] = []) => {
		const types = [entry.type, ...aliases];
		if (types.some((t) => covered.has(coverKey(t, entry.at)))) return;
		add(entry, false);
	};

	for (const t of Array.isArray(lead.timeline) ? lead.timeline : []) {
		maybeAdd({
			type: t.type || "timeline",
			title: t.title || t.type,
			detail: t.detail || "",
			at: t.at,
			by: t.by ?? null,
			by_name: t.by_name || "",
			changes: [],
			meta: { source: "timeline" },
		}, ["created", "assign", "transfer", "status", "call", "note"]);
	}

	for (const t of Array.isArray(lead.transfers) ? lead.transfers : []) {
		maybeAdd({
			type: "transfer",
			title: "Lead transferred",
			detail: `${t.from_user_name || t.from_user_id || "Unassigned"} → ${t.to_user_name || t.to_user_id}. ${t.reason || ""}${t.note ? ` — ${t.note}` : ""}`.trim(),
			at: t.at,
			by: t.by ?? null,
			by_name: t.by_name || "",
			changes: [
				{
					field: "owner_id",
					label: "Current owner",
					from: t.from_user_name || t.from_user_id || "Unassigned",
					to: t.to_user_name || t.to_user_id,
				},
			],
			meta: { reason: t.reason, note: t.note, source: "transfer" },
		});
	}

	for (const n of Array.isArray(lead.notes) ? lead.notes : []) {
		maybeAdd({
			type: "note",
			title: n.type || "Note",
			detail: n.body || "",
			at: n.at,
			by: n.by ?? null,
			by_name: n.by_name || "",
			changes: [],
			meta: { source: "note" },
		});
	}

	for (const c of Array.isArray(lead.call_logs) ? lead.call_logs : []) {
		maybeAdd({
			type: "call",
			title: c.connected ? "Call connected" : "Call attempt",
			detail: c.remark || (c.connected ? "Connected" : "Not connected"),
			at: c.at,
			by: c.by ?? null,
			by_name: c.by_name || "",
			changes: [
				{ field: "connected", label: "Connected", from: null, to: !!c.connected },
				{ field: "duration_seconds", label: "Duration (sec)", from: null, to: c.duration_seconds || 0 },
			],
			meta: { source: "call" },
		});
	}

	return rows.sort((a, b) => stamp(b) - stamp(a));
}
