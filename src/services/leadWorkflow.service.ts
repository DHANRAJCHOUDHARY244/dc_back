import {
  buildQualificationThanksMessage,
  buildWelcomeMessage,
  computeLeadScore,
  LEAD_STATUSES,
  type LeadStatus,
} from "@constants/leadPipeline.constants";
import { getCompanyConfig } from "@services/crmSettings.service";
import { leadRepository, roleRepository, userRepository } from "@repositories";
import { Roles } from "src/data/dataInserter";
import notificationController from "@controllers/notification.controller";

const ADMIN_ROLES = new Set([
  Roles.SUPER_ADMIN,
  Roles.ADMIN,
  Roles.MANAGER,
  Roles.CEO,
  Roles.CUSTOMER_SUPPORT_EXECUTIVE,
  Roles.OPERATIONS_MANAGER,
]);

export function isLeadAdminRole(role?: string | null) {
  return !!role && ADMIN_ROLES.has(role);
}

function pushTimeline(existing: any[] | undefined, entry: Record<string, unknown>) {
  const list = Array.isArray(existing) ? [...existing] : [];
  list.push({ ...entry, at: new Date() });
  return list;
}

export function suggestNextBestAction(lead: any): string {
  if (!lead?.owner_id) return "Assign Lead";
  if (["NEW_LEAD", "AI_QUALIFIED", "ASSIGNED"].includes(lead.status)) return "Call Now";
  if (lead.next_follow_up_at && new Date(lead.next_follow_up_at) <= new Date()) return "Call Today — Follow-up Due";
  if (["CONNECTED", "INTERESTED", "VERY_INTERESTED", "NEED_FOLLOW_UP"].includes(lead.status)) {
    return "Send Quote";
  }
  if (["QUOTE_SENT", "QUOTE_VIEWED"].includes(lead.status)) return "Follow-up Quote";
  if (lead.status === "NEGOTIATION") return "Negotiate / Close Deal";
  if (lead.status === "ACCEPTED" || lead.status === "DEPOSIT_PENDING") return "Collect Deposit";
  if (Array.isArray(lead.interested_in) && lead.interested_in.includes("Battery") && lead.score_tier === "HOT") {
    return "Offer Battery Upgrade";
  }
  if (!lead.bill_range) return "Request Bill Copy";
  if (["CALL_ATTEMPT_1", "CALL_ATTEMPT_2", "NOT_REACHABLE", "VOICEMAIL"].includes(lead.status)) {
    return "Retry Call";
  }
  return "Update Lead Status";
}

export async function findDuplicateLeads(input: { phone?: string; email?: string; excludeId?: number }) {
  const or: Record<string, unknown>[] = [];
  if (input.phone) or.push({ phone: String(input.phone).trim() });
  if (input.email) or.push({ email: String(input.email).trim().toLowerCase() });
  if (!or.length) return [];
  const filter: Record<string, unknown> = { $or: or };
  if (input.excludeId) filter.id = { $ne: input.excludeId };
  return leadRepository.find(filter, {
    select: "id name phone email status source created_at",
    lean: true,
    limit: 10,
  });
}

