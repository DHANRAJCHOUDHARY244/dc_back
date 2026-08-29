import InstallerAvailability from "@models/installerAvailability.model";
import { BaseRepository } from "./BaseRepository";

export class InstallerAvailabilityRepository extends BaseRepository {
  constructor() {
    super(InstallerAvailability, true);
  }
}

export const installerAvailabilityRepository = new InstallerAvailabilityRepository();
