import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const AssistantKnowledgeSourceSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    title: { type: String, required: true },
    category: { type: String, default: "general", index: true },
    source_type: { type: String, enum: ["text", "file", "url", "seed"], default: "text" },
    content: { type: String },
    file_path: { type: String },
    file_name: { type: String },
    mime_type: { type: String },
    status: { type: String, enum: ["pending", "indexed", "failed"], default: "pending", index: true },
    chunk_count: { type: Number, default: 0 },
    error_message: { type: String },
    created_by: { type: Number, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  collectionOptions("assistant_knowledge_sources"),
);

applyBasePlugins(AssistantKnowledgeSourceSchema, {
  collection: "assistant_knowledge_sources",
  paranoid: true,
});

const AssistantKnowledgeSource =
  mongoose.models.AssistantKnowledgeSource ??
  mongoose.model("AssistantKnowledgeSource", AssistantKnowledgeSourceSchema);
export default AssistantKnowledgeSource;
