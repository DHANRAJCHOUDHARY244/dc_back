import "./polyfills/crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import env from "dotenv";
import { createServer } from "http";

env.config();
import { getCorsOptions, validateSecurityEnv } from "@config/security";

import logger, { overrideLoggerMethods } from "@utils/pino";
import fileUpload from "express-fileupload";
import { ReE } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE } from "./constants/serverCode";
import { Request, Response, NextFunction } from "express";
import { connectDatabase } from "@config/database";
import { connectRedis, disconnectRedis, isRedisReady } from "@config/redis";
import { authenticate } from "./middleware/auth.middleware";
import routes from "./routes";
import morgan from "morgan";
import { dbRelation } from "./sync";
import { setupSocket } from "./socket/socket";
import path from "path";
import { loadCrons } from "@services/cronJobs.service";
import { setDbReady } from "@utils/logSaver";
import { reqResLogger } from "./middleware/reqResLogger.middleware";
// import { seedRoles } from "./data/dataInserter";
import { bootstrapOnStartup } from "./data/dataInserter";
import "@models/index";
import "./assistant/models/index";

validateSecurityEnv();

const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(getCorsOptions()));
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, abortOnLimit: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));
app.use(reqResLogger);
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/*/v1/*", authenticate.bind(authenticate));
app.use("/api/v1/*", authenticate.bind(authenticate));

app.get("/", (_req: Request, res: Response) => {
  const filePath = path.join(__dirname, "../view/index.html");
  res.sendFile(filePath);
});
app.use("/api", routes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.stack);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : `Internal Server Error: ${err.message}`;
  ReE(res, SERVER_ERROR_CODE, message);
});

(async () => {
  try {
    await connectDatabase();
    await connectRedis();
    await setupSocket(httpServer);
    try {
      await bootstrapOnStartup();
    } catch (e) {
      console.error("CRM bootstrap failed:", e);
    }
    // try {
    //   const { ensureSlaSeeds, backfillActiveQuotes } = await import("@services/sla.service");
    //   await ensureSlaSeeds();
    //   await backfillActiveQuotes();
    // } catch (e) {
    //   console.error("SLA seed/backfill:", e);
    // }
    // try {
    //   const { ensureMasterTaskSeeds } = await import("@services/masterTask.service");
    //   await ensureMasterTaskSeeds();
    // } catch (e) {
    //   console.error("Master task seed:", e);
    // }
    setDbReady(true);
    overrideLoggerMethods();
    dbRelation();
    loadCrons();

    // Warm branding cache so first /public/branding is instant.
    try {
      const { getOrCreateSettings } = await import("@services/crmSettings.service");
      await getOrCreateSettings();
    } catch (e) {
      console.warn("Branding cache warm skipped:", (e as Error)?.message || e);
    }

    httpServer.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
      logger.warn(`Server is running on port ${process.env.PORT || 3000}`);
      if (isRedisReady()) logger.warn("Redis caching & Socket.IO adapter active");
    });
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
})();

process.on("SIGINT", () => {
  void disconnectRedis().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void disconnectRedis().finally(() => process.exit(0));
});

export default app;
