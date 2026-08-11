import express from "express";
import hrController from "@controllers/hr.controller";

const router = express.Router();

router.post("/bootstrap", hrController.bootstrap.bind(hrController));
router.get("/settings", hrController.getSettings.bind(hrController));
router.put("/settings", hrController.updateSettings.bind(hrController));

router.post("/employees", hrController.listEmployees.bind(hrController));
router.get("/employees/me", hrController.getMyProfile.bind(hrController));
router.put("/employees/:userId", hrController.updateEmployee.bind(hrController));

router.post("/check-in", hrController.checkIn.bind(hrController));
router.post("/check-out", hrController.checkOut.bind(hrController));
router.get("/today", hrController.todayMine.bind(hrController));
router.post("/mark", hrController.hrMark.bind(hrController));
router.post("/attendance/list", hrController.listAttendance.bind(hrController));
router.get("/dashboard", hrController.dashboard.bind(hrController));
router.post("/reports/monthly", hrController.monthlyReport.bind(hrController));
router.post("/reports/export-csv", hrController.exportCsv.bind(hrController));
router.get("/attendance-summary", hrController.attendanceSummary.bind(hrController));
router.post("/attendance-summary", hrController.attendanceSummary.bind(hrController));

router.get("/shifts", hrController.listShifts.bind(hrController));
router.post("/shifts", hrController.saveShift.bind(hrController));

router.post("/holidays/list", hrController.listHolidays.bind(hrController));
router.post("/holidays", hrController.saveHoliday.bind(hrController));
router.delete("/holidays/:id", hrController.deleteHoliday.bind(hrController));

router.get("/leave-types", hrController.listLeaveTypes.bind(hrController));
router.get("/leave-balances", hrController.myLeaveBalances.bind(hrController));
router.post("/leave", hrController.submitLeave.bind(hrController));
router.post("/leave/list", hrController.listLeaves.bind(hrController));
router.post("/leave/:id/action", hrController.actionLeave.bind(hrController));

router.post("/corrections", hrController.submitCorrection.bind(hrController));
router.post("/corrections/list", hrController.listCorrections.bind(hrController));
router.post("/corrections/:id/action", hrController.actionCorrection.bind(hrController));

router.post("/month-lock", hrController.lockMonth.bind(hrController));
router.post("/month-unlock", hrController.unlockMonth.bind(hrController));
router.get("/month-locks", hrController.listLocks.bind(hrController));

router.post("/analytics", hrController.analytics.bind(hrController));
router.post("/audit-logs", hrController.auditLogs.bind(hrController));
router.post("/finalize-absents", hrController.finalizeAbsents.bind(hrController));

export default router;
