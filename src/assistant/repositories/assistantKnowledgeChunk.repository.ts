import AssistantKnowledgeChunk from "../models/assistantKnowledgeChunk.model";
import { BaseRepository } from "@repositories/BaseRepository";

export class AssistantKnowledgeChunkRepository extends BaseRepository {
  constructor() {
    super(AssistantKnowledgeChunk, true);
  }
}

export const assistantKnowledgeChunkRepository = new AssistantKnowledgeChunkRepository();
