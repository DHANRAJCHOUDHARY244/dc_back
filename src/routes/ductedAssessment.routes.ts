import ductedAssessmentController from "@controllers/ductedAssessment.controller";
import { Router } from "express";
const router = Router();

router.post("/v1/create",ductedAssessmentController.create.bind(ductedAssessmentController));
router.put("/v1/update/:id", ductedAssessmentController.update.bind(ductedAssessmentController));
router.post("/v1/list-all", ductedAssessmentController.listAll.bind(ductedAssessmentController));
router.delete("/v1/delete/:id", ductedAssessmentController.delete.bind(ductedAssessmentController));
router.post("/v1/get-by-id", ductedAssessmentController.getById.bind(ductedAssessmentController));
router.post("/v1/update-cust-assessor-sign",ductedAssessmentController.updateSign.bind(ductedAssessmentController));
export default router;