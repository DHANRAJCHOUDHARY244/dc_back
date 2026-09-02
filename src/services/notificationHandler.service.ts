import Notification from "@models/notifications";
import { notificationRepository } from "@repositories";
import { SOCKET_EVENTS } from "@constants/socket.constants";
import { SocketService } from "@services/socket.service";
import { buildNotificationDedupKey, withNotificationDedupLock } from "@services/notificationDedup.service";

export type CreateNotificationResult = {
  notification: any;
  created: boolean;
};

export type DispatchNotificationInput = {
  userId: number;
  message: string;
  route: string | null;
  meta?: Record<string, any>;
  /** Optional real-time push — only emitted when a new row is created. */
  socket?: {
    payload: Record<string, unknown>;
  };
};

let indexesEnsured = false;

async function ensureNotificationIndexes() {
  if (indexesEnsured) return;
  try {
    await Notification.syncIndexes();
    indexesEnsured = true;
  } catch (error) {
    console.warn("Notification index sync skipped:", (error as Error)?.message || error);
  }
}

/**
 * Single entry point for persisting in-app notifications.
 * All controllers, services, and crons must use this — never insert into MongoDB directly.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput,
): Promise<CreateNotificationResult> {
  const { userId, message, route, meta = {}, socket } = input;
  const recipientId = Number(userId);
  if (!Number.isFinite(recipientId) || recipientId <= 0) {
    throw new Error("dispatchNotification: invalid userId");
  }

  await ensureNotificationIndexes();

  const dedupKey = buildNotificationDedupKey(recipientId, message, route, meta);
  const meta_information = { ...meta, dedupKey };

  return withNotificationDedupLock(dedupKey, async () => {
    const existing = await notificationRepository.findOne(
      { userId: recipientId, "meta_information.dedupKey": dedupKey },
      { lean: true, sort: { created_at: -1 } },
    );
    if (existing) return { notification: existing, created: false };

    try {
      const notification = await notificationRepository.create({
        userId: recipientId,
        message,
        route,
        meta_information,
      });

      if (socket) {
        SocketService.emitToUser(
          recipientId,
          SOCKET_EVENTS.USER_NOTIFICATION + `${recipientId}`,
          socket.payload,
        );
      }

      return { notification, created: true };
    } catch (error: any) {
      if (error?.code === 11000) {
        const dup = await notificationRepository.findOne(
          { userId: recipientId, "meta_information.dedupKey": dedupKey },
          { lean: true },
        );
        if (dup) return { notification: dup, created: false };
      }
      throw error;
    }
  });
}
