import InstallerAgreement from "@models/installerAgreement.model";
import { BaseRepository } from "./BaseRepository";

export class InstallerAgreementRepository extends BaseRepository {
  constructor() {
    super(InstallerAgreement, true);
  }
}

export const installerAgreementRepository = new InstallerAgreementRepository();
