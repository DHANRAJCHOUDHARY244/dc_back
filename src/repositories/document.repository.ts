import Document from "@models/document.model";
import { BaseRepository } from "./BaseRepository";

export class DocumentRepository extends BaseRepository {
  constructor() {
    super(Document, false);
  }
}

export const documentRepository = new DocumentRepository();
