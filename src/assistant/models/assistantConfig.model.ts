import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions, jsonArray } from "@db/plugins";

const AssistantConfigSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    model: { type: String, default: "gemini-2.0-flash" },
    embedding_model: { type: String, default: "text-embedding-004" },
    temperature: { type: Number, default: 0.25 },
    top_k: { type: Number, default: 6 },
    chunk_size: { type: Number, default: 900 },
    chunk_overlap: { type: Number, default: 120 },
    max_output_tokens: { type: Number, default: 2048 },
    similarity_threshold: { type: Number, default: 0.55 },
    system_prompt: { type: String },
    welcome_message: { type: String },
    tools_enabled: jsonArray,
    allowed_roles: jsonArray,
    role_access: { type: Schema.Types.Mixed, default: {} },
    blocked_user_ids: jsonArray,
    rules_regulations: { type: String },
    use_company_branding: { type: Boolean, default: true },
    super_admin_unrestricted: { type: Boolean, default: true },
    mcp_enabled: { type: Boolean, default: true },
    rag_enabled: { type: Boolean, default: true },
    store_conversations: { type: Boolean, default: true },
    response_style_version: { type: Number, default: 0 },
  },
  collectionOptions("assistant_configs"),
);

applyBasePlugins(AssistantConfigSchema, { collection: "assistant_configs", paranoid: false });

const AssistantConfig =
  mongoose.models.AssistantConfig ?? mongoose.model("AssistantConfig", AssistantConfigSchema);
export default AssistantConfig;
