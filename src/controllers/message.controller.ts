import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE, BAD_REQUEST_CODE } from "@constants/serverCode";
import { chatRepository, messageRepository, userRepository } from "@repositories";
import { SocketService } from "@services/socket.service";
import { EVENT_TASK_TYPE, SOCKET_EVENTS } from "@constants/socket.constants";
import { UploadCategory } from "@constants/common.enum";
import { uploadFiles } from "@utils/fileUpload.helper";
import { UploadedFile } from "express-fileupload";

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

function previewText(content: string, attachments: any[] = []) {
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

function formatMessage(msg: any, sender?: any) {
  const raw = msg?.toObject?.() ?? msg;
  return {
    id: raw.id,
    chatId: raw.chatId,
    senderId: raw.senderId ?? sender?.id,
    senderName: sender?.name || raw.sender?.name || "Unknown",
    avatarUrl: sender?.profile_image || raw.sender?.profile_image || "",
    content: raw.content || "",
    messageType: raw.messageType || "text",
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    timestamp: raw.created_at || raw.createdAt,
    created_at: raw.created_at || raw.createdAt,
  };
}

class MessageController {
  async sendMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: userId } = req.user;
      const chatId = Number(req.body.chatId);
      const senderId = Number(req.body.senderId || userId);
      const content = String(req.body.content || "").trim();

      if (!chatId || !senderId) {
        return ReE(res, BAD_REQUEST_CODE, "Missing chatId or senderId");
      }

      const chat: any = await chatRepository.findById(chatId);
      if (!chat) return ReE(res, SERVER_ERROR_CODE, "Chat not found");
      const members: number[] = chat.members || [];
      if (!members.includes(userId)) {
        return ReE(res, SERVER_ERROR_CODE, "You are not a member of this chat");
      }

      let attachments: any[] = [];
      const filesMap = req.files as { [key: string]: UploadedFile | UploadedFile[] } | undefined;
      const filesRaw = filesMap?.files || filesMap?.file || filesMap?.attachments;
      if (filesRaw) {
        const uploaded = await uploadFiles({
          category: UploadCategory.CHAT,
          files: filesRaw,
          entityId: chatId,
          multiple: true,
          maxSizeMB: 50,
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

      const messageType = resolveMessageType(attachments, content);
      const message: any = await messageRepository.create({
        chatId,
        senderId,
        content,
        messageType,
        attachments,
      });

      const sender: any = await userRepository.findById(senderId, {
        select: "id name email profile_image",
        lean: true,
      });
      const payload = formatMessage(message, sender);
      const notifyText = previewText(content, attachments);

      await chatRepository.updateById(chatId, { $set: { updated_at: new Date() } }).catch(() => undefined);

      members.forEach((m: number) => {
        if (m === userId) return;
        SocketService.emit(`message_created_${chatId}_${m}`, {
          event: "created",
          data: payload,
        });
        SocketService.emit(SOCKET_EVENTS.USER_NOTIFICATION + `${m}`, {
          type: "Message Received",
          name: req.user.name,
          profile_image: req.user.profile_image,
          task_type: EVENT_TASK_TYPE.CREATED,
          message: notifyText || "New message",
        });
      });

      // Also notify room listeners (for same-user multi-tab)
      SocketService.emit(`chat_${chatId}`, {
        event: "created_message",
        data: { chatId, message: payload },
      });

      return ReS(res, SUCCESS_CODE, "Message sent successfully", payload);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error?.message || error}`);
    }
  }

  async getMessages(req: AuthenticatedRequest, res: Response) {
    try {
      const { chatId } = req.params;
      if (!chatId) return ReE(res, SERVER_ERROR_CODE, "Chat ID is required");

      const messages = await messageRepository.find(
        { chatId: Number(chatId) },
        {
          populate: { path: "sender", select: "id name email profile_image" },
          sort: { created_at: 1 },
          lean: true,
        },
      );

      const formattedMessages = messages.map((msg: any) => formatMessage(msg, msg.sender));
      return ReS(res, SUCCESS_CODE, "Messages retrieved successfully", formattedMessages);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getMessageById(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId }: any = req.params;
      const message = await messageRepository.findById(Number(messageId));
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");
      return ReS(res, SUCCESS_CODE, "Message retrieved successfully", message);
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
      if (Number(message.senderId) !== Number(req.user.id)) {
        return ReE(res, SERVER_ERROR_CODE, "You can only edit your own messages");
      }

      const updated = await messageRepository.updateById(Number(messageId), {
        $set: { content: String(content || "").trim() },
      });

      SocketService.emit(`chat_${message.chatId}`, {
        event: "updated_message",
        data: { message: updated, chatId: message.chatId },
      });

      return ReS(res, SUCCESS_CODE, "Message updated successfully", { message: updated });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async deleteMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId }: any = req.params;
      const message: any = await messageRepository.findById(Number(messageId));
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");
      if (Number(message.senderId) !== Number(req.user.id) && !["SUPER_ADMIN", "ADMIN"].includes(req.user.role)) {
        return ReE(res, SERVER_ERROR_CODE, "You can only delete your own messages");
      }

      const chatId = message.chatId;
      await messageRepository.deleteById(Number(messageId));
      SocketService.emit(`chat_${chatId}`, {
        event: "deleted_message",
        data: { messageId: Number(messageId), chatId },
      });
      return ReS(res, SUCCESS_CODE, "Message deleted successfully", { messageId, chatId });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new MessageController();
export { previewText };
