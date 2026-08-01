import { chatPermissionRepository, messageRepository } from "@repositories";
import { SocketService } from "../services/socket.service";

export const registerChatSocket = () => {
  const io = SocketService.getIO();

  io.on("connection", (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    socket.on("send-message", async (data) => {
      const { chatId, senderId, receiverId, content } = data;

      const permission = await chatPermissionRepository.findOne({ senderId, receiverId });

      if (!permission) {
        return socket.emit("message-error", {
          message: "You are not allowed to send message to this user.",
        });
      }

      await messageRepository.create({ chatId, senderId, content });

      SocketService.emit("receive-message", {
        chatId,
        senderId,
        receiverId,
        content,
      });
    });
  });
};
