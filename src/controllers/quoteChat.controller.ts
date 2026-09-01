import { AuthenticatedRequest } from "@constants/common.interface";
import { FORBIDDEN_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { SOCKET_EVENTS } from "@constants/socket.constants";
import { quoteChatRepository, quoteRepository, userRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { canAccessQuote } from "@services/quoteAccess.service";
import { isQuoteAdmin } from "@services/adminPermission.service";
import { Request, Response } from "express";
import { SocketService } from "@services/socket.service";
import jwt from "jsonwebtoken";

class QuoteChatController {
    async sendMessage(req: AuthenticatedRequest, res: Response) {
        try {
            const { id: sender_id } = req.user;
            const { quote_id, content } = req.body;
            if (!quote_id || !content)
                return ReE(res, SERVER_ERROR_CODE, "Missing message fields");

            const quote: any = await quoteRepository.findOne(
                { id: Number(quote_id) },
                { select: "id sender_id customer_id", lean: true },
            );
            if (!quote) return ReE(res, SERVER_ERROR_CODE, "Quote not found");
            if (!(await canAccessQuote(req.user, quote))) {
                return ReE(res, FORBIDDEN_CODE, "Forbidden");
            }

            const m: any = await quoteChatRepository.create({ content, sender_id, quote_id });
            const message = m?.toObject?.() ?? m;

            const sender: any = await userRepository.findById(sender_id, {
                select: "id name email profile_image",
                lean: true,
            });
            const payload = {
                ...message,
                senderId: sender?.id || "Unknown",
                senderName: sender?.name || "Unknown",
                avatarUrl: sender?.profile_image || "",
            };
            SocketService.emitToRoom(
                `quote-chat-${quote_id}`,
                SOCKET_EVENTS.QUOTE_CHAT_MESSAGE,
                payload
            );
            return ReS(res, SUCCESS_CODE, "Message sent successfully", payload);
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
    async sendChatToken(req: Request, res: Response) {
        try {
            const { quote_id, bypass_token } = req.body;
            if (!quote_id || !bypass_token) {
                return ReE(res, SERVER_ERROR_CODE, "Quote ID and bypass token are required");
            }
            const quote: any = await quoteRepository.findOne(
                { id: Number(quote_id), bypass_token: String(bypass_token) },
                {
                    populate: {
                        path: "customer",
                        select: "id name email",
                    },
                    lean: true,
                },
            );
            if (!quote) return ReE(res, SERVER_ERROR_CODE, "Quote not found");
            const userData = quote.customer;
            const token = jwt.sign(
                  { ...userData},process.env.JWT_SECRET!,
                  {expiresIn:"1d"});
            return ReS(res,SUCCESS_CODE,"Token Genrated Successfully",{token,user:userData})
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
    async updateMessage(req: AuthenticatedRequest, res: Response) {
        try {
            const { messageId }:any = req.params;
            const { content } = req.body;

            const message: any = await quoteChatRepository.findById(Number(messageId));
            if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

            const quote: any = await quoteRepository.findOne(
                { id: Number(message.quote_id) },
                { select: "id sender_id customer_id", lean: true },
            );
            if (!quote) return ReE(res, SERVER_ERROR_CODE, "Quote not found");

            const isOwner = Number(message.sender_id) === Number(req.user.id);
            const isAdmin = req.user.role === "SUPER_ADMIN" || (await isQuoteAdmin(req.user));
            if (!isOwner && !isAdmin) {
                return ReE(res, FORBIDDEN_CODE, "Forbidden");
            }

            const updated = await quoteChatRepository.updateById(Number(messageId), {
                $set: { content },
            });
            const payload = { message: updated };

            SocketService.emitToRoom(
                `quote-chat-${message.quote_id}`,
                SOCKET_EVENTS.QUOTE_CHAT_MESSAGE,
                {
                    event: "updated_message",
                    data: payload,
                    quote_id: message.quote_id,
                },
            );

            return ReS(res, SUCCESS_CODE, "Message updated successfully", payload);
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
    async getMessages(req: AuthenticatedRequest, res: Response) {
        try {
            const { quote_id } = req.params;

            if (!quote_id) return ReE(res, SERVER_ERROR_CODE, "quote_id is required");

            const quote: any = await quoteRepository.findOne(
                { id: Number(quote_id) },
                { select: "id sender_id customer_id", lean: true },
            );
            if (!quote) return ReE(res, SERVER_ERROR_CODE, "Quote not found");
            if (!(await canAccessQuote(req.user, quote))) {
                return ReE(res, FORBIDDEN_CODE, "Forbidden");
            }

            const messages: any[] = await quoteChatRepository.find(
                { quote_id: Number(quote_id) },
                {
                    populate: {
                        path: "sender",
                        select: "id name email profile_image",
                    },
                    sort: { created_at: 1 },
                    lean: true,
                },
            );

            const formattedMessages = messages.map((msg: any) => ({
                id: msg.id,
                senderName: msg.sender?.name || "Unknown",
                senderId: msg.sender?.id,
                avatarUrl: msg.sender?.profile_image || "",
                content: msg.content,
                timestamp: msg.created_at,
            }));

            return ReS(res, SUCCESS_CODE, "Messages retrieved successfully", formattedMessages,);
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
    async deleteMessage(req: AuthenticatedRequest, res: Response) {
        try {
            const { messageId }:any = req.params;

            const message: any = await quoteChatRepository.findById(Number(messageId));
            if (!message) return ReE(res, SERVER_ERROR_CODE, "Message not found");

            const quote: any = await quoteRepository.findOne(
                { id: Number(message.quote_id) },
                { select: "id sender_id customer_id", lean: true },
            );
            if (!quote) return ReE(res, SERVER_ERROR_CODE, "Quote not found");

            const isOwner = Number(message.sender_id) === Number(req.user.id);
            const isAdmin = req.user.role === "SUPER_ADMIN" || (await isQuoteAdmin(req.user));
            if (!isOwner && !isAdmin) {
                return ReE(res, FORBIDDEN_CODE, "Forbidden");
            }

            await quoteChatRepository.deleteById(Number(messageId));

            SocketService.emitToRoom(
                `quote-chat-${message.quote_id}`,
                SOCKET_EVENTS.QUOTE_CHAT_MESSAGE,
                {
                    event: "deleted_message",
                    messageId: Number(messageId),
                    quote_id: message.quote_id,
                },
            );

            return ReS(res, SUCCESS_CODE, "Message deleted successfully", { messageId });
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
}
export default new QuoteChatController()
