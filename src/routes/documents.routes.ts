import express from "express";
import documentController from "@controllers/document.controller";
const router = express.Router();

router.post("/upload",  documentController.upload.bind(documentController));
router.post("/unique-user", documentController.getAllUniqueUserInfos.bind(documentController));
router.post("/",  documentController.getAllDocuments.bind(documentController));
router.post("/:id",  documentController.getDocument.bind(documentController));
router.delete("/:id",  documentController.deleteDocument.bind(documentController));

export default router;