import allInOneJobController from "@controllers/allInOneJob.controller";
import { Router } from "express";

const router = Router();

router.get("/", allInOneJobController.list.bind(allInOneJobController));
router.get("/dashboard", allInOneJobController.dashboard.bind(allInOneJobController));
router.get("/:id", allInOneJobController.getById.bind(allInOneJobController));
router.post("/", allInOneJobController.create.bind(allInOneJobController));
router.put("/:id", allInOneJobController.update.bind(allInOneJobController));
router.delete("/:id", allInOneJobController.remove.bind(allInOneJobController));
router.post("/:id/documents", allInOneJobController.uploadDocuments.bind(allInOneJobController));
router.delete("/:id/documents", allInOneJobController.deleteDocument.bind(allInOneJobController));

/** Public (unauthenticated) view — MongoDB `_id` + numeric `id` (no bypass token). */
export const allInOneJobPublicRouter = Router();
allInOneJobPublicRouter.get(
	"/job/:objectId/:id",
	allInOneJobController.getPublicById.bind(allInOneJobController),
);

export default router;