export async function createEnquiryLead(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  postcode?: string;
  state?: string;
  source?: string;
  property_type?: string;
  ownership?: string;
  bill_range?: string;
  current_system?: string;
  interested_in?: string[];
  roof_type?: string;
  best_time_to_call?: string;
  preferred_contact?: string;
  language?: string;
  note?: string;
  cf_id?: number;
  popup_id?: number;
}) {
  const cfg = await getCompanyConfig();
  const companyName = cfg.name || "Soms Energy";
  const { score, tier } = computeLeadScore({
    bill_range: input.bill_range,
    interested_in: input.interested_in,
    ownership: input.ownership,
    property_type: input.property_type,
    response_speed_seconds: 5,
    state: input.state,
  });

  const welcome = buildWelcomeMessage(input.name, companyName);
  const thanks = buildQualificationThanksMessage(companyName);
  const now = new Date();

  const hasQualification =
    !!(input.property_type || input.ownership || input.bill_range || (input.interested_in || []).length);

  const status: LeadStatus = hasQualification ? "AI_QUALIFIED" : "NEW_LEAD";

  const timeline = [
    {
      type: "enquiry",
      title: "Lead Enquiry",
      detail: `Source: ${input.source || "Website"}`,
      at: now,
    },
    {
      type: "ai_welcome",
      title: "AI Instant Reply Queued",
      detail: welcome.slice(0, 120),
      at: now,
      channel: input.preferred_contact || "WhatsApp",
    },
  ];

  if (hasQualification) {
    timeline.push({
      type: "ai_qualified",
      title: "AI Qualification Complete",
      detail: thanks.slice(0, 120),
      at: now,
      channel: "WhatsApp",
    });
  }

  const payload: Record<string, unknown> = {
    name: input.name,
    phone: input.phone || "",
    email: input.email || "",
    address: input.address || "",
    postcode: input.postcode || "",
    state: input.state || "",
    note: input.note || "",
    source: input.source || "Website",
    status,
    score,
    score_tier: tier,
    property_type: input.property_type || "",
    ownership: input.ownership || "",
    bill_range: input.bill_range || "",
    current_system: input.current_system || "",
    interested_in: input.interested_in || [],
    roof_type: input.roof_type || "",
    best_time_to_call: input.best_time_to_call || "",
    preferred_contact: input.preferred_contact || "WhatsApp",
    language: input.language || "English",
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    ai_welcome_sent_at: now,
    ai_qualified_at: hasQualification ? now : null,
    ai_messages: [
      { direction: "out", channel: "WhatsApp", body: welcome, at: now, kind: "welcome" },
      ...(hasQualification
        ? [{ direction: "out", channel: "WhatsApp", body: thanks, at: now, kind: "qualification_thanks" }]
        : []),
    ],
    call_logs: [],
    timeline,
    cf_id: input.cf_id || null,
    popup_id: input.popup_id || null,
  };

  const duplicates = await findDuplicateLeads({ phone: input.phone, email: input.email });
  if (duplicates.length) {
    (payload.timeline as any[]).push({
      type: "duplicate_hint",
      title: "Possible Duplicate Detected",
      detail: `Matches ${duplicates.length} existing lead(s)`,
      at: now,
    });
  }

  const lead = await leadRepository.create(payload);
  return {
    lead,
    welcome_message: welcome,
    thanks_message: hasQualification ? thanks : null,
    duplicates,
    next_best_action: suggestNextBestAction(lead),
  };
}

export async function updateLeadStatus(
  leadId: number,
  status: string,
  opts: { actorId?: number | null; remark?: string; next_follow_up_at?: string | Date | null } = {},
) {
  if (!LEAD_STATUSES.includes(status as LeadStatus)) {
    throw new Error("Invalid lead status");
  }
  const lead: any = await leadRepository.findOne({ id: leadId }, { lean: true });
  if (!lead) throw new Error("Lead not found");

  const $set: Record<string, unknown> = {
    status,
    timeline: pushTimeline(lead.timeline, {
      type: "status",
      title: "Status Updated",
      detail: opts.remark || `${lead.status} → ${status}`,
      by: opts.actorId ?? null,
    }),
  };
  if (opts.next_follow_up_at) $set.next_follow_up_at = new Date(opts.next_follow_up_at);

  await leadRepository.updateMany({ id: leadId }, { $set });
  return leadRepository.findOne({ id: leadId }, { lean: true });
}

export async function qualifyLead(
  leadId: number,
  data: {
    property_type?: string;
    ownership?: string;
    bill_range?: string;
    current_system?: string;
    interested_in?: string[];
    roof_type?: string;
    best_time_to_call?: string;
    preferred_contact?: string;
    postcode?: string;
    state?: string;
    address?: string;
    actorId?: number | null;
  },
) {
  const lead: any = await leadRepository.findOne({ id: leadId }, { lean: true });
  if (!lead) throw new Error("Lead not found");

  const cfg = await getCompanyConfig();
  const thanks = buildQualificationThanksMessage(cfg.name || "Soms Energy");
  const now = new Date();
  const { score, tier } = computeLeadScore({
    bill_range: data.bill_range ?? lead.bill_range,
    interested_in: data.interested_in ?? lead.interested_in,
    ownership: data.ownership ?? lead.ownership,
    property_type: data.property_type ?? lead.property_type,
    state: data.state ?? lead.state,
    response_speed_seconds: 5,
  });

  await leadRepository.updateMany(
    { id: leadId },
    {
      $set: {
        property_type: data.property_type ?? lead.property_type,
        ownership: data.ownership ?? lead.ownership,
        bill_range: data.bill_range ?? lead.bill_range,
        current_system: data.current_system ?? lead.current_system,
        interested_in: data.interested_in ?? lead.interested_in,
        roof_type: data.roof_type ?? lead.roof_type,
        best_time_to_call: data.best_time_to_call ?? lead.best_time_to_call,
        preferred_contact: data.preferred_contact ?? lead.preferred_contact,
        postcode: data.postcode ?? lead.postcode,
        state: data.state ?? lead.state,
        address: data.address ?? lead.address,
        status: lead.status === "NEW_LEAD" ? "AI_QUALIFIED" : lead.status,
        ai_qualified_at: now,
        score,
        score_tier: tier,
        ai_messages: [
          ...(Array.isArray(lead.ai_messages) ? lead.ai_messages : []),
          { direction: "out", channel: "WhatsApp", body: thanks, at: now, kind: "qualification_thanks" },
        ],
        timeline: pushTimeline(lead.timeline, {
          type: "ai_qualified",
          title: "AI Qualification Complete",
          detail: thanks.slice(0, 120),
          by: data.actorId ?? null,
        }),
      },
    },
  );

  const updated = await leadRepository.findOne({ id: leadId }, { lean: true });
  return { lead: updated, thanks_message: thanks, next_best_action: suggestNextBestAction(updated) };
}

