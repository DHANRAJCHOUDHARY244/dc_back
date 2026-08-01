import Notification from "@models/notifications";
import { BaseRepository } from "./BaseRepository";

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification, false);
  }
}

export const notificationRepository = new NotificationRepository();
