import express from "express";
import assistantController from "../controllers/assistant.controller";

const router = express.Router();

router.get("/status", assistantController.status.bind(assistantController));
router.get("/config", assistantController.getConfig.bind(assistantController));
router.put("/config", assistantController.updateConfig.bind(assistantController));
router.post("/chat", assistantController.chat.bind(assistantController));
router.get("/mcp/query-plan", assistantController.mcpQueryPlan.bind(assistantController));
router.post("/mcp/query-plan", assistantController.mcpQueryPlan.bind(assistantController));
router.get("/mcp/live-data", assistantController.mcpLiveData.bind(assistantController));
router.post("/mcp/live-data", assistantController.mcpLiveData.bind(assistantController));
router.get("/conversations", assistantController.listConversations.bind(assistantController));
router.get("/conversations/:id", assistantController.getConversation.bind(assistantController));

router.get("/knowledge/sources", assistantController.listKnowledgeSources.bind(assistantController));
router.post("/knowledge/sources", assistantController.createKnowledgeSource.bind(assistantController));
router.post(
  "/knowledge/sources/:id/reindex",
  assistantController.reindexKnowledgeSource.bind(assistantController),
);
router.delete(
  "/knowledge/sources/:id",
  assistantController.deleteKnowledgeSource.bind(assistantController),
);
router.post("/knowledge/upload", assistantController.uploadKnowledgeFile.bind(assistantController));

export default router;
