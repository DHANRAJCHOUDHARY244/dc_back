export type AssistantToolName = "search_knowledge" | "query_live_data";

export type RoleAccessPolicy = {
  enabled: boolean;
  categories: string[];
};

export type AssistantConfigDTO = {
  enabled: boolean;
  model: string;
  embedding_model: string;
  temperature: number;
  top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  max_output_tokens: number;
  similarity_threshold: number;
  system_prompt: string;
  welcome_message: string;
  rules_regulations: string;
  tools_enabled: AssistantToolName[];
  allowed_roles: string[];
  role_access: Record<string, RoleAccessPolicy>;
  blocked_user_ids: number[];
  rag_enabled: boolean;
  store_conversations: boolean;
  use_company_branding: boolean;
  super_admin_unrestricted: boolean;
  mcp_enabled: boolean;
  response_style_version?: number;
};

export type AssistantUserAccess = {
  allowed: boolean;
  unrestricted: boolean;
  categories: string[];
  mcp: boolean;
  reason?: string;
};

export type AssistantStatusDTO = {
  configured: boolean;
  enabled: boolean;
  model: string;
  rag_enabled: boolean;
  welcome_message: string;
  access: AssistantUserAccess;
};

export type ChatMessageDTO = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
};

export type RAGChunkHit = {
  chunk_id: number;
  source_id: number;
  title: string;
  content: string;
  score: number;
  category?: string;
};

export type AssistantChatRequest = {
  message: string;
  conversation_id?: number;
  page_context?: string;
};

export type AssistantChatResponse = {
  conversation_id: number;
  reply: string;
  sources: RAGChunkHit[];
  model: string;
};
