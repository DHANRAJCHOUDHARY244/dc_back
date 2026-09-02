import { EVENT_TASK_TYPE, USER_NOTIFICATION_EVENT_TYPE } from "@constants/socket.constants";
import { chatRoom } from "@services/chat.service";
import { dispatchNotification } from "@services/notificationHandler.service";
import { SocketService } from "@services/socket.service";
import { notificationRepository } from "@repositories";

const NOTIFICATION_RETENTION_DAYS = 5;

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

/** True when the user has an active socket joined to this chat room. */
export async function isUserViewingChat(userId: number, chatId: number): Promise<boolean> {
  try {
    const io = SocketService.getIO();
    const sockets = await io.in(chatRoom(chatId)).fetchSockets();
    return sockets.some((s) => Number((s as any).user?.id) === Number(userId));
  } catch {
    return false;
  }
}

/** Persist + push one in-app chat notification (deduped; skipped if user is in the chat). */
export async function dispatchChatInAppNotification(opts: {
  userId: number;
  chatId: number;
  messageId: number;
  senderId: number;
  message: string;
  route: string;
  senderName: string;
  senderProfileImage?: string | null;
  taskType: EVENT_TASK_TYPE;
  mention?: boolean;
  reply?: boolean;
}) {
  const recipientId = Number(opts.userId);
  const senderId = Number(opts.senderId);
  if (!Number.isFinite(recipientId) || recipientId <= 0) return null;
  if (recipientId === senderId) return null;

  if (await isUserViewingChat(recipientId, opts.chatId)) {
    return null;
  }

  const messageId = Number(opts.messageId);
  const meta: Record<string, unknown> = {
    type: USER_NOTIFICATION_EVENT_TYPE.CHAT,
    senderId,
    senderName: opts.senderName,
    chatId: opts.chatId,
    link: opts.route,
    mention: opts.mention,
    reply: opts.reply,
  };
  if (Number.isFinite(messageId) && messageId > 0) {
    meta.messageId = messageId;
  }

  const { notification } = await dispatchNotification({
    userId: recipientId,
    message: opts.message,
    route: opts.route,
    meta,
    socket: {
      payload: {
        type: USER_NOTIFICATION_EVENT_TYPE.CHAT,
        name: opts.senderName,
        profile_image: opts.senderProfileImage,
        task_type: opts.taskType,
        message: opts.message,
        chatId: opts.chatId,
        messageId: Number.isFinite(messageId) && messageId > 0 ? messageId : undefined,
        route: opts.route,
      },
    },
  });

  return notification;
}

/** Remove persisted in-app chat alerts for a user (optionally scoped to one chat). */
export async function purgeChatNotificationsForUser(userId: number, chatId?: number) {
  const filter: Record<string, unknown> = {
    userId: Number(userId),
    "meta_information.type": USER_NOTIFICATION_EVENT_TYPE.CHAT,
  };
  if (chatId != null && Number.isFinite(Number(chatId))) {
    filter["meta_information.chatId"] = Number(chatId);
  }
  const result: any = await notificationRepository.deleteMany(filter);
  return result?.deletedCount ?? 0;
}
