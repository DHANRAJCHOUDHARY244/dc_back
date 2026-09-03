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
      {
        userId: recipientId,
        $or: [{ dedupKey }, { "meta_information.dedupKey": dedupKey }],
      },
      { lean: true, sort: { created_at: -1 } },
    );
    if (existing) return { notification: existing, created: false };

    try {
      const notification = await notificationRepository.create({
        userId: recipientId,
        message,
        route,
        meta_information,
        dedupKey,
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
          {
            userId: recipientId,
            $or: [{ dedupKey }, { "meta_information.dedupKey": dedupKey }],
          },
          { lean: true },
        );
        if (dup) return { notification: dup, created: false };
      }
      throw error;
    }
  });
}

/**
 * Collapse duplicate LEAD_FOLLOWUP rows (same user + lead + level), keep newest.
 * Safe to run from cron — returns how many documents were deleted.
 */
export async function collapseDuplicateLeadFollowupNotifications(): Promise<number> {
  const rows: any[] = await notificationRepository.find(
    { "meta_information.type": "LEAD_FOLLOWUP" },
    { lean: true, sort: { created_at: -1 }, limit: 5000 },
  );

  const seen = new Set<string>();
  const deleteIds: number[] = [];

  for (const row of rows) {
    const meta = row.meta_information || {};
    const leadId = meta.lead_id ?? meta.leadId;
    const level = meta.level;
    const audience = meta.audience || "user";
    // Normalize hour text so "100h" / "101h" variants collapse together
    const key =
      row.dedupKey ||
      (leadId != null && level != null
        ? `lead_followup:${leadId}:L${level}:${audience}:user:${row.userId}`
        : `legacy:${row.userId}:${String(row.message || "").replace(/\d+h/g, "Xh").slice(0, 100)}`);

    if (seen.has(key)) {
      if (row.id != null) deleteIds.push(Number(row.id));
      continue;
    }
    seen.add(key);
  }

  if (!deleteIds.length) return 0;
  const result: any = await notificationRepository.deleteMany({ id: { $in: deleteIds } });
  return result?.deletedCount ?? deleteIds.length;
}
