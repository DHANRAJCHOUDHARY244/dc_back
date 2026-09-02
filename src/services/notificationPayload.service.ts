import {
  EVENT_TASK_TYPE,
  USER_NOTIFICATION_EVENT_TYPE,
} from "@constants/socket.constants";

export type NotificationSocketPayloadInput = {
  type: USER_NOTIFICATION_EVENT_TYPE | string;
  message: string;
  task_type: EVENT_TASK_TYPE | string;
  name?: string;
  profile_image?: string | null;
  route?: string | null;
  chatId?: number;
  messageId?: number;
};

/** Standard socket payload for `USER_NOTIFICATION` events. */
export function buildNotificationSocketPayload(
  input: NotificationSocketPayloadInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: input.type,
    message: input.message,
    task_type: input.task_type,
  };
  if (input.name) payload.name = input.name;
  if (input.profile_image) payload.profile_image = input.profile_image;
  if (input.route) payload.route = input.route;
  if (input.chatId != null) payload.chatId = input.chatId;
  if (input.messageId != null) payload.messageId = input.messageId;
  return payload;
}

export function buildInvoiceNotificationSocketPayload(opts: {
  message: string;
  task_type: EVENT_TASK_TYPE | string;
  sender: { name?: string; profile_image?: string | null };
  route?: string | null;
}) {
  return buildNotificationSocketPayload({
    type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
    message: opts.message,
    task_type: opts.task_type,
    name: opts.sender.name,
    profile_image: opts.sender.profile_image,
    route: opts.route,
  });
}

export function buildQuoteNotificationSocketPayload(opts: {
  message: string;
  task_type: EVENT_TASK_TYPE | string;
  sender: { name?: string; profile_image?: string | null };
  route?: string | null;
}) {
  return buildNotificationSocketPayload({
    type: USER_NOTIFICATION_EVENT_TYPE.QUOTE,
    message: opts.message,
    task_type: opts.task_type,
    name: opts.sender.name,
    profile_image: opts.sender.profile_image,
    route: opts.route,
  });
}
