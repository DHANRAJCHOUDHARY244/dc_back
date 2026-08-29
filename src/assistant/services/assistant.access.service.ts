import { Roles } from "../../data/dataInserter";
import type { AssistantConfigDTO, AssistantUserAccess, RoleAccessPolicy } from "../types/assistant.types";
import { roleHasMcpAccess } from "./assistant.mcp.service";

export function resolveUserAssistantAccess(
  user: any,
  config: AssistantConfigDTO,
): AssistantUserAccess {
  const role = String(user?.role || "");
  const userId = Number(user?.id);
  const mcp = roleHasMcpAccess(role, config);

  if (role === Roles.CUSTOMER) {
    return {
      allowed: false,
      unrestricted: false,
      categories: [],
      mcp: false,
      reason: "Assistant is not available for customer accounts",
    };
  }

  if (config.blocked_user_ids?.includes(userId)) {
    return {
      allowed: false,
      unrestricted: false,
      categories: [],
      mcp: false,
      reason: "Your account does not have access to the assistant",
    };
  }

  const isSuperAdmin = role === Roles.SUPER_ADMIN;
  if (isSuperAdmin && config.super_admin_unrestricted !== false) {
    return {
      allowed: true,
      unrestricted: true,
      categories: [],
      mcp,
      reason: undefined,
    };
  }

  if (config.allowed_roles?.length && !config.allowed_roles.includes(role)) {
    return {
      allowed: false,
      unrestricted: false,
      categories: [],
      mcp: false,
      reason: "Your role does not have access to the assistant",
    };
  }

  const policy: RoleAccessPolicy | undefined = config.role_access?.[role];
  if (policy && policy.enabled === false) {
    return {
      allowed: false,
      unrestricted: false,
      categories: [],
      mcp: false,
      reason: "Assistant is disabled for your role",
    };
  }

  const isAdminMcp = mcp && role === Roles.ADMIN;

  return {
    allowed: true,
    unrestricted: isAdminMcp || role === Roles.SUPER_ADMIN,
    categories: policy?.categories?.length ? policy.categories : [],
    mcp,
    reason: undefined,
  };
}

export function getRetrievalOptions(
  config: AssistantConfigDTO,
  access: AssistantUserAccess,
): { topK: number; threshold: number; categories?: string[] } {
  if (access.unrestricted) {
    return {
      topK: Math.max(config.top_k, 12),
      threshold: Math.min(config.similarity_threshold, 0.45),
      categories: undefined,
    };
  }

  return {
    topK: config.top_k,
    threshold: config.similarity_threshold,
    categories: access.categories?.length ? access.categories : undefined,
  };
}
