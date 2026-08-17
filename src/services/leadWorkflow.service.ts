import {
  buildAiLeadSummary,
  buildFollowUpScripts,
  buildQualificationThanksMessage,
  buildWelcomeMessage,
  buyingIntentFromScore,
  computeLeadScore,
  conversionProbabilityFromScore,
  LEAD_STATUSES,
  publicLeadId,
  type LeadStatus,
} from "@constants/leadPipeline.constants";
import { getCompanyConfig } from "@services/crmSettings.service";
import { leadRepository, roleRepository, userRepository } from "@repositories";
import { Roles } from "src/data/dataInserter";
import notificationController from "@controllers/notification.controller";
import { applyLeadScope, getLeadAccess, isLeadAdminRole } from "@services/leadAccess.service";
import { autoAssignLead, getDistributionSettings, pickBestAgent } from "@services/leadDistribution.service";

export { isLeadAdminRole } from "@services/leadAccess.service";

function pushTimeline(existing: any[] | undefined, entry: Record<string, unknown>) {
  const list = Array.isArray(existing) ? [...existing] : [];
  list.push({ ...entry, at: new Date() });
  return list;
}

export function suggestNextBestAction(lead: any): string {
  if (!lead?.owner_id) return "Call customer within 30 minutes after assignment.";
  if (["NEW_LEAD", "AI_QUALIFIED", "ASSIGNED"].includes(lead.status) && !lead.last_contacted_at) {
    return "Call customer within 30 minutes.";
  }
  if (lead.next_follow_up_at && new Date(lead.next_follow_up_at) <= new Date()) return "Complete overdue follow-up now.";
  if (["CONNECTED", "INTERESTED", "VERY_INTERESTED", "NEED_FOLLOW_UP"].includes(lead.status)) {
    return "Send quote and schedule callback.";
  }
  if (["QUOTE_SENT", "QUOTE_VIEWED"].includes(lead.status)) return "Follow up on quote and handle objections.";
  if (lead.status === "NEGOTIATION") return "Negotiate / close deal.";
  if (lead.status === "ACCEPTED" || lead.status === "DEPOSIT_PENDING" || lead.status === "FINANCE_PENDING") {
    return "Progress finance / collect deposit.";
  }
  if (Array.isArray(lead.interested_in) && lead.interested_in.includes("Battery") && ["HOT", "VERY_HOT"].includes(lead.score_tier)) {
    return "Send battery comparison and book a 6 PM callback.";
  }
  if (!lead.bill_range) return "Request a recent electricity bill.";
  if (["CALL_ATTEMPT_1", "CALL_ATTEMPT_2", "NOT_REACHABLE", "VOICEMAIL"].includes(lead.status)) {
    return "Retry call and send WhatsApp if no answer.";
  }
  return "Update lead status and set next follow-up.";
}

export function enrichLead(lead: any) {
  if (!lead) return lead;
  const next = suggestNextBestAction(lead);
  const scripts = buildFollowUpScripts({ ...lead, next_best_action: next });
  const received = lead.received_at || lead.created_at;
  const first = lead.first_contacted_at || lead.last_contacted_at;
  const response_seconds =
    lead.response_seconds ??
    (received && first ? Math.max(0, Math.round((new Date(first).getTime() - new Date(received).getTime()) / 1000)) : null);
  return {
    ...lead,
    public_id: lead.public_id || (lead.id ? publicLeadId(lead.id) : null),
    next_best_action: lead.recommended_action || next,
    recommended_action: lead.recommended_action || next,
    buying_intent: lead.buying_intent || buyingIntentFromScore(Number(lead.score) || 0),
    conversion_probability: lead.conversion_probability || conversionProbabilityFromScore(Number(lead.score) || 0),
    ai_summary: lead.ai_summary || buildAiLeadSummary(lead),
    follow_up_scripts: scripts,
    response_timer: {
      received_at: received || null,
      assigned_at: lead.assigned_at || null,
      first_contact_at: first || null,
      response_seconds,
    },
  };
}

