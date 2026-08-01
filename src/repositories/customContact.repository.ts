import CustomContact from "@models/customContact.model";
import { BaseRepository } from "./BaseRepository";

export class CustomContactRepository extends BaseRepository {
  constructor() {
    super(CustomContact, true);
  }
}

export const customContactRepository = new CustomContactRepository();
