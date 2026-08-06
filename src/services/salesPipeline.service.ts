import { QuoteCustomerStatus } from "@constants/common.enum";
import { QuotePipelineStatus, normalizePipelineStatus } from "@constants/quotePipeline.constants";
import { Roles } from "src/data/dataInserter";
import {
  invoiceRepository,
  quoteRepository,
  stockOrderRepository,
  visitorLogsRepository,
} from "@repositories";

export type SalesPipelineScope = {
  userId: number;
  role: string;
  isAdmin: boolean;
};

function isAdminRole(role: string) {
  return (
    role === Roles.SUPER_ADMIN ||
    role === Roles.CUSTOMER_SUPPORT_EXECUTIVE ||
    role === Roles.CEO ||
    role === Roles.ADMIN ||
    role === Roles.MANAGER
  );
}

function quoteBaseFilter(scope: SalesPipelineScope, start?: Date | null, end?: Date | null) {
  const filter: Record<string, unknown> = {
    is_solar_sketch: { $ne: true },
  };
  if (!scope.isAdmin) {
    filter.$or = [{ sender_id: scope.userId }, { customer_id: scope.userId }];
  }
  if (start || end) {
    const created: Record<string, Date> = {};
    if (start) created.$gte = start;
    if (end) created.$lte = end;
    filter.created_at = created;
  }
  return filter;
}

function parseVisitorEngagement(log: any) {
  const visitors = Array.isArray(log?.logs) ? log.logs : [];
  let openCount = 0;
  let timeSpentMs = 0;
  let lastViewAt: Date | null = null;

  for (const visitor of visitors) {
    const sessions = Array.isArray(visitor?.sessions) ? visitor.sessions : [];
    for (const s of sessions) {
      openCount += 1;
      timeSpentMs += Number(s.timeSpentMs) || 0;
      const t = s.endTime || s.startTime;
      if (t) {
        const d = new Date(t);
        if (!Number.isNaN(d.getTime()) && (!lastViewAt || d > lastViewAt)) lastViewAt = d;
      }
    }
  }

  return { openCount, timeSpentMs, lastViewAt, viewed: openCount > 0 || visitors.length > 0 };
}

/** Interest 0–100 from opens, dwell time, follow-ups, recency */
export function computeInterestScore(input: {
  openCount: number;
  timeSpentMs: number;
  followUpCount: number;
  lastViewAt: Date | null;
  accepted?: boolean;
}) {
  const opens = Math.min(input.openCount, 20) * 2.5; // max 50
  const minutes = input.timeSpentMs / 60000;
  const dwell = Math.min(minutes, 30) * 1.2; // max 36
  const follow = Math.min(input.followUpCount || 0, 5) * 2; // max 10
  let recency = 0;
  if (input.lastViewAt) {
    const hours = (Date.now() - input.lastViewAt.getTime()) / 3600000;
    if (hours <= 24) recency = 15;
    else if (hours <= 72) recency = 10;
    else if (hours <= 168) recency = 5;
  }
  const acceptedBoost = input.accepted ? 10 : 0;
  return Math.min(100, Math.round(opens + dwell + follow + recency + acceptedBoost));
}

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000);
}

