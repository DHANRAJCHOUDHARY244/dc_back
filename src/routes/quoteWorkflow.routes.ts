import express from "express";
import controller from "@controllers/quoteWorkflow.controller";

const router = express.Router();

router.post("/", controller.create.bind(controller));
router.get("/", controller.list.bind(controller));
router.get("/:id", controller.get.bind(controller));
router.put("/:id", controller.update.bind(controller));
router.delete("/:id", controller.delete.bind(controller));

router.post("/:id/upload-docs", controller.uploadInstallerDocs.bind(controller));

export default router;