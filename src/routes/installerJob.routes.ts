import installerJobController from "@controllers/installerJob.controller";
import { Router } from "express";

const router = Router();

router.get("/dashboard", installerJobController.dashboard.bind(installerJobController));
router.get("/calendar", installerJobController.calendar.bind(installerJobController));
router.get("/availability", installerJobController.listAvailability.bind(installerJobController));
router.post("/availability", installerJobController.upsertAvailability.bind(installerJobController));
router.post("/list", installerJobController.listJobs.bind(installerJobController));
router.post("/assign", installerJobController.assignFromSiteInfo.bind(installerJobController));
router.get("/:id", installerJobController.getJob.bind(installerJobController));
router.put("/:id/status", installerJobController.updateStatus.bind(installerJobController));
router.put("/:id/checklist", installerJobController.updateChecklist.bind(installerJobController));
router.put("/:id/serials", installerJobController.updateSerials.bind(installerJobController));
router.post("/:id/messages", installerJobController.addMessage.bind(installerJobController));
router.post("/:id/uploads", installerJobController.uploadFiles.bind(installerJobController));
router.put("/:id/completion-report", installerJobController.updateCompletionReport.bind(installerJobController));
router.post("/:id/refresh-pack", installerJobController.refreshPack.bind(installerJobController));

export default router;
