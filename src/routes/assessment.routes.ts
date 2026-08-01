import assessmentController from "@controllers/assessment.controller";
import { Router } from "express";

const router = Router();

// Admin routes (protected)
router.post("/create",  assessmentController.createAssessment.bind(assessmentController));
router.post("/follow-up", assessmentController.sendAssessmentFollowUp.bind(assessmentController));
router.get("/",  assessmentController.getAssessments.bind(assessmentController));
router.get("/stats",  assessmentController.getAssessmentStats.bind(assessmentController));
router.get("/:id",  assessmentController.getAssessmentById.bind(assessmentController));
router.get("/no-token/:id",  assessmentController.getAssessmentByIdNoToken.bind(assessmentController));
router.put("/:id",  assessmentController.updateAssessment.bind(assessmentController));
router.patch("/:id/status",  assessmentController.updateAssessmentStatus.bind(assessmentController));
router.delete("/:id",  assessmentController.deleteAssessment.bind(assessmentController));

// Public route (customer submission)
router.post("/submit", assessmentController.submitAssessment.bind(assessmentController));

export default router;
