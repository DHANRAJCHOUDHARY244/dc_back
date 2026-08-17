import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE } from "@constants/serverCode";
import { chatRepository, messageRepository, userRepository } from "@repositories";
import { SocketService } from "@services/socket.service";

function formatChatTime(dateString?: string | Date): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function lastMessagePreview(lastMessage: any): string {
  const attachments = Array.isArray(lastMessage?.attachments) ? lastMessage.attachments : [];
  const text = String(lastMessage?.content || "").trim();
  if (text) return text;
  if (attachments.length) {
    const kinds = attachments.map((a: any) => a.kind);
    if (kinds.every((k: string) => k === "image")) return kinds.length > 1 ? `📷 ${kinds.length} photos` : "📷 Photo";
    if (kinds.every((k: string) => k === "video")) return "🎬 Video";
    if (kinds.every((k: string) => k === "audio")) return "🎵 Audio";
    return `📎 ${attachments[0]?.original_name || "Attachment"}`;
  }
  return "No messages yet";
}

class ChatController {
  async createChat(req: AuthenticatedRequest, res: Response) {
    try {
      const { type, name, members = [] } = req.body;
      const user_id = req.user.id;

      const uniqueSortedMembers = [...new Set([...members, user_id])].sort((a, b) => a - b);
      if (!type || uniqueSortedMembers.length < 2) {
        return ReE(res, SERVER_ERROR_CODE, "Invalid chat data");
      }

      let chat: any;
      if (type === "direct") {
        const existingChat: any = await chatRepository.findOne(
          {
            type: "direct",
            members: { $all: uniqueSortedMembers, $size: uniqueSortedMembers.length },
          },
          { lean: true },
        );

        if (existingChat) {
          return ReS(res, SUCCESS_CODE, "Direct chat already exists", existingChat);
        }

        chat = await chatRepository.create({ type, name: null, members: uniqueSortedMembers });
      } else {
        chat = await chatRepository.create({
          type,
          name: name || "Unnamed Group",
          members: uniqueSortedMembers,
        });
      }

      if (type === "direct") {
        const otherUserId = uniqueSortedMembers.find((id) => id !== user_id);
        const user: any = await userRepository.findById(otherUserId!, {
          select: "name profile_image",
          lean: true,
        });
        chat.name = user?.name || "Unknown";
        chat.avatar = user?.profile_image || null;
      } else {
        chat.avatar = null;
      }

      uniqueSortedMembers.forEach((id) => {
        if (id !== user_id) {
          SocketService.emit(`chat_created_${id}`, { event: "chat_created", data: chat });
        }
      });

      return ReS(res, SUCCESS_CODE, "Chat created successfully", chat);
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getChats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return ReE(res, SERVER_ERROR_CODE, "User ID missing");

      const chats: any[] = await chatRepository.find(
        { members: userId },
        { sort: { updated_at: -1, created_at: -1 }, lean: true },
      );

      if (!chats.length) {
        return ReS(res, SUCCESS_CODE, "Chats loaded", []);
      }

      const otherUserIds = [
        ...new Set(
          chats
            .filter((chat) => chat.type !== "group")
            .map((chat) => (chat.members || []).find((id: number) => id !== userId))
            .filter((id: number | undefined) => id != null),
        ),
      ];
      const chatIds = chats.map((chat) => chat.id).filter((id: number | undefined) => id != null);

      const [users, lastMessages] = await Promise.all([
        otherUserIds.length
          ? userRepository.find(
              { id: { $in: otherUserIds } },
              { select: "id name profile_image", lean: true },
            )
          : Promise.resolve([]),
        chatIds.length
          ? messageRepository.aggregate([
              { $match: { chatId: { $in: chatIds } } },
              { $sort: { created_at: -1 } },
              {
                $group: {
                  _id: "$chatId",
                  id: { $first: "$id" },
                  content: { $first: "$content" },
                  created_at: { $first: "$created_at" },
                  messageType: { $first: "$messageType" },
                  attachments: { $first: "$attachments" },
                },
              },
            ])
          : Promise.resolve([]),
      ]);

      const userById = new Map((users as any[]).map((u) => [u.id, u]));
      const lastByChatId = new Map((lastMessages as any[]).map((m) => [m._id, m]));

      const result = chats
        .filter((chat) => chat.id != null)
        .map((chat) => {
          const memberIds = chat.members || [];
          const isGroup = chat.type === "group";
          let name = "";
          let avatar: string | null = "";

          if (!isGroup) {
            const otherUserId = memberIds.find((id: number) => id !== userId);
            const user = userById.get(otherUserId);
            name = user?.name || "Unknown";
            avatar = user?.profile_image ?? null;
          } else {
            name = chat.name || "Unnamed Group";
            avatar = null;
          }

          const lastMessage = lastByChatId.get(chat.id);
          const preview = lastMessagePreview(lastMessage);

          return {
            id: String(chat.id),
            name,
            avatar,
            type: chat.type,
            content: preview,
            timestamp: lastMessage ? formatChatTime(lastMessage.created_at) : "",
            lastMessage: lastMessage
              ? {
                  id: String(lastMessage.id),
                  content: preview,
                  createdAt: lastMessage.created_at,
                  messageType: lastMessage.messageType || "text",
                }
              : undefined,
            status: "read",
            _sortAt: lastMessage?.created_at
              ? new Date(lastMessage.created_at).getTime()
              : new Date(chat.updated_at || chat.created_at || 0).getTime(),
          };
        })
        .sort((a, b) => b._sortAt - a._sortAt)
        .map(({ _sortAt, ...chat }) => chat);

      return ReS(res, SUCCESS_CODE, "Chats loaded", result);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async updateChatName(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { name } = req.body;

      const chat: any = await chatRepository.findById(chatId);
      if (!chat || chat.type !== "group") {
        return ReE(res, SERVER_ERROR_CODE, "Chat not found or not a group");
      }

      const updated = await chatRepository.updateById(chatId, { $set: { name } });

      SocketService.emit(`chat_${chatId}`, {
        event: "chat_updated",
        data: updated,
      });

      return ReS(res, SUCCESS_CODE, "Chat name updated successfully", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async deleteChat(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);

      const chat = await chatRepository.findById(chatId);
      if (!chat) {
        return ReE(res, SERVER_ERROR_CODE, "Chat not found");
      }

      await messageRepository.deleteMany({ chatId });
      await chatRepository.deleteById(chatId);

      SocketService.emit(`chat_deleted`, {
        event: "chat_deleted",
        data: { chatId },
      });

      return ReS(res, SUCCESS_CODE, "Chat deleted successfully", { chatId });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new ChatController();