export async function logLeadCall(
  leadId: number,
  data: {
    connected: boolean;
    duration_seconds?: number;
    remark?: string;
    next_follow_up_at?: string | Date | null;
    status?: string;
    actorId?: number | null;
  },
) {
  const lead: any = await leadRepository.findOne({ id: leadId }, { lean: true });
  if (!lead) throw new Error("Lead not found");

  const now = new Date();
  const callEntry = {
    connected: !!data.connected,
    duration_seconds: Number(data.duration_seconds) || 0,
    remark: String(data.remark || "").trim(),
    at: now,
    by: data.actorId ?? null,
    next_follow_up_at: data.next_follow_up_at ? new Date(data.next_follow_up_at) : null,
    status: data.status || null,
  };

  let nextStatus = lead.status;
  if (data.status) nextStatus = data.status;
  else if (data.connected) nextStatus = "CONNECTED";
  else if (lead.status === "ASSIGNED" || lead.status === "NEW_LEAD" || lead.status === "AI_QUALIFIED") {
    nextStatus = "CALL_ATTEMPT_1";
  } else if (lead.status === "CALL_ATTEMPT_1") nextStatus = "CALL_ATTEMPT_2";
  else if (lead.status === "CALL_ATTEMPT_2") nextStatus = "CALL_ATTEMPT_3";
  else if (!data.connected) nextStatus = "NOT_REACHABLE";

  const { score, tier } = computeLeadScore({
    bill_range: lead.bill_range,
    interested_in: lead.interested_in,
    ownership: lead.ownership,
    property_type: lead.property_type,
    state: lead.state,
    response_speed_seconds: data.connected ? 30 : null,
  });

  const $set: Record<string, unknown> = {
    status: nextStatus,
    last_contacted_at: now,
    call_logs: [...(Array.isArray(lead.call_logs) ? lead.call_logs : []), callEntry],
    timeline: pushTimeline(lead.timeline, {
      type: "call",
      title: data.connected ? "Call Connected" : "Call Attempt",
      detail: callEntry.remark || (data.connected ? "Connected" : "Not connected"),
      by: data.actorId ?? null,
    }),
    score,
    score_tier: tier,
  };

  if (data.next_follow_up_at) {
    $set.next_follow_up_at = new Date(data.next_follow_up_at);
  }

  await leadRepository.updateMany({ id: leadId }, { $set });
  return leadRepository.findOne({ id: leadId }, { lean: true });
}

