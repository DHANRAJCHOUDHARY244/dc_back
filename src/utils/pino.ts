import pino from "pino";
import { setDbReady } from "./logSaver";

const p = pino({
  base: {
    processTitle: `PTitle:- ${process.title}`,
    processId: `P_ID:- ${process.pid}`,
  },
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:dd/mm/yy HH:MM:ss",
          include: "pid,hostname,time,level",
        },
      },
    ],
  },
});

type LogLevel = "info" | "error" | "warn" | "debug";

/**
 * Safe wrapper to handle any object/string for pino logging
 */
const safePinoCall = (level: LogLevel, msg: any, meta: any = {}) => {
  try {
    const safeMsg = typeof msg === "string" ? msg : JSON.stringify(msg);
    const safeMeta = typeof meta === "object" ? meta : { meta };
    p[level](safeMeta, safeMsg);
    return safeMsg;
  } catch (err) {
    console.error("PinoLoggingError:", err, "Original msg:", msg);
    return typeof msg === "string" ? msg : JSON.stringify(msg);
  }
};

// Console / pino only — nothing is written to MongoDB.
let logger: any = {
  info: (msg: any, meta: any = {}) => safePinoCall("info", msg, meta),
  error: (msg: any, meta: any = {}) => safePinoCall("error", msg, meta),
  warn: (msg: any, meta: any = {}) => safePinoCall("warn", msg, meta),
  debug: (msg: any, meta: any = {}) => safePinoCall("debug", msg, meta),
  raw: p,
  setDbReady,
};

/**
 * Keep process crash hooks; do not persist logs to MongoDB.
 */
export const overrideLoggerMethods = () => {
  process.on("uncaughtException", (err: Error) => {
    console.error(err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: any) => {
    console.error(reason);
    process.exit(1);
  });
};

export default logger;
