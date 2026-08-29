import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { SUCCESS_CODE, SERVER_ERROR_CODE } from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import { Roles } from "../../data/dataInserter";
import {
  getAssistantConfig,
  updateAssistantConfig,
} from "../services/assistant.config.service";
import {
  resolveUserAssistantAccess,
} from "../services/assistant.access.service";
import { queryLiveCrmData, buildMcpQueryPlan } from "../services/assistant.mcp.service";
import {
  chatWithAssistant,
  getAssistantStatusForUser,
  getConversation,
  listUserConversations,
} from "../services/rag/orchestrator.service";
import {
  createTextSource,
  ingestSourceById,
  ingestUploadedFile,
} from "../services/rag/ingestion.service";
import { assistantKnowledgeSourceRepository } from "../repositories/assistantKnowledgeSource.repository";
import path from "path";
import fs from "fs/promises";

function isAdmin(user: any) {
  const role = String(user?.role || "");
  return [Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CEO, Roles.MANAGER].includes(role);
}

function isSuperAdmin(user: any) {
  return String(user?.role || "") === Roles.SUPER_ADMIN;
}

class AssistantController {
  async status(req: AuthenticatedRequest, res: Response) {
    try {
      const config = await getAssistantConfig();
      const status = getAssistantStatusForUser(req.user, config);
      return ReS(res, SUCCESS_CODE, "Assistant status", status);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async getConfig(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isAdmin(req.user)) return ReE(res, 403, "Admin access required");
      const config = await getAssistantConfig();
      return ReS(res, SUCCESS_CODE, "Assistant config", config);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async updateConfig(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isAdmin(req.user)) return ReE(res, 403, "Admin access required");
      const body = req.body || {};
      if (
        !isSuperAdmin(req.user) &&
        (body.role_access || body.blocked_user_ids || body.mcp_enabled !== undefined || body.super_admin_unrestricted !== undefined)
      ) {
        return ReE(res, 403, "Super Admin required to change access control settings");
      }
      const config = await updateAssistantConfig(body);
      return ReS(res, SUCCESS_CODE, "Assistant config updated", config);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async chat(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await chatWithAssistant(req.user, req.body || {});
      return ReS(res, SUCCESS_CODE, "Assistant reply", result);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Chat failed");
    }
  }

  /** Admin / Super Admin — preview MCP query plan (no DB). */
  async mcpQueryPlan(req: AuthenticatedRequest, res: Response) {
    try {
      const config = await getAssistantConfig();
      const access = resolveUserAssistantAccess(req.user, config);
      if (!access.mcp) {
        return ReE(res, 403, "Live CRM data is only available for Admin and Super Admin");
      }
      const q = String(req.query.q || req.body?.message || "").trim();
      if (!q) return ReE(res, 400, "Query message is required (q or message)");
      const page = String(req.query.page || req.body?.page_context || "").trim();
      const plan = buildMcpQueryPlan(q, page || undefined);
      return ReS(res, SUCCESS_CODE, "MCP query plan", plan);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Query plan failed");
    }
  }

  /** Admin / Super Admin — live CRM data from database (no passwords). */
  async mcpLiveData(req: AuthenticatedRequest, res: Response) {
    try {
      const config = await getAssistantConfig();
      const access = resolveUserAssistantAccess(req.user, config);
      if (!access.mcp) {
        return ReE(res, 403, "Live CRM data is only available for Admin and Super Admin");
      }
      const q = String(req.query.q || req.body?.message || "CRM snapshot").trim();
      const page = String(req.query.page || req.body?.page_context || "").trim();
      const data = await queryLiveCrmData(q, page || undefined);
      const message =
        data.status === "success"
          ? "Live CRM data"
          : data.status === "partial"
            ? "Live CRM data (partial)"
            : data.status === "empty"
              ? "No matching live data"
              : "Live CRM query failed";
      return ReS(res, SUCCESS_CODE, message, data);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Live data failed");
    }
  }

  async listConversations(req: AuthenticatedRequest, res: Response) {
    try {
      const rows = await listUserConversations(Number(req.user.id));
      return ReS(res, SUCCESS_CODE, "Conversations", rows);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async getConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const row = await getConversation(Number(req.user.id), Number(req.params.id));
      if (!row) return ReE(res, 404, "Conversation not found");
      return ReS(res, SUCCESS_CODE, "Conversation", row);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async listKnowledgeSources(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isAdmin(req.user)) return ReE(res, 403, "Admin access required");
      const rows = await assistantKnowledgeSourceRepository.find(
        {},
        { sort: { created_at: -1 }, lean: true },
      );
      return ReS(res, SUCCESS_CODE, "Knowledge sources", rows);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async createKnowledgeSource(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isAdmin(req.user)) return ReE(res, 403, "Admin access required");
      const { title, content, category } = req.body || {};
      if (!title || !content) return ReE(res, 400, "title and content are required");
      const result = await createTextSource({
        title,
        content,
        category,
        created_by: Number(req.user.id),
      });
      return ReS(res, SUCCESS_CODE, "Knowledge source indexed", result);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async reindexKnowledgeSource(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isAdmin(req.user)) return ReE(res, 403, "Admin access required");
      const result = await ingestSourceById(Number(req.params.id));
      return ReS(res, SUCCESS_CODE, "Reindexed", result);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async deleteKnowledgeSource(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isAdmin(req.user)) return ReE(res, 403, "Admin access required");
      await assistantKnowledgeSourceRepository.softDeleteById(Number(req.params.id));
      return ReS(res, SUCCESS_CODE, "Deleted", {});
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Failed");
    }
  }

  async uploadKnowledgeFile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isAdmin(req.user)) return ReE(res, 403, "Admin access required");
      const file = (req as any).files?.file;
      if (!file) return ReE(res, 400, "file is required");

      const uploadDir = path.join(process.cwd(), "uploads", "assistant-knowledge");
      await fs.mkdir(uploadDir, { recursive: true });
      const safeName = `${Date.now()}-${String(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const dest = path.join(uploadDir, safeName);
      await file.mv(dest);

      const result = await ingestUploadedFile({
        filePath: dest,
        fileName: file.name,
        mimeType: file.mimetype,
        title: req.body?.title || file.name,
        category: req.body?.category || "general",
        created_by: Number(req.user.id),
      });

      return ReS(res, SUCCESS_CODE, "File indexed", result);
    } catch (e: any) {
      return ReE(res, SERVER_ERROR_CODE, e.message || "Upload failed");
    }
  }
}

export default new AssistantController();