export async function findDuplicateLeads(input: {
  phone?: string;
  email?: string;
  name?: string;
  address?: string;
  excludeId?: number;
}) {
  const or: Record<string, unknown>[] = [];
  if (input.phone) or.push({ phone: String(input.phone).trim() });
  if (input.email) or.push({ email: String(input.email).trim().toLowerCase() });
  if (input.name && input.address) {
    or.push({
      $and: [
        { name: { $regex: `^${String(input.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        { address: { $regex: String(input.address).slice(0, 24), $options: "i" } },
      ],
    });
  }
  if (!or.length) return [];
  const filter: Record<string, unknown> = { $or: or, merged_into_id: null };
  if (input.excludeId) filter.id = { $ne: input.excludeId };
  return leadRepository.find(filter, {
    select: "id public_id name phone email status source created_at owner_id",
    lean: true,
    limit: 10,
  });
}

export async function createEnquiryLead(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  country?: string;
  source?: string;
  campaign_name?: string;
  ad_name?: string;
  landing_page?: string;
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
  created_by?: number | null;
  solar_requirement?: string;
  battery_requirement?: string;
  solar_system_size?: string;
  battery_size?: string;
  existing_inverter?: string;
  customer_type?: string;
  purchase_timeframe?: string;
  installation_location?: string;
  estimated_system_value?: number;
  estimated_sales_value?: number;
  external_id?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
  skip_auto_assign?: boolean;
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
    purchase_timeframe: input.purchase_timeframe,
    estimated_sales_value: input.estimated_sales_value,
  });
  const nextAction = !input.skip_auto_assign
    ? "Call customer within 30 minutes."
    : "Assign Lead";
  const summary = buildAiLeadSummary(input);

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
    suburb: input.suburb || "",
    postcode: input.postcode || "",
    state: input.state || "",
    country: input.country || "Australia",
    note: input.note || "",
    source: input.source || "Website",
    campaign_name: input.campaign_name || "",
    ad_name: input.ad_name || "",
    landing_page: input.landing_page || "",
    status,
    score,
    score_tier: tier,
    buying_intent: buyingIntentFromScore(score),
    conversion_probability: conversionProbabilityFromScore(score),
    ai_summary: summary,
    recommended_action: nextAction,
    property_type: input.property_type || "",
    ownership: input.ownership || "",
    bill_range: input.bill_range || "",
    current_system: input.current_system || "",
    interested_in: input.interested_in || [],
    roof_type: input.roof_type || "",
    best_time_to_call: input.best_time_to_call || "",
    preferred_contact: input.preferred_contact || "WhatsApp",
    language: input.language || "English",
    solar_requirement: input.solar_requirement || "",
    battery_requirement: input.battery_requirement || "",
    solar_system_size: input.solar_system_size || "",
    battery_size: input.battery_size || "",
    existing_inverter: input.existing_inverter || "",
    customer_type: input.customer_type || "",
    purchase_timeframe: input.purchase_timeframe || "",
    installation_location: input.installation_location || input.suburb || "",
    estimated_system_value: Number(input.estimated_system_value) || 0,
    estimated_sales_value: Number(input.estimated_sales_value) || 0,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    received_at: now,
    created_by: input.created_by || null,
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
    notes: [],
    transfers: [],
    audit_log: [
      {
        type: "created",
        detail: `Lead created from ${input.source || "Website"}`,
        at: now,
        by: input.created_by || null,
      },
    ],
    cf_id: input.cf_id || null,
    popup_id: input.popup_id || null,
    external_id: input.external_id || null,
    utm_source: input.utm_source || "",
    utm_campaign: input.utm_campaign || "",
    utm_medium: input.utm_medium || "",
  };

  const duplicates = await findDuplicateLeads({
    phone: input.phone,
    email: input.email,
    name: input.name,
    address: input.address,
  });
  if (duplicates.length) {
    (payload.timeline as any[]).push({
      type: "duplicate_hint",
      title: "Possible Duplicate Detected",
      detail: `Matches ${duplicates.length} existing lead(s)`,
      at: now,
    });
  }

  const lead = await leadRepository.create(payload);
  const leadId = (lead as any).id;
  await leadRepository.updateMany(
    { id: leadId },
    { $set: { public_id: publicLeadId(leadId) } },
  );

  let assignedLead: any = await leadRepository.findOne({ id: leadId }, { lean: true });
  if (!input.skip_auto_assign) {
    const settings = await getDistributionSettings();
    if (settings.enabled && settings.mode !== "manual") {
      const result = await autoAssignLead(assignedLead, input.created_by || null);
      assignedLead = result.lead;
    }
  }

  return {
    lead: assignedLead,
    welcome_message: welcome,
    thanks_message: hasQualification ? thanks : null,
    duplicates,
    next_best_action: suggestNextBestAction(assignedLead),
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

  if (data.connected && !lead.first_contacted_at) {
    $set.first_contacted_at = now;
    if (lead.received_at || lead.created_at) {
      $set.response_seconds = Math.max(
        0,
        Math.round((now.getTime() - new Date(lead.received_at || lead.created_at).getTime()) / 1000),
      );
    }
  }

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
  const settings = await getDistributionSettings();
  const l1h = opts.hours ?? settings.follow_up_l1_hours ?? 2;
  const l2h = settings.follow_up_l2_hours ?? 6;
  const l3h = settings.follow_up_l3_hours ?? 24;
  const now = Date.now();
  const stale: any[] = await leadRepository.find(
    {
      owner_id: { $ne: null },
      $or: [{ last_contacted_at: null }, { last_contacted_at: { $exists: false } }],
      assigned_at: { $lte: new Date(now - l1h * 3600000) },
      status: {
        $nin: ["ACCEPTED", "COMPLETED", "CANCELLED", "LOST", "DUPLICATE", "DEPOSIT_PAID", "INSTALLED", "WON"],
      },
    },
    { lean: true, limit: 150 },
  );

  const managerRoles: any[] = await roleRepository.find(
    { name: { $in: [Roles.ADMIN, Roles.SUPER_ADMIN, Roles.CEO] } },
    { select: "id", lean: true },
  );
  const roleIds = managerRoles.map((r) => r.id).filter(Boolean);
  const managers: any[] =
    roleIds.length > 0
      ? await userRepository.find({ role_id: { $in: roleIds } }, { select: "id", lean: true, limit: 20 })
      : [];

  let reassigned = 0;
  for (const lead of stale) {
    const assignedAgo = lead.assigned_at ? (now - new Date(lead.assigned_at).getTime()) / 3600000 : 0;
    const level = assignedAgo >= l3h ? 3 : assignedAgo >= l2h ? 2 : 1;
    const msg = `Lead ${lead.public_id || `#${lead.id}`} (${lead.name}) uncontacted for ${Math.round(assignedAgo)}h — Level ${level}.`;

    if (lead.owner_id) {
      await notificationController
        .createNotification({
          userId: lead.owner_id,
          message: `Follow-up L${level}: ${msg}`,
          route: `${process.env.FRONT_URL}/#/leads`,
          meta: { type: "LEAD_FOLLOWUP", lead_id: lead.id, level },
        })
        .catch(() => undefined);
    }
    if (level >= 2 && lead.team_leader_id) {
      await notificationController
        .createNotification({
          userId: lead.team_leader_id,
          message: `Team Leader L${level}: ${msg}`,
          route: `${process.env.FRONT_URL}/#/leads`,
          meta: { type: "LEAD_FOLLOWUP", lead_id: lead.id, level },
        })
        .catch(() => undefined);
    }
    if (level >= 3) {
      for (const m of managers) {
        await notificationController
          .createNotification({
            userId: m.id,
            message: `Admin L3: ${msg}`,
            route: `${process.env.FRONT_URL}/#/leads`,
            meta: { type: "LEAD_FOLLOWUP", lead_id: lead.id, level },
          })
          .catch(() => undefined);
      }
    }

    const doReassign = opts.reassign || (settings.auto_reassign && !settings.notify_only && level >= 3);
    if (doReassign) {
      const pick = await pickBestAgent({ ...lead, owner_id: null });
      if (pick && pick.user_id !== lead.owner_id) {
        await leadRepository.updateMany(
          { id: lead.id },
          {
            $set: {
              previous_owner_id: lead.owner_id,
              owner_id: pick.user_id,
              assigned_at: new Date(),
              timeline: pushTimeline(lead.timeline, {
                type: "reassign",
                title: "Smart Reassignment",
                detail: msg,
              }),
            },
          },
        );
        reassigned += 1;
        continue;
      }
    }

    await leadRepository.updateMany(
      { id: lead.id },
      {
        $set: {
          timeline: pushTimeline(lead.timeline, {
            type: "supervisor",
            title: `AI Supervisor L${level}`,
            detail: msg,
          }),
        },
      },
    );
  }

  return { stale_count: stale.length, lead_ids: stale.map((l) => l.id), reassigned, reassign: !!opts.reassign };
}

export async function getLeadManagementDashboard(user: { id: number; role: string; role_id?: number }) {
  const access = await getLeadAccess(user);
  const filter: Record<string, unknown> = {};
  applyLeadScope(filter, access);

  const leads: any[] = await leadRepository.find(filter, {
    select:
      "id name phone email status source score score_tier owner_id next_follow_up_at created_at last_contacted_at assigned_at estimated_sales_value transfers",
    lean: true,
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const overdueCutoff = new Date(Date.now() - 24 * 3600000);

  const buckets: Record<string, number> = {
    total: leads.length,
    new_leads: 0,
    untouched: 0,
    todays_followups: 0,
    hot_leads: 0,
    call_back_today: 0,
    quote_pending: 0,
    quote_sent: 0,
    qualified: 0,
    accepted: 0,
    won: 0,
    lost: 0,
    cancelled: 0,
    installation: 0,
    completed: 0,
    review_pending: 0,
    referral_pending: 0,
    unassigned: 0,
    overdue_followups: 0,
    revenue: 0,
  };

  for (const l of leads) {
    if (l.status === "NEW_LEAD" || l.status === "AI_QUALIFIED") buckets.new_leads += 1;
    if (!l.last_contacted_at && ["NEW_LEAD", "AI_QUALIFIED", "ASSIGNED"].includes(l.status)) buckets.untouched += 1;
    if (l.score_tier === "HOT" || l.score_tier === "VERY_HOT") buckets.hot_leads += 1;
    if (!l.owner_id) buckets.unassigned += 1;
    if (["INTERESTED", "VERY_INTERESTED"].includes(l.status)) buckets.qualified += 1;
    buckets.revenue += Number(l.estimated_sales_value) || 0;

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
      !["ACCEPTED", "COMPLETED", "CANCELLED", "LOST", "DUPLICATE", "WON"].includes(l.status)
    ) {
      buckets.overdue_followups += 1;
    }

    if (["QUOTE_REQUESTED", "NEED_FOLLOW_UP", "INTERESTED", "VERY_INTERESTED", "CONNECTED"].includes(l.status)) {
      buckets.quote_pending += 1;
    }
    if (["QUOTE_SENT", "QUOTE_VIEWED", "NEGOTIATION"].includes(l.status)) buckets.quote_sent += 1;
    if (["ACCEPTED", "DEPOSIT_PENDING", "DEPOSIT_PAID"].includes(l.status)) buckets.accepted += 1;
    if (["WON", "COMPLETED", "ACCEPTED"].includes(l.status)) buckets.won += 1;
    if (["CANCELLED", "LOST", "DUPLICATE", "UNQUALIFIED"].includes(l.status)) buckets.lost += 1;
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

  const won = buckets.won || 0;
  const conversion = leads.length ? Math.round((won / leads.length) * 1000) / 10 : 0;

  let team: any[] = [];
  if (access.scope !== "self") {
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
          revenue: 0,
        };
      }
      byOwner[l.owner_id].assigned += 1;
      if (l.last_contacted_at) byOwner[l.owner_id].called += 1;
      if (["NEW_LEAD", "AI_QUALIFIED", "ASSIGNED", "NEED_FOLLOW_UP"].includes(l.status)) {
        byOwner[l.owner_id].pending += 1;
      }
      if (["QUOTE_SENT", "QUOTE_VIEWED", "NEGOTIATION"].includes(l.status)) byOwner[l.owner_id].quotes += 1;
      if (["ACCEPTED", "DEPOSIT_PAID", "COMPLETED", "WON"].includes(l.status)) byOwner[l.owner_id].sales += 1;
      byOwner[l.owner_id].revenue += Number(l.estimated_sales_value) || 0;
    }
    team = Object.values(byOwner)
      .map((t: any) => ({
        ...t,
        contact_rate: t.assigned ? Math.round((t.called / t.assigned) * 1000) / 10 : 0,
        conversion: t.assigned ? Math.round((t.sales / t.assigned) * 1000) / 10 : 0,
        insight:
          t.assigned && t.called / t.assigned > 0.8 && t.sales / t.assigned < 0.12
            ? `${t.name} has strong contact performance but lower quote-to-sale conversion. Review pricing objections.`
            : `${t.name}: ${t.sales} sales from ${t.assigned} leads.`,
      }))
      .sort((a: any, b: any) => b.sales - a.sales || b.conversion - a.conversion);
  }

  return {
    is_admin: access.is_admin,
    is_team_leader: access.is_team_leader,
    scope: access.scope,
    totals: { ...buckets, conversion },
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

export async function addLeadNote(
  leadId: number,
  data: { type?: string; body: string; actorId?: number | null; actorName?: string },
) {
  const lead: any = await leadRepository.findOne({ id: leadId }, { lean: true });
  if (!lead) throw new Error("Lead not found");
  const entry = {
    type: data.type || "Customer Notes",
    body: String(data.body || "").trim(),
    by: data.actorId ?? null,
    by_name: data.actorName || "",
    at: new Date(),
  };
  if (!entry.body) throw new Error("Note is required");
  await leadRepository.updateMany(
    { id: leadId },
    {
      $set: {
        notes: [...(Array.isArray(lead.notes) ? lead.notes : []), entry],
        timeline: pushTimeline(lead.timeline, {
          type: "note",
          title: entry.type,
          detail: entry.body.slice(0, 180),
          by: entry.by,
        }),
      },
    },
  );
  return leadRepository.findOne({ id: leadId }, { lean: true });
}

export async function transferLead(
  leadId: number,
  data: {
    to_user_id: number;
    reason: string;
    note: string;
    actorId?: number | null;
    actorName?: string;
  },
) {
  const lead: any = await leadRepository.findOne({ id: leadId }, { lean: true });
  if (!lead) throw new Error("Lead not found");
  if (!data.to_user_id) throw new Error("New salesperson is required");
  if (!String(data.note || "").trim()) throw new Error("Transfer note is required");
  const now = new Date();
  const transfer = {
    from_user_id: lead.owner_id || null,
    to_user_id: Number(data.to_user_id),
    reason: data.reason || "Other",
    note: String(data.note).trim(),
    at: now,
    by: data.actorId ?? null,
    by_name: data.actorName || "",
    accepted: true,
    conversation_status: lead.status,
  };
  await leadRepository.updateMany(
    { id: leadId },
    {
      $set: {
        previous_owner_id: lead.owner_id || null,
        owner_id: Number(data.to_user_id),
        assigned_at: now,
        transfers: [...(Array.isArray(lead.transfers) ? lead.transfers : []), transfer],
        timeline: pushTimeline(lead.timeline, {
          type: "transfer",
          title: "Lead Transferred",
          detail: `${transfer.reason}: ${transfer.note}`,
          by: data.actorId ?? null,
        }),
        audit_log: [
          ...(Array.isArray(lead.audit_log) ? lead.audit_log : []),
          {
            type: "transfer",
            detail: `${data.actorName || "User"} transferred lead to #${data.to_user_id}`,
            previous: lead.owner_id,
            next: data.to_user_id,
            at: now,
            by: data.actorId ?? null,
          },
        ],
      },
    },
  );
  await notificationController
    .createNotification({
      userId: Number(data.to_user_id),
      message: `Lead ${lead.public_id || `#${lead.id}`} transferred to you.`,
      route: `${process.env.FRONT_URL}/#/leads`,
      meta: { type: "LEAD_TRANSFERRED", lead_id: lead.id },
    })
    .catch(() => undefined);
  return leadRepository.findOne({ id: leadId }, { lean: true });
}

export async function resolveDuplicate(
  leadId: number,
  data: { action: "merge" | "keep" | "link"; target_id: number; actorId?: number | null },
) {
  const lead: any = await leadRepository.findOne({ id: leadId }, { lean: true });
  const target: any = await leadRepository.findOne({ id: Number(data.target_id) }, { lean: true });
  if (!lead || !target) throw new Error("Lead not found");
  if (data.action === "keep") {
    await leadRepository.updateMany(
      { id: leadId },
      {
        $set: {
          timeline: pushTimeline(lead.timeline, {
            type: "duplicate",
            title: "Kept Separate",
            detail: `Kept separate from #${target.id}`,
            by: data.actorId ?? null,
          }),
        },
      },
    );
    return leadRepository.findOne({ id: leadId }, { lean: true });
  }
  if (data.action === "link") {
    const linked = [...new Set([...(lead.linked_lead_ids || []), target.id])];
    await leadRepository.updateMany(
      { id: leadId },
      {
        $set: {
          linked_lead_ids: linked,
          timeline: pushTimeline(lead.timeline, {
            type: "duplicate",
            title: "Records Linked",
            detail: `Linked to #${target.id}`,
            by: data.actorId ?? null,
          }),
        },
      },
    );
    return leadRepository.findOne({ id: leadId }, { lean: true });
  }
  await leadRepository.updateMany(
    { id: leadId },
    {
      $set: {
        merged_into_id: target.id,
        status: "DUPLICATE",
        timeline: pushTimeline(lead.timeline, {
          type: "duplicate",
          title: "Merged",
          detail: `Merged into ${target.public_id || `#${target.id}`}`,
          by: data.actorId ?? null,
        }),
      },
    },
  );
  await leadRepository.updateMany(
    { id: target.id },
    {
      $set: {
        linked_lead_ids: [...new Set([...(target.linked_lead_ids || []), lead.id])],
        timeline: pushTimeline(target.timeline, {
          type: "duplicate",
          title: "Duplicate Merged In",
          detail: `Merged ${lead.public_id || `#${lead.id}`}`,
          by: data.actorId ?? null,
        }),
      },
    },
  );
  return leadRepository.findOne({ id: target.id }, { lean: true });
}

export async function getSourceAnalytics(accessFilter: Record<string, unknown>) {
  const leads: any[] = await leadRepository.find(accessFilter, {
    select: "source status estimated_sales_value score_tier",
    lean: true,
  });
  const by: Record<string, any> = {};
  for (const l of leads) {
    const src = l.source || "Other";
    if (!by[src]) {
      by[src] = { source: src, total: 0, contacted: 0, qualified: 0, quotes: 0, sales: 0, revenue: 0 };
    }
    by[src].total += 1;
    if (l.status && !["NEW_LEAD", "AI_QUALIFIED", "ASSIGNED"].includes(l.status)) by[src].contacted += 1;
    if (["INTERESTED", "VERY_INTERESTED"].includes(l.status)) by[src].qualified += 1;
    if (["QUOTE_SENT", "QUOTE_VIEWED", "NEGOTIATION"].includes(l.status)) by[src].quotes += 1;
    if (["ACCEPTED", "WON", "COMPLETED", "DEPOSIT_PAID"].includes(l.status)) by[src].sales += 1;
    by[src].revenue += Number(l.estimated_sales_value) || 0;
  }
  return Object.values(by).map((s: any) => ({
    ...s,
    conversion: s.total ? Math.round((s.sales / s.total) * 1000) / 10 : 0,
    avg_sale: s.sales ? Math.round(s.revenue / s.sales) : 0,
  }));
}

export async function runLeadCommand(user: { id: number; role: string }, prompt: string) {
  const access = await getLeadAccess(user);
  const q = String(prompt || "").toLowerCase();
  const filter: Record<string, unknown> = {};
  applyLeadScope(filter, access);
  const now = Date.now();

  if (q.includes("uncontacted") || q.includes("untouched") || q.includes("no contact")) {
    const hours = q.includes("48") ? 48 : 24;
    const rows = await leadRepository.find(
      {
        ...filter,
        $or: [{ last_contacted_at: null }, { last_contacted_at: { $exists: false } }],
        created_at: { $lte: new Date(now - hours * 3600000) },
      },
      { select: "id public_id name phone status suburb owner_id created_at", lean: true, limit: 50 },
    );
    return { answer: `${rows.length} uncontacted lead(s) older than ${hours}h.`, leads: rows };
  }
  if (q.includes("hot") && (q.includes("melbourne") || q.includes("vic"))) {
    const rows = await leadRepository.find(
      { ...filter, score_tier: { $in: ["HOT", "VERY_HOT"] }, $or: [{ state: /VIC/i }, { suburb: /melbourne/i }] },
      { select: "id public_id name phone suburb score status", lean: true, limit: 50 },
    );
    return { answer: `${rows.length} hot lead(s) in Melbourne / VIC.`, leads: rows };
  }
  if (q.includes("follow-up") || q.includes("follow up")) {
    const rows = await leadRepository.find(
      { ...filter, next_follow_up_at: { $lte: new Date() } },
      { select: "id public_id name phone next_follow_up_at owner_id", lean: true, limit: 50 },
    );
    return { answer: `${rows.length} pending follow-up(s).`, leads: rows };
  }
  if (q.includes("source") && q.includes("sales")) {
    const analytics = await getSourceAnalytics(filter);
    const top = [...analytics].sort((a, b) => b.sales - a.sales)[0];
    return { answer: top ? `${top.source} generated the most sales (${top.sales}).` : "No source sales yet.", analytics };
  }
  if (q.includes("convert") || q.includes("likely")) {
    const rows = await leadRepository.find(
      { ...filter, score: { $gte: 75 }, status: { $nin: ["WON", "LOST", "CANCELLED", "COMPLETED"] } },
      { select: "id public_id name score score_tier status", lean: true, limit: 40, sort: { score: -1 } },
    );
    return { answer: `${rows.length} high-intent lead(s) likely to convert.`, leads: rows };
  }
  if (q.includes("distribute") || q.includes("reassign")) {
    if (!access.is_admin && !access.is_team_leader) {
      return { answer: "You do not have permission to distribute or reassign leads.", needs_confirmation: false };
    }
    return {
      answer: "This will run AI distribution / reassignment. Confirm to execute.",
      needs_confirmation: true,
      action: q.includes("reassign") ? "reassign_inactive" : "distribute_new",
    };
  }
  const recent = await leadRepository.find(filter, {
    select: "id public_id name status score_tier",
    lean: true,
    limit: 8,
    sort: { created_at: -1 },
  });
  return { answer: "Showing latest leads in your scope. Try: uncontacted, hot Melbourne, follow-ups, or source sales.", leads: recent };
}
