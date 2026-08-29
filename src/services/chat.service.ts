import { chatRepository, messageRepository, userRepository } from "@repositories";
import { SocketService } from "@services/socket.service";
import { listOnlineUsers } from "@services/presence.service";

export function getUserMemberMeta(chat: any, userId: number) {
  const meta = (chat?.memberMeta || []).find((m: any) => Number(m.userId) === Number(userId));
  return meta || { userId, muted: false, pinned: false, archived: false };
}

export function isUserMuted(chat: any, userId: number) {
  return !!getUserMemberMeta(chat, userId).muted;
}

export async function updateUserMemberMeta(
  chatId: number,
  userId: number,
  patch: Record<string, unknown>,
) {
  const chat: any = await chatRepository.findById(chatId, { lean: true });
  if (!chat) return null;
  const memberMeta = buildMemberMeta(chat.members || [], chat.memberMeta || []).map((m: any) =>
    Number(m.userId) === Number(userId) ? { ...m, ...patch } : m,
  );
  return chatRepository.updateById(chatId, { $set: { memberMeta } });
}

export function isSystemAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function isChatMember(chat: any, userId: number) {
  return (chat?.members || []).includes(Number(userId));
}

export function isChatAdmin(chat: any, user: { id: number; role?: string }) {
  if (isSystemAdmin(user.role)) return true;
  if (chat?.type !== "group") return false;
  if (Number(chat?.createdBy) === Number(user.id)) return true;
  return (chat?.admins || []).includes(Number(user.id));
}

export function chatRoom(chatId: number | string) {
  return `chat-${chatId}`;
}

export function emitChatEvent(chatId: number, event: string, data: unknown) {
  SocketService.emitToRoom?.(chatRoom(chatId), `chat_${chatId}`, { event, data });
}

export async function createSystemMessage(
  chatId: number,
  systemType: string,
  systemMeta: Record<string, unknown>,
  senderId = 0,
) {
  const message = await messageRepository.create({
    chatId,
    senderId,
    content: "",
    messageType: "text",
    systemType,
    systemMeta,
    attachments: [],
  });
  const payload = formatMessagePayload(message, null);
  emitChatEvent(chatId, "created_message", { chatId, message: payload });
  return message;
}

export function formatMessagePayload(msg: any, sender?: any, replyTo?: any) {
  const raw = msg?.toObject?.() ?? msg;
  const replyPreview = replyTo
    ? {
        id: replyTo.id,
        senderName: replyTo.sender?.name || "Unknown",
        content: String(replyTo.content || "").slice(0, 200),
      }
    : undefined;
  return {
    id: raw.id,
    chatId: raw.chatId,
    senderId: raw.senderId ?? sender?.id ?? 0,
    senderName: sender?.name || raw.sender?.name || (raw.systemType ? "System" : "Unknown"),
    avatarUrl: sender?.profile_image || raw.sender?.profile_image || "",
    content: raw.content || "",
    messageType: raw.messageType || "text",
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    replyToId: raw.replyToId || null,
    replyTo: replyPreview,
    mentions: Array.isArray(raw.mentions) ? raw.mentions : [],
    reactions: Array.isArray(raw.reactions) ? raw.reactions : [],
    readBy: Array.isArray(raw.readBy) ? raw.readBy : [],
    systemType: raw.systemType || null,
    systemMeta: raw.systemMeta || null,
    editedAt: raw.editedAt || null,
    isPinned: !!raw.isPinned,
    pinnedAt: raw.pinnedAt || null,
    pinnedBy: raw.pinnedBy || null,
    starredBy: Array.isArray(raw.starredBy) ? raw.starredBy : [],
    forwardedFrom: raw.forwardedFrom || null,
    linkPreviews: Array.isArray(raw.linkPreviews) ? raw.linkPreviews : [],
    timestamp: raw.created_at || raw.createdAt,
    created_at: raw.created_at || raw.createdAt,
  };
}

export async function loadReplyPreviews(messages: any[]) {
  const replyIds = [...new Set(messages.map((m) => m.replyToId).filter(Boolean))] as number[];
  if (!replyIds.length) return new Map<number, any>();
  const parents = await messageRepository.find(
    { id: { $in: replyIds } },
    { populate: { path: "sender", select: "id name profile_image" }, lean: true },
  );
  return new Map((parents as any[]).map((p) => [p.id, p]));
}

export async function getChatMembersWithPresence(chat: any) {
  const memberIds = chat?.members || [];
  if (!memberIds.length) return [];
  const users = await userRepository.find(
    { id: { $in: memberIds } },
    { select: "id name email profile_image role", lean: true },
  );
  const onlineIds = new Set((await listOnlineUsers()).map((u) => Number(u.id)));
  return (users as any[]).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    profile_image: u.profile_image,
    role: u.role,
    isOnline: onlineIds.has(Number(u.id)),
    isAdmin:
      Number(chat.createdBy) === Number(u.id) || (chat.admins || []).includes(Number(u.id)),
  }));
}

export function buildMemberMeta(members: number[], existing: any[] = []) {
  const byId = new Map((existing || []).map((m: any) => [m.userId, m]));
  const now = new Date();
  return members.map((userId) => {
    const prev = byId.get(userId);
    return prev || { userId, joinedAt: now, muted: false, pinned: false, archived: false };
  });
}

export async function assertChatMember(chatId: number, userId: number) {
  const chat: any = await chatRepository.findById(chatId, { lean: true });
  if (!chat) return { error: "Chat not found", chat: null };
  if (!isChatMember(chat, userId)) return { error: "You are not a member of this chat", chat: null };
  return { error: null, chat };
}
