import express from "express";
import leadsController from "@controllers/leads.controller";

const router = express.Router();

router.post("/sheet-metadata", leadsController.getMetadata.bind(leadsController));
router.post("/process-sheet", leadsController.processSheet.bind(leadsController));
router.post("/create", leadsController.create.bind(leadsController));
router.get("/list-all", leadsController.list.bind(leadsController));
router.put("/:id", leadsController.update.bind(leadsController));
router.delete("/:id", leadsController.delete.bind(leadsController));
router.post("/bulk-delete", leadsController.bulkDelete.bind(leadsController));
router.get("/:id",leadsController.getLeadById.bind(leadsController));
export default router;
