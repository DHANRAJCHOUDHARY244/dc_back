import { Router } from "express";
import masterTaskController from "@controllers/masterTask.controller";

const router = Router();

router.post("/seed", masterTaskController.seed.bind(masterTaskController));
router.post("/create", masterTaskController.create.bind(masterTaskController));
router.post("/list", masterTaskController.list.bind(masterTaskController));
router.get("/summary", masterTaskController.summary.bind(masterTaskController));
router.get("/types", masterTaskController.types.bind(masterTaskController));
router.get("/escalation-rules", masterTaskController.escalationRules.bind(masterTaskController));
router.put("/escalation-rules", masterTaskController.saveEscalationRules.bind(masterTaskController));
router.put("/:id/status", masterTaskController.updateStatus.bind(masterTaskController));
router.post("/:id/comments", masterTaskController.comment.bind(masterTaskController));
router.post("/follow-ups", masterTaskController.createFollowUp.bind(masterTaskController));
router.post("/follow-ups/list", masterTaskController.listFollowUps.bind(masterTaskController));
router.post("/follow-ups/:id/complete", masterTaskController.completeFollowUp.bind(masterTaskController));
router.post("/evaluate", masterTaskController.evaluate.bind(masterTaskController));

export default router;
