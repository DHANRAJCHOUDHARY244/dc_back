import popupFormController from "@controllers/popupForm.controller";
import { Router } from "express";
const router = Router();

router.post("/add",popupFormController.handlePopupFormSubmission.bind(popupFormController));
router.post("/v1/get-all", popupFormController.getAllPopupForms.bind(popupFormController));
router.get("/v1/analytics",popupFormController.getPopupFormAnalytics.bind(popupFormController));
router.get("/v1/:id",popupFormController.getPopupFormById.bind(popupFormController));
export default router;
