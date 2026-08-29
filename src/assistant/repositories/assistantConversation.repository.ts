import AssistantConversation from "../models/assistantConversation.model";
import { BaseRepository } from "@repositories/BaseRepository";

export class AssistantConversationRepository extends BaseRepository {
  constructor() {
    super(AssistantConversation, true);
  }
}

export const assistantConversationRepository = new AssistantConversationRepository();
