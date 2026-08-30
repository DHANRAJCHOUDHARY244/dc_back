import { getCompanyConfig } from "@services/crmSettings.service";
import type { AssistantConfigDTO, AssistantUserAccess } from "../types/assistant.types";
import { buildMcpDataContext } from "./assistant.mcp.service";

export async function buildAssistantContextBlock(options: {
  config: AssistantConfigDTO;
  access: AssistantUserAccess;
  ragContext?: string;
  pageContext?: string;
  user?: any;
  userMessage?: string;
}): Promise<string> {
  const { config, access, ragContext, pageContext, user, userMessage } = options;
  const parts: string[] = [];

  if (config.use_company_branding !== false) {
    try {
      const company = await getCompanyConfig();
      parts.push(
        [
          "Company details:",
          `- Name: ${company.name}`,
          company.nameShort && company.nameShort !== company.name
            ? `- Short name: ${company.nameShort}`
            : "",
          company.abn ? `- ABN: ${company.abn}` : "",
          company.email ? `- Email: ${company.email}` : "",
          company.phoneNumber ? `- Phone: ${company.phoneNumber}` : "",
          company.website ? `- Website: ${company.website}` : "",
          company.address ? `- Address: ${company.address}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch {
      /* company settings optional */
    }
  }

  if (config.rules_regulations?.trim()) {
    parts.push(
      `Company rules (always follow — do not repeat this heading to the user):\n${config.rules_regulations.trim()}`,
    );
  }

  if (access.mcp && config.mcp_enabled !== false) {
    try {
      const liveData = await buildMcpDataContext({
        message: userMessage || "",
        pageContext,
        user,
      });
      if (liveData.trim()) parts.push(liveData.trim());
    } catch (err) {
      parts.push(`(Live CRM data error: ${(err as Error).message})`);
    }
  }

  if (access.mcp) {
    parts.push(
      "INTERNAL: Admin/Super Admin — LIVE CRM DATA above is real database output. Quote exact counts and names from it. Answer the user's question directly using that data. Never say you cannot access live numbers. Never share passwords, OTPs, API keys, bank details, or auth tokens.",
    );
  } else if (access.unrestricted) {
    parts.push(
      "INTERNAL: User has full admin access. You may answer about any CRM area.",
    );
  } else if (access.categories?.length) {
    parts.push(
      `INTERNAL: Only answer about topics this employee's role allows. Do not share admin-only finance/HR details if their role is sales or installer.`,
    );
  }

  if (user?.name || user?.role) {
    const roleLabel = String(user?.role || "staff").replace(/_/g, " ").toLowerCase();
    parts.push(`Employee: ${user?.name || "Staff"} (${roleLabel}).`);
  }

  if (ragContext?.trim()) {
    parts.push(`Help topics to use (do not cite these titles or mention files/docs):\n${ragContext.trim()}`);
  }

  if (pageContext?.trim()) {
    parts.push(`User is currently on CRM page: ${pageContext.trim()}`);
  }

  return parts.join("\n\n");
}
