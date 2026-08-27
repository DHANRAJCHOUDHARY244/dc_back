import { systemLogRepository } from "@repositories";
import logger from "./pino";

let dbReady = false;
const queue: any[] = [];
const MAX_QUEUE = 100;

/** Persist API request logs to Mongo. Default off — enables only when API_DB_LOGS=true (avoids saturating remote pool). */
function apiDbLogsEnabled() {
  const flag = process.env.API_DB_LOGS;
  return flag === "true" || flag === "1";
}

const SKIP_PATH_PREFIXES = [
  "/api/public/",
  "/api/auth/login",
  "/api/auth/register",
  "/uploads/",
];

export const setDbReady = (ready: boolean) => {
  dbReady = ready;
  if (dbReady) flushQueue();
};

function shouldSkipLog(message: string, status: string) {
  if (!apiDbLogsEnabled()) return true;
  const code = Number(status);
  // Auth noise / public traffic floods the pool and slows real queries.
  if (code === 401 || code === 403) return true;
  const path = String(message || "");
  return SKIP_PATH_PREFIXES.some((p) => path.includes(p));
}

/** Strip heavy fields so log writes stay cheap. */
function slimMeta(meta: any) {
  if (!meta || typeof meta !== "object") return meta;
  const req = meta.request || {};
  return {
    request: {
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userId: req.user?.id ?? null,
    },
    response: meta.response
      ? {
          statusCode: meta.response.statusCode,
          message: meta.response.message,
          responseTimeMs: meta.response.responseTimeMs,
        }
      : undefined,
  };
}

export const saveLog = async (level: string, message: string, meta: any = {}, status = "N/A") => {
  if (shouldSkipLog(message, status)) return;

  const logEntry = { level, message, meta: slimMeta(meta), status };
  if (!dbReady) {
    if (queue.length < MAX_QUEUE) queue.push(logEntry);
    return;
  }

  // Never block the request path on log persistence.
  void systemLogRepository.create(logEntry).catch((err) => {
    console.error("LogSaveError:", err?.message || err);
  });
};

const flushQueue = async () => {
  if (!apiDbLogsEnabled()) {
    queue.length = 0;
    return;
  }
  while (queue.length) {
    const logEntry = queue.shift();
    try {
      await systemLogRepository.create(logEntry);
    } catch (err) {
      console.error("QueueFlushError:", err);
    }
  }
};

export const deleteOldLogsCron = async () => {
  try {
    logger.warn(`Deleted  system logs older than 2 days. cron started`);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const result = await systemLogRepository.deleteMany({ created_at: { $lt: twoDaysAgo } });
    const deleted =
      result && "deletedCount" in result ? (result.deletedCount ?? 0) : 0;

    logger.warn(`Deleted ${deleted} system logs older than 2 days.`);
  } catch (err) {
    logger.error("Error deleting old system logs", { error: err });
  }
};
