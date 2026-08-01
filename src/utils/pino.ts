import pino from "pino";
import { saveLog, setDbReady } from "./logSaver";

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
    p[level](safeMeta, safeMsg); // Pass meta as first argument for pino
    return safeMsg;
  } catch (err) {
    console.error("PinoLoggingError:", err, "Original msg:", msg);
    return typeof msg === "string" ? msg : JSON.stringify(msg);
  }
};

// Logger wrapper
let logger: any = {
  info: (msg: any, meta: any = {}) => safePinoCall("info", msg, meta),
  error: (msg: any, meta: any = {}) => saveLog("error", safePinoCall("error", msg, meta), meta),
  warn: (msg: any, meta: any = {}) => saveLog("warn", safePinoCall("warn", msg, meta), meta),
  debug: (msg: any, meta: any = {}) => saveLog("debug", safePinoCall("debug", msg, meta), meta),
  raw: p,
  setDbReady,
};

/**
 * Override console methods and capture meta
 */
export const overrideLoggerMethods = () => {
  ["error", "warn", "debug"].forEach((method) => {
    const orig = (console as any)[method].bind(console);
    (console as any)[method] = (...args: any[]) => {
      const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");
      const meta = { args, source: "console" };
      saveLog(`console_${method}`, msg, meta);
      orig(...args);
    };
  });

  // Capture uncaught exceptions
  process.on("uncaughtException", (err: Error) => {
    saveLog("uncaughtException", err.message, { stack: err.stack, source: "process" });
    console.error(err);
    process.exit(1); // Optional: exit the process
  });

  // Capture unhandled promise rejections
  process.on("unhandledRejection", (reason: any) => {
    const msg = typeof reason === "string" ? reason : JSON.stringify(reason);
    saveLog("unhandledRejection", msg, { reason, source: "process" });
    console.error(reason);
    process.exit(1);
  });
};

export default logger;
