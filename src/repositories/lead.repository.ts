import Lead from "@models/lead.model";
import { BaseRepository } from "./BaseRepository";

export class LeadRepository extends BaseRepository {
  constructor() {
    super(Lead, true);
  }
}

export const leadRepository = new LeadRepository();
