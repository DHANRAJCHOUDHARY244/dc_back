import { DEFAULT_INSTALLATION_TYPES } from "@constants/categoryMeta";
import { quoteBuilderSettingsRepository } from "@repositories";

export async function getOrCreateQuoteBuilderSettings() {
  let settings: any = await quoteBuilderSettingsRepository.findOne({ id: 1 }, { lean: true });
  if (!settings) {
    settings = await quoteBuilderSettingsRepository.create({
      id: 1,
      installation_types: DEFAULT_INSTALLATION_TYPES,
    });
  }
  if (!settings.installation_types?.length) {
    settings = await quoteBuilderSettingsRepository.updateById(1, {
      $set: { installation_types: DEFAULT_INSTALLATION_TYPES },
    });
  }
  return settings;
}
