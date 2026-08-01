import Advertising from "@models/advertising.model";
import { BaseRepository } from "./BaseRepository";

export class AdvertisingRepository extends BaseRepository {
  constructor() {
    super(Advertising, false);
  }
}

export const advertisingRepository = new AdvertisingRepository();
