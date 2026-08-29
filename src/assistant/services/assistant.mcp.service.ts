import { Roles } from "../../data/dataInserter";
import {
  allInOneJobRepository,
  contactFormRepository,
  installerJobRepository,
  invoiceRepository,
  leadRepository,
  quoteRepository,
  roleRepository,
  userRepository,
} from "@repositories/index";

export const DEFAULT_MCP_ROLES = [Roles.SUPER_ADMIN, Roles.ADMIN] as const;

/** Hard caps — prevents token overload in chat / API. */
const MCP_LIMITS = {
  recent_rows: 5,
  recent_rows_id_lookup: 3,
  group_buckets: 10,
  max_intents: 3,
  max_snapshot_chars: 3_500,
} as const;

const FORBIDDEN_MCP_FIELDS = new Set([
  "password",
  "email",
  "otp",
  "otp_verification_token",
  "bypass_token",
  "bank_details",
  "account_number",
  "ifsc_code",
]);

export type McpIntent =
  | "overview"
  | "leads"
  | "quotes"
  | "invoices"
  | "installer_jobs"
  | "users"
  | "contact_forms"
  | "pre_approval";

export type McpQueryStatus = "success" | "partial" | "empty" | "error";

export type McpQueryPlan = {
  message: string;
  page_context?: string;
  intents: McpIntent[];
  count_only: boolean;
  include_recent: boolean;
  limits: typeof MCP_LIMITS;
};

export type McpBlockResult = {
  domain: McpIntent;
  ok: boolean;
  error?: string;
  lines: string[];
  row_count?: number;
  truncated?: boolean;
};

export type McpQueryResult = {
  success: boolean;
  status: McpQueryStatus;
  query: McpQueryPlan;
  blocks: McpBlockResult[];
  snapshot: string;
  meta: {
    duration_ms: number;
    queries_run: number;
    snapshot_chars: number;
    truncated: boolean;
  };
};

const INTENT_KEYWORDS: Record<Exclude<McpIntent, "overview">, RegExp> = {
  leads: /\b(leads?|pipeline|enquir(y|ies)|prospect)\b/i,
  quotes: /\b(quotes?|proposal|kanban|customer accepted)\b/i,
  invoices: /\b(invoices?|billing|payment|paid|unpaid)\b/i,
  installer_jobs: /\b(installer jobs?|installation|job board|site visit)\b/i,
  users: /\b(users?|staff|employees?|roles?|accounts?|login)\b/i,
  contact_forms: /\b(contact form|form submission|website form)\b/i,
  pre_approval: /\b(pre approval|pre-approval|grid assessment|all.in.one)\b/i,
};

const PAGE_INTENTS: { pattern: RegExp; intent: Exclude<McpIntent, "overview"> }[] = [
  { pattern: /\/leads?\b/i, intent: "leads" },
  { pattern: /\/quote/i, intent: "quotes" },
  { pattern: /\/invoice/i, intent: "invoices" },
  { pattern: /\/installer-jobs/i, intent: "installer_jobs" },
  { pattern: /\/management\/system\/user/i, intent: "users" },
  { pattern: /\/contact-form/i, intent: "contact_forms" },
  { pattern: /\/all-in-one|\/pre-approval/i, intent: "pre_approval" },
];

const INTENT_PRIORITY: McpIntent[] = [
  "users",
  "leads",
  "quotes",
  "invoices",
  "installer_jobs",
  "contact_forms",
  "pre_approval",
  "overview",
];

