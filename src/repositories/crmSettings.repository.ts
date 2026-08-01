import CrmSettings from "@models/crmSettings.model";
import { BaseRepository } from "./BaseRepository";

export class CrmSettingsRepository extends BaseRepository {
  constructor() {
    super(CrmSettings, false);
  }
}

export const crmSettingsRepository = new CrmSettingsRepository();
