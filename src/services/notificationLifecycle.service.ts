import { notificationRepository } from "@repositories";

const NOTIFICATION_RETENTION_DAYS = 30;

export function notificationCutoffDate() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NOTIFICATION_RETENTION_DAYS);
  return cutoff;
}

export async function purgeExpiredNotifications() {
  const cutoff = notificationCutoffDate();
  const result: any = await notificationRepository.deleteMany({
    created_at: { $lt: cutoff },
  });
  return result?.deletedCount ?? 0;
}

export function chatNotificationRoute(chatId: number | string) {
  const front = process.env.FRONT_URL || process.env.FRONTEND_URL || "";
  return `${front}/#/chat?chatId=${chatId}`;
}
