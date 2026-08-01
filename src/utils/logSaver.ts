import { systemLogRepository } from "@repositories";
import logger from "./pino";

let dbReady = false;
const queue: any[] = [];

export const setDbReady = (ready: boolean) => {
  dbReady = ready;
  if (dbReady) flushQueue();
};

export const saveLog = async (level: string, message: string, meta: any = {}, status = "N/A") => {
  const logEntry = { level, message, meta, status };
  if (!dbReady) return queue.push(logEntry);

  try {
    await systemLogRepository.create(logEntry);
  } catch (err) {
    console.error("LogSaveError:", err);
  }
};

const flushQueue = async () => {
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
