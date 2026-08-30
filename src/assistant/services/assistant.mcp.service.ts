import { Roles } from "../../data/dataInserter";
import { roleRepository, userRepository } from "@repositories/index";
import {
  buildMcpSchemaCatalog,
  MCP_COLLECTION_REGISTRY,
  MCP_REGISTRY_BY_ID,
  type McpCollectionDef,
} from "./assistant.mcp.schema";

export const DEFAULT_MCP_ROLES = [Roles.SUPER_ADMIN, Roles.ADMIN] as const;

/** Hard caps — prevents token overload in chat / API. */
const MCP_LIMITS = {
  recent_rows: 8,
  recent_rows_id_lookup: 5,
  group_buckets: 12,
  max_intents: 5,
  max_snapshot_chars: 8_000,
} as const;

/** Never expose these fields — includes nested keys. */
const FORBIDDEN_MCP_FIELDS = new Set([
  "password",
  "otp",
  "otp_verification_token",
  "bypass_token",
  "bank_details",
  "account_number",
  "ifsc_code",
  "google_api_key",
  "google_maps_api_key",
  "api_key",
  "secret",
  "refresh_token",
  "access_token",
  "private_key",
  "content", // message body — metadata only for privacy
]);

export type McpIntent = string;

export type McpQueryStatus = "success" | "partial" | "empty" | "error";

export type McpQueryPlan = {
  message: string;
  page_context?: string;
  intents: McpIntent[];
  count_only: boolean;
  include_recent: boolean;
  limits: typeof MCP_LIMITS;
  schema_catalog: string;
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

function isForbiddenField(key: string): boolean {
  if (FORBIDDEN_MCP_FIELDS.has(key)) return true;
  const k = key.toLowerCase();
  return (
    k.includes("password") ||
    k.includes("secret") ||
    (k.includes("token") && k !== "task_code") ||
    k === "otp" ||
    k.includes("api_key") ||
    k.startsWith("bank_")
  );
}

function sanitizeValue(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenField(key)) continue;
    out[key] = typeof val === "object" ? sanitizeValue(val) : val;
  }
  return out;
}

function sanitizeRecord(row: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(row) as Record<string, unknown>;
}

function wantsLiveData(message: string): boolean {
  const m = message.trim();
  if (m.length < 2) return false;
  return (
    /\b(how many|count|total|list|show|recent|latest|today|this week|status|summary|numbers?|stats?|data|find|search|who|which|what|overview|snapshot|tell me|give me|any|pending|active|inactive)\b/i.test(
      m,
    ) || /\?/.test(m)
  );
}

/** Count-only: tallies without recent row lists (lighter). */
export function isCountOnlyQuery(message: string): boolean {
  const wantsCount = /\b(how many|count|total|number of)\b/i.test(message);
  const wantsDetail = /\b(list|show|recent|latest|who|names?|breakdown|detail|rows?|which|what)\b/i.test(
    message,
  );
  return wantsCount && !wantsDetail;
}

function scoreCollection(def: McpCollectionDef, message: string, pageContext?: string): number {
  let score = 0;
  if (def.keywords.test(message)) score += 3;
  if (pageContext && def.pagePattern?.test(pageContext)) score += 4;
  const labelWords = def.label.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  for (const word of labelWords) {
    if (new RegExp(`\\b${word}`, "i").test(message)) score += 1;
  }
  const collWord = def.collection.replace(/_/g, " ");
  if (new RegExp(`\\b${collWord}\\b`, "i").test(message)) score += 2;
  return score;
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
    schema_catalog: buildMcpSchemaCatalog(),
  };
}

function detectIntents(message: string, pageContext?: string): McpIntent[] {
  if (!wantsLiveData(message)) return ["overview"];

  const scores: { id: string; score: number }[] = [];
  for (const def of MCP_COLLECTION_REGISTRY) {
    const score = scoreCollection(def, message, pageContext);
    if (score > 0) scores.push({ id: def.id, score });
  }

  scores.sort((a, b) => b.score - a.score);

  const wantsOverview = /\b(overview|snapshot|crm summary|all areas|everything|full report|dashboard)\b/i.test(
    message,
  );

  if (scores.length === 0) {
    return wantsOverview ? ["overview"] : ["overview"];
  }

  const top = scores.slice(0, MCP_LIMITS.max_intents).map((s) => s.id);
  if (wantsOverview && !top.includes("overview")) top.unshift("overview");
  return top;
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
  return rows.map((r) => `  ${r._id ?? "unknown"}: ${r.count}`).join("\n");
}