export async function assignLeadsRoundRobin(opts: {
  leadIds?: number[];
  salespersonIds: number[];
  actorId?: number | null;
}) {
  const salespersonIds = (opts.salespersonIds || []).map(Number).filter(Boolean);
  if (!salespersonIds.length) throw new Error("At least one salesperson is required");

  let leads: any[] = [];
  if (opts.leadIds?.length) {
    leads = await leadRepository.find({ id: { $in: opts.leadIds.map(Number) } }, {
      lean: true,
      sort: { created_at: 1 },
    });
  } else {
    leads = await leadRepository.find(
      {
        $and: [
          { $or: [{ owner_id: null }, { owner_id: { $exists: false } }] },
          { status: { $in: ["NEW_LEAD", "AI_QUALIFIED"] } },
        ],
      },
      { lean: true, sort: { created_at: 1 }, limit: 200 },
    );
  }

  const assignments: Record<number, number[]> = {};
  for (const sid of salespersonIds) assignments[sid] = [];

  let i = 0;
  const now = new Date();
  for (const lead of leads) {
    const sid = salespersonIds[i % salespersonIds.length];
    assignments[sid].push(lead.id);
    await leadRepository.updateMany(
      { id: lead.id },
      {
        $set: {
          owner_id: sid,
          assigned_at: now,
          status: lead.status === "NEW_LEAD" || lead.status === "AI_QUALIFIED" ? "ASSIGNED" : lead.status,
          timeline: pushTimeline(lead.timeline, {
            type: "assign",
            title: "Lead Assigned",
            detail: `Assigned to salesperson #${sid}`,
            by: opts.actorId ?? null,
          }),
        },
      },
    );
    i += 1;
  }

  // notify salespeople
  for (const sid of salespersonIds) {
    const count = assignments[sid]?.length || 0;
    if (!count) continue;
    await notificationController.createNotification({
      userId: sid,
      message: `${count} new lead${count === 1 ? "" : "s"} assigned to you.`,
      route: `${process.env.FRONT_URL}/#/leads`,
      meta: { type: "LEAD", count },
    }).catch(() => undefined);
  }

  return {
    assigned_total: leads.length,
    by_salesperson: Object.entries(assignments).map(([id, ids]) => ({
      salesperson_id: Number(id),
      count: ids.length,
      lead_ids: ids,
    })),
  };
}

export async function runLeadSupervisor(opts: { reassign?: boolean; hours?: number } = {}) {
  const hours = opts.hours ?? 24;
  const cutoff = new Date(Date.now() - hours * 3600000);
  const stale: any[] = await leadRepository.find(
    {
      owner_id: { $ne: null },
      assigned_at: { $lte: cutoff },
      $or: [{ last_contacted_at: null }, { last_contacted_at: { $exists: false } }, { last_contacted_at: { $lte: cutoff } }],
      status: {
        $nin: ["ACCEPTED", "COMPLETED", "CANCELLED", "LOST", "DUPLICATE", "DEPOSIT_PAID", "INSTALLED"],
      },
    },
    { lean: true, limit: 100 },
  );

  const managerRoles: any[] = await roleRepository.find(
    { name: { $in: [Roles.ADMIN, Roles.MANAGER, Roles.SUPER_ADMIN, Roles.CEO] } },
    { select: "id", lean: true },
  );
  const roleIds = managerRoles.map((r) => r.id).filter(Boolean);
  const managers: any[] =
    roleIds.length > 0
      ? await userRepository.find({ role_id: { $in: roleIds } }, { select: "id", lean: true, limit: 20 })
      : [];

  for (const lead of stale) {
    const msg = `Lead #${lead.id} (${lead.name}) has no action for ${hours}+ hours.`;
    if (lead.owner_id) {
      await notificationController
        .createNotification({
          userId: lead.owner_id,
          message: `Reminder: ${msg}`,
          route: `${process.env.FRONT_URL}/#/leads`,
          meta: { type: "LEAD_SUPERVISOR", lead_id: lead.id },
        })
        .catch(() => undefined);
    }
    for (const m of managers) {
      await notificationController
        .createNotification({
          userId: m.id,
          message: `Manager Alert: ${msg}`,
          route: `${process.env.FRONT_URL}/#/leads`,
          meta: { type: "LEAD_SUPERVISOR", lead_id: lead.id },
        })
        .catch(() => undefined);
    }

    await leadRepository.updateMany(
      { id: lead.id },
      {
        $set: {
          timeline: pushTimeline(lead.timeline, {
            type: "supervisor",
            title: "AI Supervisor Alert",
            detail: msg,
          }),
        },
      },
    );
  }

  return { stale_count: stale.length, lead_ids: stale.map((l) => l.id), reassign: !!opts.reassign };
}

