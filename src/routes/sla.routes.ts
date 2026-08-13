import { Router } from "express";
import slaController from "@controllers/sla.controller";

const router = Router();

router.post("/seed", slaController.seed.bind(slaController));
router.get("/settings/stages", slaController.getSettings.bind(slaController));
router.put("/settings/stages", slaController.updateSettings.bind(slaController));
router.get("/delay-reasons", slaController.delayReasons.bind(slaController));
router.get("/alerts/summary", slaController.alertsSummary.bind(slaController));
router.get("/delayed-jobs", slaController.delayedJobs.bind(slaController));
router.post("/delayed-jobs", slaController.delayedJobs.bind(slaController));
router.get("/quotes/:id/timeline", slaController.quoteTimeline.bind(slaController));
router.post("/runs/:id/reason", slaController.setReason.bind(slaController));
router.post("/runs/:id/resolve", slaController.resolve.bind(slaController));
router.get("/stage-counts", slaController.stageCounts.bind(slaController));
router.post("/evaluate", slaController.evaluate.bind(slaController));

export default router;