async function fetchOverviewBlock(): Promise<McpBlockResult> {
  try {
    const topCollections = ["leads", "quotes", "invoices", "installer_jobs", "tasks", "products"];
    const counts = await Promise.all(
      topCollections.map(async (id) => {
        const def = MCP_REGISTRY_BY_ID.get(id);
        if (!def) return null;
        const count = await def.repo.count({}).catch(() => 0);
        return `- ${def.label}: ${count}`;
      }),
    );
    const activeUsers = await userRepository.count({ is_active: true }).catch(() => 0);

    return {
      domain: "overview",
      ok: true,
      lines: ["CRM snapshot (live):", ...counts.filter(Boolean), `- Active staff users: ${activeUsers}`],
    };
  } catch (err) {
    return { domain: "overview", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchUsersBlock(includeRecent: boolean): Promise<McpBlockResult> {
  try {
    const lines: string[] = ["STAFF USERS (live — passwords never exposed):"];

    const roles: any[] = await roleRepository.find({}, { lean: true, select: "id name" });
    const roleName = new Map(roles.map((r) => [r.id, r.name]));

    const activeCount = await userRepository.count({ is_active: true });
    const inactiveCount = await userRepository.count({ is_active: false });
    lines.push(`Active: ${activeCount} | Inactive: ${inactiveCount}`);
    lines.push("Active users by role:");
    lines.push(await countByField(userRepository, "role_id", { is_active: true }));

    let row_count = 0;
    if (includeRecent) {
      const recent: any[] = await userRepository.find(
        { is_active: true },
        {
          sort: { id: -1 },
          limit: MCP_LIMITS.recent_rows,
          lean: true,
          select: "id name role_id email mobile_no is_verified",
        },
      );
      row_count = recent.length;
      if (recent.length) {
        lines.push(`Sample active users (max ${MCP_LIMITS.recent_rows}):`);
        for (const row of recent) {
          const safe = sanitizeRecord(row);
          lines.push(
            `  #${safe.id} ${safe.name} | ${roleName.get(safe.role_id as number) || "—"} | ${safe.email || "—"}`,
          );
        }
      }
    }

    return { domain: "users", ok: true, lines, row_count };
  } catch (err) {
    return { domain: "users", ok: false, error: (err as Error).message, lines: [] };
  }
}

async function fetchCollectionBlock(
  def: McpCollectionDef,
  message: string,
  includeRecent: boolean,
): Promise<McpBlockResult> {
  if (def.id === "users") return fetchUsersBlock(includeRecent);

  try {
    const lines: string[] = [`${def.label.toUpperCase()} (live):`];
    const total = await def.repo.count({}).catch(() => 0);
    lines.push(`Total records: ${total}`);

    if (def.groupBy && total > 0) {
      lines.push(`By ${def.groupBy}:`);
      lines.push(await countByField(def.repo, def.groupBy));
    }

    let row_count = 0;
    if (includeRecent && total > 0) {
      const filter = def.buildFilter?.(message) ?? {};
      const hasIdFilter = "id" in filter;
      const limit = hasIdFilter ? MCP_LIMITS.recent_rows_id_lookup : MCP_LIMITS.recent_rows;
      const recent: any[] = await def.repo.find(filter, {
        sort: def.sort ?? { id: -1 },
        limit,
        lean: true,
        select: def.select,
      });
      row_count = recent.length;

      if (recent.length) {
        lines.push(`Recent rows (max ${limit}):`);
        for (const row of recent) {
          const safe = sanitizeRecord(row);
          lines.push(`  ${def.formatRow(safe)}`);
        }
      } else if (hasIdFilter) {
        lines.push("  No record found for that ID.");
      }
    }

    return { domain: def.id, ok: true, lines, row_count };
  } catch (err) {
    return { domain: def.id, ok: false, error: (err as Error).message, lines: [] };
  }
}

function formatSnapshot(plan: McpQueryPlan, blocks: McpBlockResult[]): { text: string; truncated: boolean } {
  const header = [
    "LIVE CRM DATA (authoritative — use these exact numbers; never say you lack access):",
    "SECURITY: Never share passwords, OTPs, API keys, bank details, or auth tokens.",
    plan.schema_catalog,
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

/** Execute MCP query plan against MongoDB (read-only, safe fields). */
export async function executeMcpQuery(
  message: string,
  pageContext?: string,
): Promise<McpQueryResult> {
  const started = Date.now();
  const plan = buildMcpQueryPlan(message, pageContext);
  const includeRecent = plan.include_recent;

  const tasks: Promise<McpBlockResult>[] = [];
  for (const intent of plan.intents) {
    if (intent === "overview") {
      tasks.push(fetchOverviewBlock());
      continue;
    }
    const def = MCP_REGISTRY_BY_ID.get(intent);
    if (def) {
      tasks.push(fetchCollectionBlock(def, plan.message, includeRecent));
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
      preview: b.lines.slice(0, 10),
    })),
    snapshot: result.snapshot,
    meta: result.meta,
  };
}
