import express from "express";
import trainingController from "@controllers/training.controller";

const router = express.Router();

router.get("/categories", trainingController.listCategories.bind(trainingController));
router.post("/categories", trainingController.createCategory.bind(trainingController));
router.put("/categories/:id", trainingController.updateCategory.bind(trainingController));
router.delete("/categories/:id", trainingController.deleteCategory.bind(trainingController));

router.get("/resources", trainingController.listResources.bind(trainingController));
router.post("/resources/list", trainingController.listResources.bind(trainingController));
router.get("/resources/:id", trainingController.getResource.bind(trainingController));
router.post("/resources", trainingController.createResource.bind(trainingController));
router.put("/resources/:id", trainingController.updateResource.bind(trainingController));
router.delete("/resources/:id", trainingController.deleteResource.bind(trainingController));

router.get("/courses", trainingController.listCourses.bind(trainingController));
router.post("/courses", trainingController.createCourse.bind(trainingController));
router.put("/courses/:id", trainingController.updateCourse.bind(trainingController));

router.post("/assignments", trainingController.createAssignment.bind(trainingController));

router.get("/my/dashboard", trainingController.myDashboard.bind(trainingController));
router.get("/my/assignments", trainingController.myAssignments.bind(trainingController));
router.get("/my/progress", trainingController.myProgressHistory.bind(trainingController));

router.post("/progress/start", trainingController.progressStart.bind(trainingController));
router.post("/progress/heartbeat", trainingController.progressHeartbeat.bind(trainingController));
router.post("/progress/complete", trainingController.progressComplete.bind(trainingController));

router.get("/settings", trainingController.getSettings.bind(trainingController));
router.put("/settings", trainingController.updateSettings.bind(trainingController));

router.get("/reports/summary", trainingController.reportsSummary.bind(trainingController));

export default router;
