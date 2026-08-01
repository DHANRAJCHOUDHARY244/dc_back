import customContactController from "@controllers/customContact.controller";
import { Router } from "express";

const router = Router();

router.post("/", customContactController.saveContact.bind(customContactController));
router.put("/:token", customContactController.updateContact.bind(customContactController));
router.post("/sign", customContactController.signContact.bind(customContactController));
router.post(
  "/document",
  customContactController.uploadContactDocument.bind(customContactController)
);
router.get("/", customContactController.getContact.bind(customContactController));
router.get(
  "/documents/:id",
  customContactController.getContactDocuments.bind(customContactController)
);
router.post("/list", customContactController.getAllContacts.bind(customContactController));
router.post(
  "/follow-up",
  customContactController.sendContactFollowUp.bind(customContactController)
);
router.post("/send-pdf", customContactController.sendContactPdf.bind(customContactController));
router.delete(
  "/:id",
  customContactController.deleteContactDocument.bind(customContactController)
);
router.delete(
  "/agreement/:id",
  customContactController.deleteContact.bind(customContactController)
);

export default router;
