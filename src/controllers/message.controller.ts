import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE } from "@constants/serverCode";
import { chatRepository, messageRepository, userRepository } from "@repositories";
import { SocketService } from "@services/socket.service";
import { EVENT_TASK_TYPE, SOCKET_EVENTS } from "@constants/socket.constants";

class MessageController {
  async sendMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: userId } = req.user;
      const { chatId, senderId, content } = req.body;

      if (!chatId || !senderId || !content) {
        return ReE(res, SERVER_ERROR_CODE, "Missing message fields");
      }

      const chat: any = await chatRepository.findById(Number(chatId));
      if (!chat) return ReE(res, SERVER_ERROR_CODE, "Chat not found");

      const message: any = await messageRepository.create({ chatId, senderId, content });
      const sender: any = await userRepository.findById(Number(senderId), {
        select: "id name email profile_image",
        lean: true,
      });

      const payload = {
        ...message.toObject?.() ?? message,
        senderName: sender?.name || "Unknown",
        avatarUrl: sender?.profile_image || "",
      };

      const members = chat.members || [];
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
          message: content,
        });
      });

      return ReS(res, SUCCESS_CODE, "Message sent successfully", payload);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
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
          sort: { createdAt: 1 },
        },
      );

      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        senderName: msg.sender?.name || "Unknown",
        senderId: msg.sender?.id,
        avatarUrl: msg.sender?.profile_image || "",
        content: msg.content,
        timestamp: msg.createdAt,
      }));

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

      const updated = await messageRepository.updateById(Number(messageId), {
        $set: { content },
      });

      const chat = await chatRepository.findById(message.chatId);
      const payload = { message: updated, chat };

      SocketService.emit(`chat_${message.chatId}`, {
        event: "updated_message",
        data: payload,
      });

      return ReS(res, SUCCESS_CODE, "Message updated successfully", payload);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async deleteMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId }: any = req.params;

      const message: any = await messageRepository.findById(Number(messageId));
      if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

      const chatId = message.chatId;
      await messageRepository.deleteById(Number(messageId));

      SocketService.emit(`chat_${chatId}`, {
        event: "deleted_message",
        data: { messageId, chatId },
      });

      return ReS(res, SUCCESS_CODE, "Message deleted successfully", { messageId, chatId });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new MessageController();
