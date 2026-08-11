import express from "express";
import feedbackController from "@controllers/feedback.controller";

const router = express.Router();

router.get("/notices", feedbackController.getPublicNotices.bind(feedbackController));
router.get("/settings", feedbackController.getSettings.bind(feedbackController));
router.put("/settings", feedbackController.updateSettings.bind(feedbackController));

router.post("/complaints", feedbackController.submitComplaint.bind(feedbackController));
router.post("/suggestions", feedbackController.submitSuggestion.bind(feedbackController));

router.get("/my", feedbackController.myCases.bind(feedbackController));

router.get("/admin/dashboard", feedbackController.adminDashboard.bind(feedbackController));
router.get("/admin/cases", feedbackController.adminListCases.bind(feedbackController));
router.post("/admin/cases/list", feedbackController.adminListCases.bind(feedbackController));
router.get("/admin/cases/:id", feedbackController.getCase.bind(feedbackController));
router.patch("/admin/cases/:id", feedbackController.updateCase.bind(feedbackController));
router.post("/admin/cases/:id/notes", feedbackController.addInternalNote.bind(feedbackController));
router.post("/admin/cases/:id/unlock", feedbackController.unlockIdentity.bind(feedbackController));
router.get("/admin/audit", feedbackController.listAudit.bind(feedbackController));
router.post("/admin/audit/list", feedbackController.listAudit.bind(feedbackController));

router.get("/cases/:id", feedbackController.getCase.bind(feedbackController));
router.post("/cases/:id/messages", feedbackController.addMessage.bind(feedbackController));

export default router;
