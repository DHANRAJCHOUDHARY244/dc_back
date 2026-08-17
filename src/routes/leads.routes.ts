import express from "express";
import leadsController from "@controllers/leads.controller";

const router = express.Router();

router.get("/pipeline-meta", leadsController.getPipelineMeta.bind(leadsController));
router.get("/dashboard", leadsController.dashboard.bind(leadsController));
router.get("/analytics", leadsController.analytics.bind(leadsController));
router.get("/settings", leadsController.getSettings.bind(leadsController));
router.post("/settings", leadsController.saveSettings.bind(leadsController));
router.post("/areas", leadsController.saveArea.bind(leadsController));
router.post("/agents", leadsController.saveAgent.bind(leadsController));
router.post("/command", leadsController.command.bind(leadsController));
router.post("/assign", leadsController.assign.bind(leadsController));
router.post("/run-supervisor", leadsController.runSupervisor.bind(leadsController));
router.post("/sheet-metadata", leadsController.getMetadata.bind(leadsController));
router.post("/process-sheet", leadsController.processSheet.bind(leadsController));
router.post("/create", leadsController.create.bind(leadsController));
router.get("/list-all", leadsController.list.bind(leadsController));
router.post("/bulk-delete", leadsController.bulkDelete.bind(leadsController));
router.post("/:id/log-call", leadsController.logCall.bind(leadsController));
router.post("/:id/status", leadsController.updateStatus.bind(leadsController));
router.post("/:id/qualify", leadsController.qualify.bind(leadsController));
router.post("/:id/notes", leadsController.addNote.bind(leadsController));
router.post("/:id/transfer", leadsController.transfer.bind(leadsController));
router.post("/:id/duplicates", leadsController.duplicates.bind(leadsController));
router.put("/:id", leadsController.update.bind(leadsController));
router.delete("/:id", leadsController.delete.bind(leadsController));
router.get("/:id", leadsController.getLeadById.bind(leadsController));

export default router;
