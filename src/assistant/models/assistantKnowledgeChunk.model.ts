import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";

const AssistantKnowledgeChunkSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    source_id: { type: Number, required: true, index: true },
    chunk_index: { type: Number, default: 0 },
    title: { type: String },
    category: { type: String, index: true },
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    token_estimate: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  collectionOptions("assistant_knowledge_chunks"),
);

AssistantKnowledgeChunkSchema.index({ source_id: 1, chunk_index: 1 });

applyBasePlugins(AssistantKnowledgeChunkSchema, {
  collection: "assistant_knowledge_chunks",
  paranoid: true,
});

const AssistantKnowledgeChunk =
  mongoose.models.AssistantKnowledgeChunk ??
  mongoose.model("AssistantKnowledgeChunk", AssistantKnowledgeChunkSchema);
export default AssistantKnowledgeChunk;