function sanitizeRecord(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (FORBIDDEN_MCP_FIELDS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

function wantsLiveData(message: string): boolean {
  return (
    /\b(how many|count|total|list|show|recent|today|this week|status|summary|numbers?|stats?|data|find|search|who|which|overview|snapshot)\b/i.test(
      message,
    ) || message.trim().length > 3
  );
}

/** Count-only: tallies without recent row lists (lighter). */
export function isCountOnlyQuery(message: string): boolean {
  const wantsCount = /\b(how many|count|total|number of)\b/i.test(message);
  const wantsDetail = /\b(list|show|recent|latest|who|names?|breakdown|detail|rows?)\b/i.test(message);
  return wantsCount && !wantsDetail;
}

/** Build query plan from natural language (no DB calls). */
export function buildMcpQueryPlan(message: string, pageContext?: string): McpQueryPlan {
  const intents = detectIntents(message, pageContext);
  const count_only = isCountOnlyQuery(message);
  return {
    message: message.trim(),
    page_context: pageContext?.trim() || undefined,
    intents: [...intents],
    count_only,
    include_recent: !count_only,
    limits: MCP_LIMITS,
  };
}

function detectIntents(message: string, pageContext?: string): McpIntent[] {
  if (!wantsLiveData(message)) return ["overview"];

  const found = new Set<McpIntent>();

  for (const [intent, re] of Object.entries(INTENT_KEYWORDS) as [
    Exclude<McpIntent, "overview">,
    RegExp,
  ][]) {
    if (re.test(message)) found.add(intent);
  }

  if (pageContext) {
    for (const { pattern, intent } of PAGE_INTENTS) {
      if (pattern.test(pageContext)) found.add(intent);
    }
  }

  if (
    /\b(how many|count|total|number of|active|inactive)\b.*\b(user|staff|employee|role)/i.test(message) ||
    /\b(user|staff|employee|role)\b.*\b(how many|count|total|number of|active|inactive)\b/i.test(message)
  ) {
    found.add("users");
  }

  const wantsOverview = /\b(overview|snapshot|crm summary|all areas|everything|full report)\b/i.test(
    message,
  );

  if (found.size === 0) {
    return wantsOverview ? ["overview"] : ["overview"];
  }

  if (wantsOverview) found.add("overview");
  else if (found.size > 1) found.delete("overview");

  const ordered = INTENT_PRIORITY.filter((i) => found.has(i));
  return ordered.slice(0, MCP_LIMITS.max_intents);
}

async function countByField(
  repo: { aggregate: (p: unknown[]) => Promise<unknown[]> },
  field: string,
  match: Record<string, unknown> = {},
): Promise<string> {
  const rows = (await repo.aggregate([
    { $match: { deleted_at: null, ...match } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: MCP_LIMITS.group_buckets },
  ])) as { _id: string; count: number }[];

  if (!rows.length) return "  (none)";
  return rows.map((r) => `  ${r._id || "unknown"}: ${r.count}`).join("\n");
}

async function fetchOverviewBlock(): Promise<McpBlockResult> {
  try {
    const [leads, quotes, invoices, jobs, users, forms] = await Promise.all([
      leadRepository.count({}),
      quoteRepository.count({}),
      invoiceRepository.count({}),
      installerJobRepository.count({}),
      userRepository.count({ is_active: true }),
      contactFormRepository.count({}).catch(() => 0),
    ]);

    return {
      domain: "overview",
      ok: true,
      lines: [
        "CRM snapshot (live):",
        `- Leads: ${leads}`,
        `- Quotes: ${quotes}`,
        `- Invoices: ${invoices}`,
        `- Installer jobs: ${jobs}`,
        `- Active staff users: ${users}`,
        `- Contact form submissions: ${forms}`,
      ],
    };
  } catch (err) {
    return { domain: "overview", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchLeadsBlock(message: string, includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["LEADS (live):"];
    lines.push("By status:");
    lines.push(await countByField(leadRepository, "status"));

    let row_count = 0;
    if (includeRecent) {
      const filter: Record<string, unknown> = {};
      const idMatch = message.match(/\b(?:lead\s*#?\s*|id\s*)(\d+)\b/i);
      if (idMatch) filter.id = Number(idMatch[1]);

      const limit = idMatch ? MCP_LIMITS.recent_rows_id_lookup : MCP_LIMITS.recent_rows;
      const recent: any[] = await leadRepository.find(filter, {
        sort: { id: -1 },
        limit,
        lean: true,
        select: "id name status source owner_id",
      });
      row_count = recent.length;

      if (recent.length) {
        lines.push(`Recent leads (max ${limit}):`);
        for (const row of recent) {
          lines.push(
            `  #${row.id} ${row.name} | ${row.status} | source: ${row.source || "—"}`,
          );
        }
      }
    }

    return { domain: "leads", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "leads", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchQuotesBlock(message: string, includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["QUOTES (live):"];
    lines.push("By kanban status:");
    lines.push(await countByField(quoteRepository, "kanban_status"));

    let row_count = 0;
    if (includeRecent) {
      const filter: Record<string, unknown> = {};
      const idMatch = message.match(/\b(?:quote\s*#?\s*|id\s*)(\d+)\b/i);
      if (idMatch) filter.id = Number(idMatch[1]);

      const limit = idMatch ? MCP_LIMITS.recent_rows_id_lookup : MCP_LIMITS.recent_rows;
      const recent: any[] = await quoteRepository.find(filter, {
        sort: { id: -1 },
        limit,
        lean: true,
        select: "id name total kanban_status customer_accepted",
      });
      row_count = recent.length;

      if (recent.length) {
        lines.push(`Recent quotes (max ${limit}):`);
        for (const row of recent) {
          lines.push(
            `  #${row.id} ${row.name} | $${Number(row.total || 0).toLocaleString()} | ${row.kanban_status}`,
          );
        }
      }
    }

    return { domain: "quotes", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "quotes", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchInvoicesBlock(includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["INVOICES (live):"];
    lines.push("By payment status:");
    lines.push(await countByField(invoiceRepository, "pay_status"));

    let row_count = 0;
    if (includeRecent) {
      const recent: any[] = await invoiceRepository.find(
        {},
        {
          sort: { id: -1 },
          limit: MCP_LIMITS.recent_rows,
          lean: true,
          select: "id name pay_status quote_id",
        },
      );
      row_count = recent.length;
      if (recent.length) {
        lines.push(`Recent invoices (max ${MCP_LIMITS.recent_rows}):`);
        for (const row of recent) {
          lines.push(`  #${row.id} ${row.name} | ${row.pay_status} | quote #${row.quote_id ?? "—"}`);
        }
      }
    }

    return { domain: "invoices", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "invoices", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchInstallerJobsBlock(includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["INSTALLER JOBS (live):"];
    lines.push("By status:");
    lines.push(await countByField(installerJobRepository, "status"));

    let row_count = 0;
    if (includeRecent) {
      const recent: any[] = await installerJobRepository.find(
        {},
        {
          sort: { installation_date: -1 },
          limit: MCP_LIMITS.recent_rows,
          lean: true,
          select: "id job_number status installer_id installation_date",
        },
      );
      row_count = recent.length;
      if (recent.length) {
        lines.push(`Recent jobs (max ${MCP_LIMITS.recent_rows}):`);
        for (const row of recent) {
          const date = row.installation_date
            ? new Date(row.installation_date).toISOString().slice(0, 10)
            : "—";
          lines.push(`  #${row.id} ${row.job_number || ""} | ${row.status} | ${date}`);
        }
      }
    }

    return { domain: "installer_jobs", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "installer_jobs", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchUsersBlock(includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["STAFF USERS (live — no passwords):"];

    const roles: any[] = await roleRepository.find({}, { lean: true, select: "id name" });
    const roleName = new Map(roles.map((r) => [r.id, r.name]));

    const activeCount = await userRepository.count({ is_active: true });
    const inactiveCount = await userRepository.count({ is_active: false });
    lines.push(`Active: ${activeCount} | Inactive: ${inactiveCount}`);

    const byRole = (await userRepository.aggregate([
      { $match: { deleted_at: null, is_active: true } },
      { $group: { _id: "$role_id", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: MCP_LIMITS.group_buckets },
    ])) as { _id: number; count: number }[];

    lines.push("Active users by role:");
    for (const row of byRole) {
      lines.push(`  ${roleName.get(row._id) || `role ${row._id}`}: ${row.count}`);
    }

    let row_count = 0;
    if (includeRecent) {
      const recent: any[] = await userRepository.find(
        { is_active: true },
        {
          sort: { id: -1 },
          limit: MCP_LIMITS.recent_rows,
          lean: true,
          select: "id name role_id is_verified",
        },
      );
      row_count = recent.length;
      if (recent.length) {
        lines.push(`Sample active users (max ${MCP_LIMITS.recent_rows}, names only):`);
        for (const row of recent) {
          const safe = sanitizeRecord(row);
          lines.push(
            `  #${safe.id} ${safe.name} | ${roleName.get(safe.role_id as number) || "—"}`,
          );
        }
      }
    }

    return { domain: "users", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "users", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchContactFormsBlock(includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["CONTACT FORMS (live):"];
    const total = await contactFormRepository.count({}).catch(() => 0);
    lines.push(`Total submissions: ${total}`);

    let row_count = 0;
    if (includeRecent && total > 0) {
      const recent: any[] = await contactFormRepository
        .find({}, { sort: { id: -1 }, limit: MCP_LIMITS.recent_rows, lean: true, select: "id name created_at" })
        .catch(() => []);
      row_count = recent.length;
      if (recent.length) {
        lines.push(`Recent (max ${MCP_LIMITS.recent_rows}):`);
        for (const row of recent) {
          lines.push(`  #${row.id} ${row.name || "—"}`);
        }
      }
    }

    return { domain: "contact_forms", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "contact_forms", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchPreApprovalBlock(includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["PRE APPROVAL / ALL-IN-ONE (live):"];
    lines.push("By status:");
    lines.push(await countByField(allInOneJobRepository, "overall_status"));

    let row_count = 0;
    if (includeRecent) {
      const recent: any[] = await allInOneJobRepository.find(
        {},
        {
          sort: { id: -1 },
          limit: MCP_LIMITS.recent_rows,
          lean: true,
          select: "id job_number overall_status customer",
        },
      );
      row_count = recent.length;
      if (recent.length) {
        lines.push(`Recent (max ${MCP_LIMITS.recent_rows}):`);
        for (const row of recent) {
          const customerName =
            row.customer?.name || row.customer?.fullName || row.job_number || "—";
          lines.push(`  #${row.id} ${customerName} | ${row.overall_status || "—"}`);
        }
      }
    }

    return { domain: "pre_approval", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "pre_approval", ok: false, error: (err as Error).message, lines: [] };
  }
}

function formatSnapshot(plan: McpQueryPlan, blocks: McpBlockResult[]): { text: string; truncated: boolean } {
  const header = [
    "LIVE CRM DATA (authoritative — use these exact numbers; never say you lack access; never share passwords):",
    `Query: ${plan.message}`,
    `Mode: ${plan.count_only ? "counts only" : "counts + sample rows"} | Domains: ${plan.intents.join(", ")}`,
  ];

  const body = blocks.flatMap((b) => {
    if (!b.ok) return [`[${b.domain}] failed: ${b.error}`];
    return b.lines;
  });

  let text = [...header, ...body].join("\n");
  let truncated = false;
  if (text.length > MCP_LIMITS.max_snapshot_chars) {
    text = `${text.slice(0, MCP_LIMITS.max_snapshot_chars)}\n… (truncated — ask a narrower question for more detail)`;
    truncated = true;
  }
  return { text, truncated };
}

function resolveStatus(blocks: McpBlockResult[]): McpQueryStatus {
  if (!blocks.length) return "empty";
  const okCount = blocks.filter((b) => b.ok && b.lines.length).length;
  const failCount = blocks.filter((b) => !b.ok).length;
  if (okCount === 0 && failCount > 0) return "error";
  if (failCount > 0) return "partial";
  if (okCount === 0) return "empty";
  return "success";
}

/** Execute MCP query plan against MongoDB. */
export async function executeMcpQuery(
  message: string,
  pageContext?: string,
): Promise<McpQueryResult> {
  const started = Date.now();
  const plan = buildMcpQueryPlan(message, pageContext);
  const includeRecent = plan.include_recent;

  const tasks: Promise<McpBlockResult>[] = [];
  for (const intent of plan.intents) {
    switch (intent) {
      case "overview":
        tasks.push(fetchOverviewBlock());
        break;
      case "leads":
        tasks.push(fetchLeadsBlock(plan.message, includeRecent));
        break;
      case "quotes":
        tasks.push(fetchQuotesBlock(plan.message, includeRecent));
        break;
      case "invoices":
        tasks.push(fetchInvoicesBlock(includeRecent));
        break;
      case "installer_jobs":
        tasks.push(fetchInstallerJobsBlock(includeRecent));
        break;
      case "users":
        tasks.push(fetchUsersBlock(includeRecent));
        break;
      case "contact_forms":
        tasks.push(fetchContactFormsBlock(includeRecent));
        break;
      case "pre_approval":
        tasks.push(fetchPreApprovalBlock(includeRecent));
        break;
    }
  }

  const blocks = await Promise.all(tasks);
  const { text: snapshot, truncated } = formatSnapshot(plan, blocks);
  const status = resolveStatus(blocks);

  return {
    success: status === "success" || status === "partial",
    status,
    query: plan,
    blocks,
    snapshot,
    meta: {
      duration_ms: Date.now() - started,
      queries_run: blocks.length,
      snapshot_chars: snapshot.length,
      truncated,
    },
  };
}

export function roleHasMcpAccess(role: string, config: { mcp_enabled?: boolean }): boolean {
  if (config.mcp_enabled === false) return false;
  return (DEFAULT_MCP_ROLES as readonly string[]).includes(role);
}

/** Text block injected into assistant chat context. */
export async function buildMcpDataContext(options: {
  message: string;
  pageContext?: string;
  user?: { role?: string; name?: string };
}): Promise<string> {
  try {
    const result = await executeMcpQuery(options.message, options.pageContext);
    if (result.status === "error") {
      return `LIVE CRM DATA: query failed — ${result.blocks.map((b) => b.error).filter(Boolean).join("; ")}`;
    }
    if (result.status === "empty") {
      return "LIVE CRM DATA: no matching records for this question.";
    }
    return result.snapshot;
  } catch (err) {
    return `LIVE CRM DATA: unavailable (${(err as Error).message})`;
  }
}

/** Admin API — structured live CRM query (no passwords). */
export async function queryLiveCrmData(message: string, pageContext?: string) {
  const result = await executeMcpQuery(message, pageContext);
  return {
    success: result.success,
    status: result.status,
    query: result.query,
    blocks: result.blocks.map((b) => ({
      domain: b.domain,
      ok: b.ok,
      error: b.error,
      row_count: b.row_count,
      preview: b.lines.slice(0, 8),
    })),
    snapshot: result.snapshot,
    meta: result.meta,
  };
}
