import "./polyfills/crypto";
import express from "express";
import cors from "cors";
import env from "dotenv";
import { createServer } from "http";

env.config();

import logger, { overrideLoggerMethods } from "@utils/pino";
import fileUpload from "express-fileupload";
import { ReE } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE } from "./constants/serverCode";
import { Request, Response, NextFunction } from "express";
import { connectDatabase } from "@config/database";
import { authenticate } from "./middleware/auth.middleware";
import routes from "./routes";
import morgan from "morgan";
import { dbRelation } from "./sync";
import { setupSocket } from "./socket/socket";
import { registerChatSocket } from "./socket/chat.socket";
import path from "path";
import { loadCrons } from "@services/cronJobs.service";
import { setDbReady } from "@utils/logSaver";
import { reqResLogger } from "./middleware/reqResLogger.middleware";
// import { seedRoles } from "./data/dataInserter";
import "@models/index";

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(fileUpload({ limits: { fileSize: 40 * 1024 * 1024 }, abortOnLimit: true }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: false }));
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
  ReE(res, SERVER_ERROR_CODE, "Internal Server Error" + err.stack);
});

(async () => {
  try {
    await connectDatabase();
    // await seedRoles();
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

    httpServer.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
      logger.warn(`Server is running on port ${process.env.PORT || 3000}`);
    });
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
})();

setupSocket(httpServer);
registerChatSocket();

export default app;
