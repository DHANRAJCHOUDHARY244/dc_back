import { chatPermissionRepository, messageRepository } from "@repositories";
import { SocketService } from "../services/socket.service";
import type { Socket } from "socket.io";

/** Attach CRM chat handlers to a single socket connection (no duplicate io.on("connection")). */
export function attachChatSocketHandlers(socket: Socket) {
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
}

/** @deprecated Handlers are attached in setupSocket — kept for import compatibility. */
export const registerChatSocket = () => {
	/* no-op: use attachChatSocketHandlers per socket in setupSocket */
};
