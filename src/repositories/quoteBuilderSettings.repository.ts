import QuoteBuilderSettings from "@models/quoteBuilderSettings.model";
import { BaseRepository } from "./BaseRepository";

export class QuoteBuilderSettingsRepository extends BaseRepository {
  constructor() {
    super(QuoteBuilderSettings, false);
  }
}

export const quoteBuilderSettingsRepository = new QuoteBuilderSettingsRepository();
