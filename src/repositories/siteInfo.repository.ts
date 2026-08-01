import SiteInfo from "@models/site_info.model";
import { BaseRepository } from "./BaseRepository";

export class SiteInfoRepository extends BaseRepository {
  constructor() {
    super(SiteInfo, false);
  }
}

export const siteInfoRepository = new SiteInfoRepository();
