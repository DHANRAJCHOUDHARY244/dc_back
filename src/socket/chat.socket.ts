import {
  assertChatMember,
  chatRoom,
  isChatMember,
} from "@services/chat.service";
import { SocketService } from "@services/socket.service";
import { SOCKET_EVENTS } from "@constants/socket.constants";
import type { Socket } from "socket.io";

const TYPING_THROTTLE_MS = 1_500;

function getMemberChatIds(socket: Socket): Set<number> {
  const data = socket.data as { memberChatIds?: Set<number> };
  if (!data.memberChatIds) data.memberChatIds = new Set();
  return data.memberChatIds;
}

function getTypingThrottle(socket: Socket): Map<number, number> {
  const data = socket.data as { typingThrottle?: Map<number, number> };
  if (!data.typingThrottle) data.typingThrottle = new Map();
  return data.typingThrottle;
}

/** Attach CRM chat handlers to a single socket connection. */
export function attachChatSocketHandlers(socket: Socket) {
  const user = (socket as any).user;

  socket.on(SOCKET_EVENTS.CHAT_JOIN, async (payload: { chatId: number | string }) => {
    const chatId = Number(payload?.chatId);
    if (!chatId || !user?.id) return;
    const { error } = await assertChatMember(chatId, user.id);
    if (error) return socket.emit("chat:error", { message: error });
    socket.join(chatRoom(chatId));
    getMemberChatIds(socket).add(chatId);
  });

  socket.on(SOCKET_EVENTS.CHAT_LEAVE, (payload: { chatId: number | string }) => {
    const chatId = Number(payload?.chatId);
    if (!chatId) return;
    socket.leave(chatRoom(chatId));
    getMemberChatIds(socket).delete(chatId);
    getTypingThrottle(socket).delete(chatId);
  });

  socket.on(
    SOCKET_EVENTS.CHAT_TYPING,
    (payload: { chatId: number | string; isTyping?: boolean }) => {
      const chatId = Number(payload?.chatId);
      if (!chatId || !user?.id) return;

      const memberChatIds = getMemberChatIds(socket);
      if (!memberChatIds.has(chatId)) return;

      const isTyping = payload?.isTyping !== false;
      if (isTyping) {
        const throttle = getTypingThrottle(socket);
        const now = Date.now();
        const last = throttle.get(chatId) || 0;
        if (now - last < TYPING_THROTTLE_MS) return;
        throttle.set(chatId, now);
      }

      socket.to(chatRoom(chatId)).emit(SOCKET_EVENTS.CHAT_TYPING, {
        chatId,
        userId: user.id,
        name: user.name,
        isTyping,
      });
    },
  );

  socket.on(
    SOCKET_EVENTS.CHAT_READ,
    async (payload: { chatId: number | string; messageId: number }) => {
      const chatId = Number(payload?.chatId);
      const messageId = Number(payload?.messageId);
      if (!chatId || !messageId || !user?.id) return;
      const { error } = await assertChatMember(chatId, user.id);
      if (error) return;
      socket.to(chatRoom(chatId)).emit(`chat_${chatId}`, {
        event: "read_receipt",
        data: { chatId, userId: user.id, messageId },
      });
    },
  );

  /* Legacy — kept for backward compatibility */
  socket.on("send-message", async () => {
    socket.emit("message-error", {
      message: "Use REST API to send messages. Legacy socket send is deprecated.",
    });
  });
}

export const registerChatSocket = () => {
  /* no-op */
};
