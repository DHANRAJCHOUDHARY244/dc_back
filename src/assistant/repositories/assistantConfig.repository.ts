import AssistantConfig from "../models/assistantConfig.model";
import { BaseRepository } from "@repositories/BaseRepository";

export class AssistantConfigRepository extends BaseRepository {
  constructor() {
    super(AssistantConfig, false);
  }
}

export const assistantConfigRepository = new AssistantConfigRepository();
