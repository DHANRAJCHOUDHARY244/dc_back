import { getRedisClient, isRedisReady } from "@config/redis";

const DEDUP_LOCK_TTL_MS = 15_000;

/** In-process coalescing — concurrent callers share one promise per dedup key. */
const inFlightKeys = new Map<string, Promise<unknown>>();

const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

export function buildNotificationDedupKey(
  userId: number,
  message: string,
  route: string | null | undefined,
  meta: Record<string, unknown> = {},
): string {
  if (meta.dedupKey) return String(meta.dedupKey);

  const type = String(meta.type || "").toUpperCase();
  const chatId = meta.chatId;
  const messageId = meta.messageId;

  if (type === "CHAT" && chatId != null) {
    const mid = Number(messageId);
    if (Number.isFinite(mid) && mid > 0) {
      return `chat:${chatId}:msg:${mid}:user:${userId}`;
    }
    const senderId = meta.senderId;
    if (senderId != null) {
      return `chat:${chatId}:event:from:${senderId}:user:${userId}`;
    }
  }

  const leadId = meta.lead_id;
  const level = meta.level;
  if (leadId != null && level != null) {
    return `lead:${leadId}:L${level}:user:${userId}`;
  }

  const action = meta.action;
  if (type === "ATTENDANCE" && action) {
    const day = new Date().toISOString().slice(0, 10);
    return `attendance:${action}:user:${userId}:${day}`;
  }

  const taskId = meta.taskId ?? meta.task_id;
  if (type === "TASK_ESCALATION" && taskId != null && level != null) {
    return `task_esc:${taskId}:L${level}:user:${userId}`;
  }
  if (type === "TASK_REMINDER" && taskId != null) {
    return `task_reminder:${taskId}:user:${userId}`;
  }
  if (type === "TASK" && taskId != null) {
    return `task_assigned:${taskId}:user:${userId}`;
  }

  const followUpId = meta.follow_up_id;
  if (type === "FOLLOW_UP_MISSED" && followUpId != null) {
    return `follow_up_missed:${followUpId}:user:${userId}`;
  }

  if (type === "SLA_DELAY" && meta.quote_id != null) {
    const runId = meta.run_id;
    const status = meta.sla_status;
    if (runId != null && status) {
      return `sla:${meta.quote_id}:run:${runId}:${status}:user:${userId}`;
    }
  }

  const jobId = meta.job_id;
  if (jobId != null) {
    return `job:${jobId}:user:${userId}`;
  }

  if (type === "ONBOARDING" && meta.user_id != null) {
    return `onboarding:${meta.user_id}`;
  }

  const quoteId = meta.quoteId ?? meta.quote_id;
  if (quoteId != null && type) {
    return `${type.toLowerCase()}:${quoteId}:user:${userId}`;
  }

  const invoiceId = meta.invoiceId ?? meta.invoice_id;
  if (invoiceId != null && type) {
    return `${type.toLowerCase()}:${invoiceId}:user:${userId}`;
  }

  const siteInfoId = meta.site_info_id;
  if (siteInfoId != null && type) {
    return `${type.toLowerCase()}:${siteInfoId}:user:${userId}`;
  }

  return `user:${userId}:${type || "generic"}:${route || ""}:${message.slice(0, 120)}`;
}

async function withRedisDedupLock<T>(dedupKey: string, fn: () => Promise<T>): Promise<T> {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) return fn();

  const lockKey = `notif:dedup:${dedupKey}`;
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  for (let attempt = 0; attempt < 40; attempt++) {
    const acquired = await redis.set(lockKey, token, "PX", DEDUP_LOCK_TTL_MS, "NX");
    if (acquired === "OK") {
      try {
        return await fn();
      } finally {
        await redis.eval(RELEASE_SCRIPT, 1, lockKey, token).catch(() => undefined);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 40 + attempt * 10));
  }

  return fn();
}

/** Serialize notification creates for the same dedup key across callers and PM2 workers. */
export async function withNotificationDedupLock<T>(dedupKey: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightKeys.get(dedupKey);
  if (existing) return existing as Promise<T>;

  const run = withRedisDedupLock(dedupKey, fn).finally(() => {
    if (inFlightKeys.get(dedupKey) === run) inFlightKeys.delete(dedupKey);
  });

  inFlightKeys.set(dedupKey, run);
  return run;
}
