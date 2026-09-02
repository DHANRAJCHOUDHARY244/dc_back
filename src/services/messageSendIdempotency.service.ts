/** Short-lived cache so duplicate HTTP submits return the same message without re-notifying. */
const SEND_CACHE_TTL_MS = 2 * 60 * 1000;
const recentSends = new Map<string, { messageId: number; at: number }>();

function prune() {
  const now = Date.now();
  for (const [key, entry] of recentSends) {
    if (now - entry.at > SEND_CACHE_TTL_MS) recentSends.delete(key);
  }
}

export function rememberSentMessage(senderId: number, clientRequestId: string, messageId: number) {
  if (!clientRequestId || !messageId) return;
  prune();
  recentSends.set(`${senderId}:${clientRequestId}`, { messageId, at: Date.now() });
}

export function lookupSentMessage(senderId: number, clientRequestId: string): number | null {
  if (!clientRequestId) return null;
  prune();
  const hit = recentSends.get(`${senderId}:${clientRequestId}`);
  if (!hit) return null;
  if (Date.now() - hit.at > SEND_CACHE_TTL_MS) {
    recentSends.delete(`${senderId}:${clientRequestId}`);
    return null;
  }
  return hit.messageId;
}
