import { Router } from "express";
const router = Router();
import contactFormController from "@controllers/contactForm.controller";

router.post("/add",contactFormController.handleContactFormSubmission.bind(contactFormController));
router.post("/v1/get-all", contactFormController.getContactFormSubmissions.bind(contactFormController));
router.get("/v1/analytics",contactFormController.getContactFormAnalytics.bind(contactFormController));
router.post("/v1/contact-user-details-edit",contactFormController.editContactFormUserInfo.bind(contactFormController));
export default router;