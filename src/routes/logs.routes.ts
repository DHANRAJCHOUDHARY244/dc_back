import { Router } from "express";
import logController from "@controllers/log.controller";

const router = Router();

router.get("/logs", logController.getLogs.bind(logController));
router.get("/logs/:id", logController.getLogById.bind(logController));

export default router;
