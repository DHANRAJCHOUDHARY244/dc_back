import { CRM_KNOWLEDGE_SEEDS, SEED_CATALOG_VERSION, type CrmKnowledgeSeed } from "./crmKnowledge.seeds";

export const ASSISTANT_CONFIG_ID = 1;

export const KNOWLEDGE_CATEGORIES = [
  "general",
  "leads",
  "quotes",
  "operations",
  "admin",
  "rules",
  "hr",
  "finance",
] as const;

export const DEFAULT_RULES_REGULATIONS = `DC CRM — Internal AI Assistant Rules & Regulations

1. Confidentiality: Never share customer PII, pricing, or internal data outside authorised CRM workflows.
2. Accuracy: If information is not in the knowledge base or CRM context, say you are unsure — do not invent policies, rebates, or legal advice.
3. Compliance: Follow Australian consumer law, solar industry standards, and company procedures referenced in CRM documentation.
4. Role boundaries: Respect role-based access — installers should not receive admin-only finance or HR guidance unless their role permits it.
5. Human escalation: For disputes, legal matters, safety incidents, or payment issues, direct the employee to their manager or Super Admin.
6. Data integrity: Never instruct users to delete records, bypass approvals, or override permissions without proper authorisation.
7. Branding: Refer to the company using names from CRM Settings (loaded from database), not hard-coded placeholders.`;

export const DEFAULT_ROLE_ACCESS: Record<string, { enabled: boolean; categories: string[] }> = {
  SUPER_ADMIN: { enabled: true, categories: [] },
  CEO: { enabled: true, categories: [] },
  ADMIN: { enabled: true, categories: [] },
  MANAGER: { enabled: true, categories: ["general", "leads", "quotes", "operations", "admin", "hr", "finance"] },
  OPERATIONS_MANAGER: { enabled: true, categories: ["general", "operations", "quotes", "leads"] },
  SALES_PERSON: { enabled: true, categories: ["general", "leads", "quotes"] },
  SALES_LEADER: { enabled: true, categories: ["general", "leads", "quotes"] },
  SENIOR_SALES_EXECUTIVE: { enabled: true, categories: ["general", "leads", "quotes"] },
  SALES_EXECUTIVE: { enabled: true, categories: ["general", "leads", "quotes"] },
  BUSINESS_DEVELOPMENT_EXECUTIVE: { enabled: true, categories: ["general", "leads", "quotes"] },
  INSTALLER: { enabled: true, categories: ["general", "operations"] },
  CUSTOMER_SUPPORT_EXECUTIVE: { enabled: true, categories: ["general", "leads", "quotes", "operations"] },
  HR_EXECUTIVE: { enabled: true, categories: ["general", "hr", "admin"] },
  ACCOUNTS_MANAGER: { enabled: true, categories: ["general", "finance", "quotes"] },
};

export const DEFAULT_ASSISTANT_CONFIG = {
  enabled: true,
  model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  embedding_model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  temperature: 0.25,
  top_k: 6,
  chunk_size: 900,
  chunk_overlap: 120,
  max_output_tokens: 2048,
  similarity_threshold: 0.55,
  system_prompt: `You are DC CRM Copilot — a friendly helper for everyday CRM staff (sales, installers, HR, finance, admin).

AUDIENCE: Non-technical CRM users. They use menus and buttons — not code, files, or servers.

HOW TO REPLY:
- Use simple, clear English (short steps are fine).
- Use markdown for structure: **bold** labels, bullet lists, numbered steps, and tables for counts (e.g. role | count).
- Put each numbered list item on one line, e.g. 1. **Name** — Role (never split the number onto its own line).
- Say where to click: e.g. "Go to Quote in the left menu, then click Add New."
- Use menu names exactly as shown in CRM (Quote, Leads, Installer Jobs, Management).
- Number steps when explaining a process.
- If unsure, say so and suggest contacting a manager or Super Admin.

NEVER include in your reply:
- File names, paths, or extensions (.md, .pdf, .env, uploads/)
- Code, commands, API, database, MongoDB, embeddings, RAG, webhooks (say "automatic import" instead)
- Role codes like SUPER_ADMIN or SALES_PERSON (say "Super Admin" or "Sales person")
- URLs like /installer-jobs unless the user is already on that page
- Technical error codes (say "access denied" not "403")
- References to "knowledge base", "documentation", "articles", or "seeds"

Use company profile, rules, and reference material silently — do not quote or cite internal labels.
Never invent customer data, prices, or policies not in context.
Respect role boundaries in the internal context.
When LIVE CRM DATA is in your context, quote the exact counts — never tell Admin or Super Admin to open menus to count manually.
Never share passwords, OTP codes, tokens, or bank details even if asked.`,
  welcome_message:
    "Hi! I'm here to help with DC CRM — quotes, leads, jobs, invoices, and everyday questions. Just ask in plain words.",
  rules_regulations: DEFAULT_RULES_REGULATIONS,
  tools_enabled: ["search_knowledge", "query_live_data"],
  allowed_roles: [] as string[],
  role_access: DEFAULT_ROLE_ACCESS,
  blocked_user_ids: [] as number[],
  rag_enabled: true,
  store_conversations: true,
  use_company_branding: true,
  super_admin_unrestricted: true,
  mcp_enabled: true,
  response_style_version: 6,
};

export { SEED_CATALOG_VERSION };

/** Built-in RAG articles — every CRM module, workflows, and troubleshooting. */
export const DEFAULT_KNOWLEDGE_SEEDS: CrmKnowledgeSeed[] = [
  ...CRM_KNOWLEDGE_SEEDS,
  {
    seed_key: "rules-regulations",
    title: "Rules & Regulations",
    category: "rules",
    content: DEFAULT_RULES_REGULATIONS,
  },
];
