import ActivityTracker from "@models/activityTracker.model";
import { BaseRepository } from "./BaseRepository";

export class ActivityTrackerRepository extends BaseRepository {
  constructor() {
    super(ActivityTracker, false);
  }
}

export const activityTrackerRepository = new ActivityTrackerRepository();
