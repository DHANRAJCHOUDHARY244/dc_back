import InstallerDocument from "@models/installerDocument.model";
import { BaseRepository } from "./BaseRepository";

export class InstallerDocumentRepository extends BaseRepository {
  constructor() {
    super(InstallerDocument, true);
  }
}

export const installerDocumentRepository = new InstallerDocumentRepository();
