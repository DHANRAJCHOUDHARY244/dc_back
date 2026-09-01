/** Prevent duplicate in-app notifications for the same user/event within a time window. */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export function buildNotificationDedupKey(
  userId: number,
  message: string,
  route: string | null | undefined,
  meta: Record<string, unknown> = {},
): string {
  if (meta.dedupKey) return String(meta.dedupKey);

  const type = String(meta.type || "").toUpperCase();
  const chatId = meta.chatId;
  const messageId = meta.messageId;
  if (type === "CHAT" && chatId != null && messageId != null) {
    return `chat:${chatId}:msg:${messageId}:user:${userId}`;
  }

  const leadId = meta.lead_id;
  const level = meta.level;
  if (leadId != null && level != null) {
    return `lead:${leadId}:L${level}:user:${userId}`;
  }

  const action = meta.action;
  if (type === "ATTENDANCE" && action) {
    const day = new Date().toISOString().slice(0, 10);
    return `attendance:${action}:user:${userId}:${day}`;
  }

  const quoteId = meta.quoteId ?? meta.quote_id;
  if (quoteId != null && type) {
    return `${type.toLowerCase()}:${quoteId}:user:${userId}:${message.slice(0, 80)}`;
  }

  const invoiceId = meta.invoiceId ?? meta.invoice_id;
  if (invoiceId != null && type) {
    return `${type.toLowerCase()}:${invoiceId}:user:${userId}:${message.slice(0, 80)}`;
  }

  return `user:${userId}:${type || "generic"}:${route || ""}:${message}`;
}

export function notificationDedupCutoffDate(): Date {
  return new Date(Date.now() - DEDUP_WINDOW_MS);
}