export async function buildSalesPerformancePipeline(
  user: { id: number; role: string },
  opts: { days?: number | null } = {},
) {
  const scope: SalesPipelineScope = {
    userId: user.id,
    role: user.role,
    isAdmin: isAdminRole(user.role),
  };

  const days = opts.days == null ? null : Number(opts.days);
  const start =
    days && !Number.isNaN(days) && days > 0
      ? new Date(Date.now() - days * 24 * 3600000)
      : null;

  const filter = quoteBaseFilter(scope, start, null);

  const quotes: any[] = await quoteRepository.find(filter, {
    select:
      "id name sender_id customer_id customer_accepted kanban_status total currency created_at follow_up_count last_follow_up_date_time accepted_date address mobile_no",
    populate: [
      { path: "customer", select: "id name email mobile_no" },
      { path: "sender", select: "id name email" },
    ],
    lean: true,
  });

  const quoteIds = quotes.map((q) => q.id);
  const [visitorLogs, stockOrders, paidInvoices]: any[] = await Promise.all([
    quoteIds.length
      ? visitorLogsRepository.find({ quote_id: { $in: quoteIds } }, { lean: true })
      : Promise.resolve([]),
    quoteIds.length
      ? stockOrderRepository.find(
          { quote_id: { $in: quoteIds }, deleted_at: null },
          { select: "id quote_id stock_order_status stock_delivered_date created_at", lean: true },
        )
      : Promise.resolve([]),
    quoteIds.length
      ? invoiceRepository.find(
          { quote_id: { $in: quoteIds }, pay_status: "PAID", deleted_at: null },
          { select: "id quote_id pay_status partialAmount", lean: true },
        )
      : Promise.resolve([]),
  ]);

  const visitorMap: Record<number, any> = {};
  for (const log of visitorLogs || []) visitorMap[log.quote_id] = log;

  const stockMap: Record<number, any> = {};
  for (const so of stockOrders || []) stockMap[so.quote_id] = so;

  const paidQuoteIds = new Set((paidInvoices || []).map((i: any) => i.quote_id));

  const assigned = quotes.length;
  let viewed = 0;
  let highInterest = 0;
  let accepted = 0;
  let rejected = 0;
  let installScheduled = 0;
  let completed = 0;
  let followUpPending = 0;
  let totalRevenue = 0;

  const highInterestRows: any[] = [];
  const actionBuckets: Record<
    string,
    { key: string; label: string; color: string; count: number; items: any[] }
  > = {
    not_viewed_48h: {
      key: "not_viewed_48h",
      label: "Quote not viewed (48 Hours)",
      color: "red",
      count: 0,
      items: [],
    },
    viewed_no_response_24h: {
      key: "viewed_no_response_24h",
      label: "Viewed but no response (24 Hours)",
      color: "red",
      count: 0,
      items: [],
    },
    accepted_deposit_pending: {
      key: "accepted_deposit_pending",
      label: "Accepted but Deposit Pending",
      color: "orange",
      count: 0,
      items: [],
    },
    stock_delivery_pending: {
      key: "stock_delivery_pending",
      label: "Stock Ordered but Delivery Pending",
      color: "orange",
      count: 0,
      items: [],
    },
    delivery_install_pending: {
      key: "delivery_install_pending",
      label: "Delivery Done but Installation Pending",
      color: "orange",
      count: 0,
      items: [],
    },
    install_review_pending: {
      key: "install_review_pending",
      label: "Installation Done but Review Pending",
      color: "green",
      count: 0,
      items: [],
    },
  };

  const pushItem = (bucket: string, q: any, extra: Record<string, unknown> = {}) => {
    const b = actionBuckets[bucket];
    if (!b) return;
    b.count += 1;
    if (b.items.length < 50) {
      b.items.push({
        id: q.id,
        name: q.name || q.customer?.name || `Quote #${q.id}`,
        email: q.customer?.email || "",
        mobile: q.mobile_no || q.customer?.mobile_no || "",
        sender: q.sender?.name || "",
        status: q.customer_accepted,
        kanban_status: q.kanban_status,
        created_at: q.created_at,
        ...extra,
      });
    }
  };

  const now48 = hoursAgo(48);
  const now24 = hoursAgo(24);

  for (const q of quotes) {
    const eng = parseVisitorEngagement(visitorMap[q.id]);
    const score = computeInterestScore({
      openCount: eng.openCount,
      timeSpentMs: eng.timeSpentMs,
      followUpCount: q.follow_up_count || 0,
      lastViewAt: eng.lastViewAt,
      accepted: q.customer_accepted === QuoteCustomerStatus.ACCEPTED,
    });

    if (eng.viewed) viewed += 1;
    if (score >= 70 && q.customer_accepted === QuoteCustomerStatus.PENDING) {
      highInterest += 1;
      highInterestRows.push({
        id: q.id,
        customer: q.name || q.customer?.name || `Quote #${q.id}`,
        email: q.customer?.email || "",
        interest_score: score,
        open_count: eng.openCount,
        time_spent_ms: eng.timeSpentMs,
        sender: q.sender?.name || "",
      });
    }

    if (q.customer_accepted === QuoteCustomerStatus.ACCEPTED) {
      accepted += 1;
      totalRevenue += Number(q.total) || 0;
    }
    if (
      q.customer_accepted === QuoteCustomerStatus.REJECTED ||
      q.customer_accepted === QuoteCustomerStatus.DEAD ||
      q.customer_accepted === QuoteCustomerStatus.EXPIRED
    ) {
      rejected += 1;
    }

    const pipe = normalizePipelineStatus(q.kanban_status) || q.kanban_status;
    if (pipe === QuotePipelineStatus.INSTALLATION_SCHEDULED || pipe === QuotePipelineStatus.INSTALLATION_IN_PROGRESS) {
      installScheduled += 1;
    }
    if (
      pipe === QuotePipelineStatus.INSTALLATION_COMPLETED ||
      pipe === QuotePipelineStatus.JOB_CLOSED ||
      pipe === QuotePipelineStatus.REBATE_RECEIVED
    ) {
      completed += 1;
    }

    const needsFollowUp =
      q.customer_accepted === QuoteCustomerStatus.PENDING &&
      (!q.last_follow_up_date_time || new Date(q.last_follow_up_date_time) < now24);
    if (needsFollowUp) followUpPending += 1;

    const createdAt = q.created_at ? new Date(q.created_at) : null;
    if (
      q.customer_accepted === QuoteCustomerStatus.PENDING &&
      !eng.viewed &&
      createdAt &&
      createdAt < now48
    ) {
      pushItem("not_viewed_48h", q, { interest_score: score });
    }

    if (
      q.customer_accepted === QuoteCustomerStatus.PENDING &&
      eng.viewed &&
      eng.lastViewAt &&
      eng.lastViewAt < now24
    ) {
      pushItem("viewed_no_response_24h", q, { interest_score: score, last_view_at: eng.lastViewAt });
    }

    if (q.customer_accepted === QuoteCustomerStatus.ACCEPTED && !paidQuoteIds.has(q.id)) {
      pushItem("accepted_deposit_pending", q);
    }

    const stock = stockMap[q.id];
    if (
      stock &&
      ["PENDING", "ORDERED", "CONFIRMED", "DRIVER_ASSIGNED"].includes(stock.stock_order_status) &&
      stock.stock_order_status !== "DELIVERED"
    ) {
      pushItem("stock_delivery_pending", q, { stock_status: stock.stock_order_status });
    }

    if (stock?.stock_order_status === "DELIVERED") {
      const p = normalizePipelineStatus(q.kanban_status);
      if (
        p !== QuotePipelineStatus.INSTALLATION_SCHEDULED &&
        p !== QuotePipelineStatus.INSTALLATION_IN_PROGRESS &&
        p !== QuotePipelineStatus.INSTALLATION_COMPLETED &&
        p !== QuotePipelineStatus.JOB_CLOSED
      ) {
        pushItem("delivery_install_pending", q);
      }
    }

    if (
      pipe === QuotePipelineStatus.INSTALLATION_COMPLETED ||
      pipe === QuotePipelineStatus.JOB_CLOSED
    ) {
      // Review pending heuristic: completed but no recent follow-up tagged as review
      const lastFu = q.last_follow_up_date_time ? new Date(q.last_follow_up_date_time) : null;
      if (!lastFu || lastFu < hoursAgo(24 * 7)) {
        pushItem("install_review_pending", q);
      }
    }
  }

  highInterestRows.sort((a, b) => b.interest_score - a.interest_score);

  const quotesSent = assigned; // each assigned quote is a sent/created proposal in this CRM
  const funnel = [
    { key: "assigned", label: "Assigned Leads", count: assigned, rate: 100 },
    { key: "sent", label: "Quotes Sent", count: quotesSent, rate: pct(quotesSent, assigned) },
    { key: "viewed", label: "Customer Viewed", count: viewed, rate: pct(viewed, quotesSent) },
    { key: "high_interest", label: "High Interest", count: highInterest, rate: pct(highInterest, viewed || assigned) },
    { key: "accepted", label: "Accepted", count: accepted, rate: pct(accepted, viewed || quotesSent) },
    { key: "installation", label: "Installation", count: installScheduled, rate: pct(installScheduled, accepted || 1) },
    { key: "completed", label: "Completed", count: completed, rate: pct(completed, accepted || 1) },
  ];

  const metrics = {
    assigned_leads: assigned,
    quotes_sent: quotesSent,
    quotes_sent_rate: pct(quotesSent, assigned),
    customer_viewed: viewed,
    customer_viewed_rate: pct(viewed, quotesSent),
    follow_up_pending: followUpPending,
    high_interest: highInterest,
    accepted,
    accepted_rate: pct(accepted, viewed || quotesSent),
    rejected,
    installation_scheduled: installScheduled,
    completed,
    reviews_received: actionBuckets.install_review_pending.count, // proxy until reviews model exists
    referral_generated: 0,
    total_revenue: totalRevenue,
  };

  // Team ranking (admin)
  let teamRanking: any[] = [];
  if (scope.isAdmin) {
    const bySender: Record<
      number,
      { sender_id: number; name: string; assigned: number; accepted: number; revenue: number }
    > = {};
    for (const q of quotes) {
      const sid = q.sender_id;
      if (!sid) continue;
      if (!bySender[sid]) {
        bySender[sid] = {
          sender_id: sid,
          name: q.sender?.name || `User #${sid}`,
          assigned: 0,
          accepted: 0,
          revenue: 0,
        };
      }
      bySender[sid].assigned += 1;
      if (q.customer_accepted === QuoteCustomerStatus.ACCEPTED) {
        bySender[sid].accepted += 1;
        bySender[sid].revenue += Number(q.total) || 0;
      }
    }
    teamRanking = Object.values(bySender)
      .map((s) => ({
        ...s,
        conversion: pct(s.accepted, s.assigned),
        stars: Math.max(1, Math.min(5, Math.round((pct(s.accepted, s.assigned) / 100) * 5) || 1)),
      }))
      .sort((a, b) => b.accepted - a.accepted || b.conversion - a.conversion)
      .slice(0, 15);
  }

  return {
    scope: { is_admin: scope.isAdmin, user_id: scope.userId },
    range_days: days,
    metrics,
    funnel,
    urgent_followups: Object.values(actionBuckets).filter((b) =>
      ["not_viewed_48h", "viewed_no_response_24h", "accepted_deposit_pending", "stock_delivery_pending", "delivery_install_pending", "install_review_pending"].includes(
        b.key,
      ),
    ),
    action_required: Object.values(actionBuckets),
    high_interest_customers: highInterestRows.slice(0, 20),
    team_ranking: teamRanking,
  };
}

export { isAdminRole };
