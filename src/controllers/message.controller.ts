import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE, BAD_REQUEST_CODE } from "@constants/serverCode";
import { chatRepository, messageRepository, userRepository } from "@repositories";
import { SocketService } from "@services/socket.service";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";
import { UploadCategory } from "@constants/common.enum";
import { uploadFiles } from "@utils/fileUpload.helper";
import { UploadedFile } from "express-fileupload";
import {
  assertChatMember,
  emitChatEvent,
  formatMessagePayload,
  isChatAdmin,
  isUserMuted,
  loadReplyPreviews,
} from "@services/chat.service";
import { chatNotificationRoute, dispatchChatInAppNotification } from "@services/notificationLifecycle.service";
import { buildLinkPreviews } from "@services/linkPreview.service";
import {
  lookupSentMessage,
  rememberSentMessage,
} from "@services/messageSendIdempotency.service";

function detectKind(mime: string): "image" | "video" | "audio" | "document" {
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}

function resolveMessageType(attachments: any[], content: string) {
  if (!attachments.length) return "text";
  const kinds = new Set(attachments.map((a) => a.kind));
  if (kinds.size > 1) return "mixed";
  const only = [...kinds][0];
  if (only === "image" || only === "video" || only === "audio" || only === "document") return only;
  return content?.trim() ? "mixed" : "document";
}

export function previewText(content: string, attachments: any[] = []) {
  const text = String(content || "").trim();
  if (text) return text;
  if (!attachments.length) return "";
  const kinds = attachments.map((a) => a.kind);
  if (kinds.every((k) => k === "image")) return kinds.length > 1 ? `📷 ${kinds.length} photos` : "📷 Photo";
  if (kinds.every((k) => k === "video")) return kinds.length > 1 ? `🎬 ${kinds.length} videos` : "🎬 Video";
  if (kinds.every((k) => k === "audio")) return "🎵 Audio";
  if (kinds.length === 1) return `📎 ${attachments[0].original_name || "Document"}`;
  return `📎 ${attachments.length} files`;
}

function parseMentions(raw: unknown): { userId: number; name: string }[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return parseMentions(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => ({
      userId: Number(m?.userId),
      name: String(m?.name || "").slice(0, 100),
    }))
    .filter((m) => m.userId && m.name);
}

function stripHtml(text: string) {
  return String(text || "").replace(/<[^>]*>/g, "");
}

