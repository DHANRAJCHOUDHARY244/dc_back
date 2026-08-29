import InstallerJob from "@models/installerJob.model";
import { BaseRepository } from "./BaseRepository";

export class InstallerJobRepository extends BaseRepository {
  constructor() {
    super(InstallerJob, true);
  }
}

export const installerJobRepository = new InstallerJobRepository();
