import { Router } from "express";
import activityTrackerController from "@controllers/activityTracker.controller";

const router = Router();

router.post("/log",activityTrackerController.logActivity.bind(activityTrackerController));
router.put("/edit",activityTrackerController.editSlot.bind(activityTrackerController));
router.post("/leave",activityTrackerController.markLeave.bind(activityTrackerController));
router.get("/report",activityTrackerController.reportByDate.bind(activityTrackerController));
router.get("/report-by-date-range", activityTrackerController.reportByDateRangeFullLogs.bind(activityTrackerController))
export default router;
