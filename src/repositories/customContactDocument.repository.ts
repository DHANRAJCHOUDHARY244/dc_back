import CustomContactDocument from "@models/customContactDocument.model";
import { BaseRepository } from "./BaseRepository";

export class CustomContactDocumentRepository extends BaseRepository {
  constructor() {
    super(CustomContactDocument, true);
  }
}

export const customContactDocumentRepository = new CustomContactDocumentRepository();
