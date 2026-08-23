import RebateScheme from "@models/rebateScheme.model";
import { BaseRepository } from "./BaseRepository";

export class RebateSchemeRepository extends BaseRepository {
  constructor() {
    super(RebateScheme, true);
  }
}

export const rebateSchemeRepository = new RebateSchemeRepository();
