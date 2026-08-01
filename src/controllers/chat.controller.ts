import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE } from "@constants/serverCode";
import { chatRepository, messageRepository, userRepository } from "@repositories";
import { SocketService } from "@services/socket.service";

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
        const directChats: any = await chatRepository.find({ type: "direct" }, { lean: true });

        const existingChat = directChats.find((c: any) => {
          const m = Array.isArray(c.members) ? c.members : [];
          return JSON.stringify([...m].sort((a: number, b: number) => a - b)) ===
            JSON.stringify(uniqueSortedMembers);
        });

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

      const chats: any = await chatRepository.find(
        { members: userId },
        { sort: { updatedAt: -1 }, lean: true },
      );

      const result = await Promise.all(
        chats.map(async (chat: any) => {
          const memberIds = chat.members || [];

          let name = "";
          let avatar = "";
          const isGroup = chat.type === "group";

          if (!isGroup) {
            const otherUserId = memberIds.find((id: number) => id !== userId);
            const user: any = await userRepository.findById(otherUserId, {
              select: "name profile_image",
              lean: true,
            });
            name = user?.name || "Unknown";
            avatar = user?.profile_image ?? null;
          } else {
            name = chat.name || "Unnamed Group";
            avatar = null;
          }

          const lastMessage: any = await messageRepository.findOne(
            { chatId: chat.id },
            { sort: { createdAt: -1 }, lean: true },
          );

          const formatTime = (dateString: string): string => {
            const date = new Date(dateString);
            let hours = date.getHours();
            const minutes = date.getMinutes().toString().padStart(2, "0");
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
          };

          return {
            id: chat.id.toString(),
            name,
            avatar,
            type: chat.type,
            content: lastMessage?.content || "Hi there :)",
            timestamp: lastMessage ? formatTime(lastMessage.created_at) : "",
          };
        }),
      );

      return ReS(res, SUCCESS_CODE, "Chats loaded", result.filter(Boolean));
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
