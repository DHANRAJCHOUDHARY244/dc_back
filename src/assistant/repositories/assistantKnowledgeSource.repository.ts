import AssistantKnowledgeSource from "../models/assistantKnowledgeSource.model";
import { BaseRepository } from "@repositories/BaseRepository";

export class AssistantKnowledgeSourceRepository extends BaseRepository {
  constructor() {
    super(AssistantKnowledgeSource, true);
  }
}

export const assistantKnowledgeSourceRepository = new AssistantKnowledgeSourceRepository();
