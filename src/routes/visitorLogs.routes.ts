import visitorLogsController from "@controllers/visitorLogs.controller";
import { Router } from "express";
const router = Router();
router.post("/create-update",visitorLogsController.addOrUpdateLogs.bind(visitorLogsController));
router.get("/logs-by-quoteId",visitorLogsController.getlogsByQuoteId.bind(visitorLogsController));
export default router;