export async function getLeadManagementDashboard(user: { id: number; role: string }) {
  const isAdmin = isLeadAdminRole(user.role);

  const filter: Record<string, unknown> = {};
  if (!isAdmin) filter.owner_id = user.id;

  const leads: any[] = await leadRepository.find(filter, {
    select:
      "id name phone email status source score score_tier owner_id next_follow_up_at created_at last_contacted_at assigned_at",
    lean: true,
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const overdueCutoff = new Date(Date.now() - 24 * 3600000);

  const buckets: Record<string, number> = {
    new_leads: 0,
    todays_followups: 0,
    hot_leads: 0,
    call_back_today: 0,
    quote_pending: 0,
    quote_sent: 0,
    accepted: 0,
    cancelled: 0,
    installation: 0,
    completed: 0,
    review_pending: 0,
    referral_pending: 0,
    unassigned: 0,
    overdue_followups: 0,
  };

  for (const l of leads) {
    if (l.status === "NEW_LEAD" || l.status === "AI_QUALIFIED") buckets.new_leads += 1;
    if (l.score_tier === "HOT") buckets.hot_leads += 1;
    if (!l.owner_id) buckets.unassigned += 1;

    if (l.next_follow_up_at) {
      const fu = new Date(l.next_follow_up_at);
      if (fu >= todayStart && fu <= todayEnd) {
        buckets.todays_followups += 1;
        buckets.call_back_today += 1;
      }
      if (fu < todayStart) buckets.overdue_followups += 1;
    } else if (
      l.assigned_at &&
      new Date(l.assigned_at) < overdueCutoff &&
      !["ACCEPTED", "COMPLETED", "CANCELLED", "LOST", "DUPLICATE"].includes(l.status)
    ) {
      buckets.overdue_followups += 1;
    }

    if (["QUOTE_REQUESTED", "NEED_FOLLOW_UP", "INTERESTED", "VERY_INTERESTED", "CONNECTED"].includes(l.status)) {
      buckets.quote_pending += 1;
    }
    if (["QUOTE_SENT", "QUOTE_VIEWED", "NEGOTIATION"].includes(l.status)) buckets.quote_sent += 1;
    if (["ACCEPTED", "DEPOSIT_PENDING", "DEPOSIT_PAID"].includes(l.status)) buckets.accepted += 1;
    if (["CANCELLED", "LOST", "DUPLICATE"].includes(l.status)) buckets.cancelled += 1;
    if (
      ["STOCK_ORDERED", "DELIVERY_SCHEDULED", "INSTALLATION_SCHEDULED", "INSTALLED", "GRID_PENDING", "GRID_APPROVED"].includes(
        l.status,
      )
    ) {
      buckets.installation += 1;
    }
    if (l.status === "COMPLETED") buckets.completed += 1;
    if (["REVIEW_REQUESTED"].includes(l.status)) buckets.review_pending += 1;
    if (["REVIEW_RECEIVED", "REFERRAL_RECEIVED"].includes(l.status)) buckets.referral_pending += 1;
  }

  let team: any[] = [];
  if (isAdmin) {
    const owners = [...new Set(leads.map((l) => l.owner_id).filter(Boolean))];
    const users =
      owners.length > 0
        ? await userRepository.find({ id: { $in: owners } }, { select: "id name", lean: true })
        : [];
    const nameMap = Object.fromEntries(users.map((u: any) => [u.id, u.name]));
    const byOwner: Record<number, any> = {};
    for (const l of leads) {
      if (!l.owner_id) continue;
      if (!byOwner[l.owner_id]) {
        byOwner[l.owner_id] = {
          owner_id: l.owner_id,
          name: nameMap[l.owner_id] || `User #${l.owner_id}`,
          assigned: 0,
          called: 0,
          pending: 0,
          quotes: 0,
          sales: 0,
        };
      }
      byOwner[l.owner_id].assigned += 1;
      if (l.last_contacted_at) byOwner[l.owner_id].called += 1;
      if (["NEW_LEAD", "AI_QUALIFIED", "ASSIGNED", "NEED_FOLLOW_UP"].includes(l.status)) {
        byOwner[l.owner_id].pending += 1;
      }
      if (["QUOTE_SENT", "QUOTE_VIEWED", "NEGOTIATION"].includes(l.status)) byOwner[l.owner_id].quotes += 1;
      if (["ACCEPTED", "DEPOSIT_PAID", "COMPLETED"].includes(l.status)) byOwner[l.owner_id].sales += 1;
    }
    team = Object.values(byOwner)
      .map((t: any) => ({
        ...t,
        conversion: t.assigned ? Math.round((t.sales / t.assigned) * 1000) / 10 : 0,
      }))
      .sort((a: any, b: any) => b.sales - a.sales || b.conversion - a.conversion);
  }

  return {
    is_admin: isAdmin,
    totals: buckets,
    team_monitoring: team,
    alert: {
      overdue_followups: buckets.overdue_followups,
      message:
        buckets.overdue_followups > 0
          ? `${buckets.overdue_followups} customers need follow-up attention.`
          : "No overdue follow-ups.",
    },
  };
}