function uniqueMemberIds(members: number[] = []): number[] {
  return [...new Set(members.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
}

async function notifyChatMembers(opts: {
  chat: any;
  chatId: number;
  senderId: number;
  senderName: string;
  senderProfileImage?: string | null;
  payload: ReturnType<typeof formatMessagePayload>;
  notifyText: string;
  validMentions: { userId: number; name: string }[];
  replyTo: any;
}) {
  const members = uniqueMemberIds(opts.chat?.members || []);
  const messageId = Number(opts.payload.id);

  for (const m of members) {
    const memberId = Number(m);
    const senderId = Number(opts.senderId);
    if (!Number.isFinite(memberId) || memberId <= 0) continue;

    SocketService.emitToUser(memberId, `message_created_${opts.chatId}_${memberId}`, {
      event: "created",
      data: opts.payload,
    });

    if (memberId === senderId) continue;

    const isMentioned = opts.validMentions.some((mn) => mn.userId === m);
    const isReplyTarget = opts.replyTo && Number(opts.replyTo.senderId) === m;
    const muted = isUserMuted(opts.chat, m);
    if (muted && !isMentioned) continue;

    const route = chatNotificationRoute(opts.chatId);
    const notifyMessage = isMentioned
      ? `${opts.senderName} mentioned you: ${opts.notifyText || "in a message"}`
      : isReplyTarget
        ? `${opts.senderName} replied to your message`
        : `${opts.senderName}: ${opts.notifyText || "New message"}`;

    await dispatchChatInAppNotification({
      userId: memberId,
      chatId: opts.chatId,
      messageId,
      senderId,
      message: notifyMessage,
      route,
      senderName: opts.senderName,
      senderProfileImage: opts.senderProfileImage,
      taskType: isMentioned
        ? EVENT_TASK_TYPE.MENTION
        : isReplyTarget
          ? EVENT_TASK_TYPE.REPLY
          : EVENT_TASK_TYPE.CREATED,
      mention: isMentioned,
      reply: !!isReplyTarget,
    }).catch(() => undefined);
  }
}

class MessageController {
  async sendMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: userId } = req.user;
      const chatId = Number(req.body.chatId);
      const senderId = userId;
      const content = stripHtml(String(req.body.content || "").trim());
      const replyToId = req.body.replyToId ? Number(req.body.replyToId) : null;
      const mentions = parseMentions(req.body.mentions);
      const clientRequestId = String(req.body.clientRequestId || "").trim().slice(0, 64);

      if (!chatId || !senderId) {
        return ReE(res, BAD_REQUEST_CODE, "Missing chatId or senderId");
      }

      if (clientRequestId) {
        const cachedId = lookupSentMessage(senderId, clientRequestId);
        if (cachedId) {
          const existing: any = await messageRepository.findById(cachedId, {
            populate: { path: "sender", select: "id name email profile_image" },
            lean: true,
          });
          if (existing && Number(existing.chatId) === chatId) {
            let replyTo: any = null;
            if (existing.replyToId) {
              replyTo = await messageRepository.findById(existing.replyToId, {
                populate: { path: "sender", select: "id name profile_image" },
                lean: true,
              });
            }
            return ReS(
              res,
              SUCCESS_CODE,
              "Message sent successfully",
              formatMessagePayload(existing, existing.sender, replyTo),
            );
          }
        }
      }

      const { error, chat } = await assertChatMember(chatId, userId);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      const members: number[] = uniqueMemberIds(chat!.members || []);

      if (replyToId) {
        const parent: any = await messageRepository.findById(replyToId, { lean: true });
        if (!parent || Number(parent.chatId) !== chatId) {
          return ReE(res, BAD_REQUEST_CODE, "Invalid reply target");
        }
      }

      const validMentions = mentions.filter((m) => members.includes(m.userId));

      let attachments: any[] = [];
      const filesMap = req.files as { [key: string]: UploadedFile | UploadedFile[] } | undefined;
      const filesRaw = filesMap?.files || filesMap?.file || filesMap?.attachments;
      if (filesRaw) {
        const uploaded = await uploadFiles({
          category: UploadCategory.CHAT,
          files: filesRaw,
          entityId: chatId,
          multiple: true,
          maxSizeMB: 40,
          allowedTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/jpg",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/ogg",
            "audio/webm",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "application/zip",
          ],
        });
        const list = Array.isArray(uploaded) ? uploaded : [uploaded];
        attachments = list.map((f: any) => ({
          url: f.url,
          mime_type: f.mime_type,
          original_name: f.original_name,
          size_bytes: f.size_bytes,
          kind: detectKind(f.mime_type),
        }));
      }

      if (!content && !attachments.length) {
        return ReE(res, BAD_REQUEST_CODE, "Message content or attachment required");
      }

      const recentDuplicate: any = await messageRepository.findOne(
        {
          chatId,
          senderId,
          content,
          created_at: { $gte: new Date(Date.now() - 4000) },
        },
        { sort: { id: -1 }, lean: true },
      );
      if (recentDuplicate && attachments.length === 0) {
        const sender: any = await userRepository.findById(senderId, {
          select: "id name email profile_image",
          lean: true,
        });
        let replyTo: any = null;
        if (recentDuplicate.replyToId) {
          replyTo = await messageRepository.findById(recentDuplicate.replyToId, {
            populate: { path: "sender", select: "id name profile_image" },
            lean: true,
          });
        }
        const payload = formatMessagePayload(recentDuplicate, sender, replyTo);
        if (clientRequestId) rememberSentMessage(senderId, clientRequestId, Number(recentDuplicate.id));
        return ReS(res, SUCCESS_CODE, "Message sent successfully", payload);
      }

      const messageType = resolveMessageType(attachments, content);
      const message: any = await messageRepository.create({
        chatId,
        senderId,
        content,
        messageType,
        attachments,
        replyToId: replyToId || null,
        mentions: validMentions,
        reactions: [],
        readBy: [userId],
        linkPreviews: [],
      });

      const sender: any = await userRepository.findById(senderId, {
        select: "id name email profile_image",
        lean: true,
      });

      let replyTo: any = null;
      if (replyToId) {
        replyTo = await messageRepository.findById(replyToId, {
          populate: { path: "sender", select: "id name profile_image" },
          lean: true,
        });
      }

      const payload = formatMessagePayload(message, sender, replyTo);
      const notifyText = previewText(content, attachments);

      await chatRepository.updateById(chatId, { $set: { updated_at: new Date() } }).catch(() => undefined);

      if (clientRequestId && payload.id) {
        rememberSentMessage(senderId, clientRequestId, Number(payload.id));
      }

      await notifyChatMembers({
        chat: chat!,
        chatId,
        senderId,
        senderName: req.user.name,
        senderProfileImage: req.user.profile_image,
        payload,
        notifyText,
        validMentions,
        replyTo,
      });

      emitChatEvent(chatId, "created_message", { chatId, message: payload });

      if (content) {
        void buildLinkPreviews(content)
          .then(async (linkPreviews) => {
            if (!linkPreviews.length) return;
            await messageRepository.updateById(message.id, { $set: { linkPreviews } });
            const enriched = formatMessagePayload(
              { ...message.toObject?.() ?? message, linkPreviews },
              sender,
              replyTo,
            );
            emitChatEvent(chatId, "updated_message", { chatId, message: enriched });
          })
          .catch(() => undefined);
      }

      return ReS(res, SUCCESS_CODE, "Message sent successfully", payload);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error?.message || error}`);
    }
  }

  async getMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
      const limit = Math.min(Number(req.query.limit) || 50, 100);

      if (!chatId) return ReE(res, SERVER_ERROR_CODE, "Chat ID is required");
      const { error } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const filter: any = { chatId };
      if (beforeId) filter.id = { $lt: beforeId };

      const messages = await messageRepository.find(filter, {
        populate: { path: "sender", select: "id name email profile_image" },
        sort: { id: -1 },
        limit,
        lean: true,
      });

      const replyMap = await loadReplyPreviews(messages as any[]);
      const formattedMessages = (messages as any[])
        .reverse()
        .map((msg) => formatMessagePayload(msg, msg.sender, replyMap.get(msg.replyToId)));

      return ReS(res, SUCCESS_CODE, "Messages retrieved successfully", {
        messages: formattedMessages,
        hasMore: formattedMessages.length === limit,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async searchMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const q = String(req.query.q || "").trim();
      if (!chatId || !q) return ReE(res, BAD_REQUEST_CODE, "chatId and q required");

      const { error } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const messages = await messageRepository.find(
        { chatId, content: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        {
          populate: { path: "sender", select: "id name profile_image" },
          sort: { created_at: -1 },
          limit: 30,
          lean: true,
        },
      );

      const results = (messages as any[]).map((msg) => formatMessagePayload(msg, msg.sender));
      return ReS(res, SUCCESS_CODE, "Search results", results);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async addReaction(req: AuthenticatedRequest, res: Response) {
    try {
      const messageId = Number(req.params.messageId);
      const emoji = String(req.body.emoji || "").slice(0, 8);
      const userId = req.user.id;
      if (!messageId || !emoji) return ReE(res, BAD_REQUEST_CODE, "messageId and emoji required");

      const message: any = await messageRepository.findById(messageId, { lean: true });
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error } = await assertChatMember(message.chatId, userId);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const reactions: any[] = message.reactions || [];
      const existingIdx = reactions.findIndex(
        (r) => Number(r.userId) === userId && r.emoji === emoji,
      );
      let updatedReactions;
      if (existingIdx >= 0) {
        updatedReactions = reactions.filter((_, i) => i !== existingIdx);
      } else {
        updatedReactions = [...reactions, { emoji, userId }];
      }

      const updated = await messageRepository.updateById(messageId, {
        $set: { reactions: updatedReactions },
      });

      emitChatEvent(message.chatId, "reaction_updated", {
        messageId,
        chatId: message.chatId,
        reactions: updatedReactions,
      });

      return ReS(res, SUCCESS_CODE, "Reaction updated", { messageId, reactions: updatedReactions });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getMessageById(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId }: any = req.params;
      const message: any = await messageRepository.findById(Number(messageId), {
        populate: { path: "sender", select: "id name email profile_image" },
        lean: true,
      });
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error } = await assertChatMember(message.chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      let replyTo = null;
      if (message.replyToId) {
        replyTo = await messageRepository.findById(message.replyToId, {
          populate: { path: "sender", select: "id name profile_image" },
          lean: true,
        });
      }

      return ReS(
        res,
        SUCCESS_CODE,
        "Message retrieved successfully",
        formatMessagePayload(message, message.sender, replyTo),
      );
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async updateMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId }: any = req.params;
      const { content } = req.body;
      const message: any = await messageRepository.findById(Number(messageId));
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error } = await assertChatMember(message.chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      if (Number(message.senderId) !== Number(req.user.id)) {
        return ReE(res, SERVER_ERROR_CODE, "You can only edit your own messages");
      }

      const updated = await messageRepository.updateById(Number(messageId), {
        $set: { content: stripHtml(String(content || "").trim()), editedAt: new Date() },
      });

      const sender: any = await userRepository.findById(Number(updated?.senderId || req.user.id), {
        select: "id name profile_image",
        lean: true,
      });
      const formatted = formatMessagePayload(updated, sender);

      emitChatEvent(message.chatId, "updated_message", { message: formatted, chatId: message.chatId });

      return ReS(res, SUCCESS_CODE, "Message updated successfully", { message: formatted });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async deleteMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId }: any = req.params;
      const message: any = await messageRepository.findById(Number(messageId));
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error } = await assertChatMember(message.chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      if (
        Number(message.senderId) !== Number(req.user.id) &&
        !["SUPER_ADMIN", "ADMIN"].includes(req.user.role)
      ) {
        return ReE(res, SERVER_ERROR_CODE, "You can only delete your own messages");
      }

      const chatId = message.chatId;
      await messageRepository.deleteById(Number(messageId));
      emitChatEvent(chatId, "deleted_message", { messageId: Number(messageId), chatId });
      return ReS(res, SUCCESS_CODE, "Message deleted successfully", { messageId, chatId });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async pinMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const messageId = Number(req.params.messageId);
      const message: any = await messageRepository.findById(messageId, { lean: true });
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error, chat } = await assertChatMember(message.chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type === "group" && !isChatAdmin(chat, req.user)) {
        return ReE(res, SERVER_ERROR_CODE, "Admin access required");
      }

      const isPinned = !message.isPinned;
      await messageRepository.updateById(messageId, {
        $set: {
          isPinned,
          pinnedAt: isPinned ? new Date() : null,
          pinnedBy: isPinned ? req.user.id : null,
        },
      });

      emitChatEvent(message.chatId, "message_pinned", { chatId: message.chatId, messageId, isPinned });
      return ReS(res, SUCCESS_CODE, isPinned ? "Message pinned" : "Message unpinned", { messageId, isPinned });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async toggleStar(req: AuthenticatedRequest, res: Response) {
    try {
      const messageId = Number(req.params.messageId);
      const userId = req.user.id;
      const message: any = await messageRepository.findById(messageId, { lean: true });
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error } = await assertChatMember(message.chatId, userId);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const starredBy: number[] = message.starredBy || [];
      const isStarred = starredBy.includes(userId);
      const updated = isStarred
        ? starredBy.filter((id) => id !== userId)
        : [...starredBy, userId];

      await messageRepository.updateById(messageId, { $set: { starredBy: updated } });
      return ReS(res, SUCCESS_CODE, isStarred ? "Unstarred" : "Starred", {
        messageId,
        starred: !isStarred,
        starredBy: updated,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async forwardMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const messageId = Number(req.params.messageId);
      const targetChatIds: number[] = (req.body.targetChatIds || []).map(Number).filter(Boolean);
      if (!targetChatIds.length) return ReE(res, BAD_REQUEST_CODE, "targetChatIds required");

      const source: any = await messageRepository.findById(messageId, {
        populate: { path: "sender", select: "id name profile_image" },
        lean: true,
      });
      if (!source) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error } = await assertChatMember(source.chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const sender: any = await userRepository.findById(req.user.id, {
        select: "id name profile_image",
        lean: true,
      });

      const forwarded: any[] = [];
      for (const targetChatId of targetChatIds) {
        const memberCheck = await assertChatMember(targetChatId, req.user.id);
        if (memberCheck.error) continue;
        const targetChat = memberCheck.chat!;

        const created: any = await messageRepository.create({
          chatId: targetChatId,
          senderId: req.user.id,
          content: source.content || "",
          messageType: source.messageType || "text",
          attachments: source.attachments || [],
          forwardedFrom: {
            chatId: source.chatId,
            messageId: source.id,
            senderName: source.sender?.name || "Unknown",
            content: String(source.content || "").slice(0, 200),
          },
          reactions: [],
          readBy: [req.user.id],
          linkPreviews: source.linkPreviews || [],
        });

        const payload = formatMessagePayload(created, sender);
        const notifyText = previewText(source.content || "", source.attachments || []);

        await chatRepository.updateById(targetChatId, { $set: { updated_at: new Date() } }).catch(() => undefined);

        const members: number[] = uniqueMemberIds(targetChat.members || []);
        for (const m of members) {
          const memberId = Number(m);
          const senderId = Number(req.user.id);
          if (!Number.isFinite(memberId) || memberId <= 0) continue;
          if (memberId === senderId) continue;

          SocketService.emitToUser(memberId, `message_created_${targetChatId}_${memberId}`, {
            event: "created",
            data: payload,
          });

          const muted = isUserMuted(targetChat, memberId);
          if (muted) continue;

          const route = chatNotificationRoute(targetChatId);
          const notifyMessage = `${req.user.name} forwarded a message: ${notifyText || "New message"}`;

          await dispatchChatInAppNotification({
            userId: memberId,
            chatId: targetChatId,
            messageId: Number(payload.id),
            senderId,
            message: notifyMessage,
            route,
            senderName: req.user.name,
            senderProfileImage: req.user.profile_image,
            taskType: EVENT_TASK_TYPE.CREATED,
          }).catch(() => undefined);
        }

        emitChatEvent(targetChatId, "created_message", { chatId: targetChatId, message: payload });
        forwarded.push(payload);
      }

      return ReS(res, SUCCESS_CODE, "Message forwarded", { forwarded });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getPinnedMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { error } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const messages = await messageRepository.find(
        { chatId, isPinned: true },
        { populate: { path: "sender", select: "id name profile_image" }, sort: { pinnedAt: -1 }, lean: true },
      );

      const results = (messages as any[]).map((msg) => formatMessagePayload(msg, msg.sender));
      return ReS(res, SUCCESS_CODE, "Pinned messages", results);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getStarredMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const chats: any[] = await chatRepository.find({ members: userId }, { select: "id", lean: true });
      const chatIds = chats.map((c) => c.id);

      const messages = await messageRepository.find(
        { chatId: { $in: chatIds }, starredBy: userId },
        { populate: { path: "sender", select: "id name profile_image" }, sort: { created_at: -1 }, limit: 50, lean: true },
      );

      const results = (messages as any[]).map((msg) => formatMessagePayload(msg, msg.sender));
      return ReS(res, SUCCESS_CODE, "Starred messages", results);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async globalSearch(req: AuthenticatedRequest, res: Response) {
    try {
      const q = String(req.query.q || "").trim();
      if (!q || q.length < 2) return ReE(res, BAD_REQUEST_CODE, "Query must be at least 2 characters");

      const userId = req.user.id;
      const chats: any[] = await chatRepository.find({ members: userId }, { select: "id name type", lean: true });
      const chatIds = chats.map((c) => c.id);
      const chatNameById = new Map(chats.map((c) => [c.id, c.name || "Chat"]));

      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const messages = await messageRepository.find(
        { chatId: { $in: chatIds }, content: { $regex: escaped, $options: "i" }, systemType: null },
        { populate: { path: "sender", select: "id name profile_image" }, sort: { created_at: -1 }, limit: 40, lean: true },
      );

      const results = (messages as any[]).map((msg) => ({
        ...formatMessagePayload(msg, msg.sender),
        chatName: chatNameById.get(msg.chatId) || "Chat",
      }));

      return ReS(res, SUCCESS_CODE, "Global search results", results);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getMessageReaders(req: AuthenticatedRequest, res: Response) {
    try {
      const messageId = Number(req.params.messageId);
      const message: any = await messageRepository.findById(messageId, { lean: true });
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const { error } = await assertChatMember(message.chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const readerIds = (message.readBy || []).filter((id: number) => id !== message.senderId);
      const readers = readerIds.length
        ? await userRepository.find({ id: { $in: readerIds } }, { select: "id name profile_image", lean: true })
        : [];

      return ReS(res, SUCCESS_CODE, "Message readers", {
        messageId,
        readBy: readers,
        readCount: readerIds.length,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new MessageController();
