import { Response } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE, BAD_REQUEST_CODE } from "@constants/serverCode";
import {
  chatRepository,
  chatReadStateRepository,
  messageRepository,
  userRepository,
} from "@repositories";
import { SocketService } from "@services/socket.service";
import {
  assertChatMember,
  buildMemberMeta,
  createSystemMessage,
  emitChatEvent,
  getChatMembersWithPresence,
  getUserMemberMeta,
  isChatAdmin,
  isChatMember,
  isSystemAdmin,
  updateUserMemberMeta,
} from "@services/chat.service";
import { listOnlineUsers } from "@services/presence.service";
import { computeUnreadForChat, computeUnreadStatsForChats } from "@services/chatUnread.service";
import { UploadCategory } from "@constants/common.enum";
import { uploadFiles } from "@utils/fileUpload.helper";
import { UploadedFile } from "express-fileupload";
import { chatNotificationRoute, dispatchChatInAppNotification, purgeChatNotificationsForUser } from "@services/notificationLifecycle.service";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";

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
  if (lastMessage?.systemType) {
    const meta = lastMessage.systemMeta || {};
    if (lastMessage.systemType === "member_joined") return `${meta.userName || "Someone"} joined`;
    if (lastMessage.systemType === "member_left") return `${meta.userName || "Someone"} left`;
    if (lastMessage.systemType === "member_removed") return `${meta.userName || "Someone"} was removed`;
    if (lastMessage.systemType === "group_renamed") return `Group renamed to ${meta.newName || ""}`;
    if (lastMessage.systemType === "admin_promoted") return `${meta.userName || "Someone"} is now admin`;
  }
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

      if (!["direct", "group"].includes(type)) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid chat type");
      }

      const uniqueSortedMembers = [...new Set([...members.map(Number), user_id])].sort((a, b) => a - b);
      if (uniqueSortedMembers.length < 2) {
        return ReE(res, SERVER_ERROR_CODE, "Invalid chat data");
      }
      if (type === "direct" && uniqueSortedMembers.length !== 2) {
        return ReE(res, BAD_REQUEST_CODE, "Direct chat must have exactly 2 members");
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

        chat = await chatRepository.create({
          type,
          name: null,
          members: uniqueSortedMembers,
          memberMeta: buildMemberMeta(uniqueSortedMembers),
        });
      } else {
        chat = await chatRepository.create({
          type,
          name: name || "Unnamed Group",
          members: uniqueSortedMembers,
          createdBy: user_id,
          admins: [user_id],
          memberMeta: buildMemberMeta(uniqueSortedMembers),
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
        chat.avatar = chat.avatar || null;
      }

      uniqueSortedMembers.forEach((id) => {
        if (id !== user_id) {
          SocketService.emitToUser(id, `chat_created_${id}`, { event: "chat_created", data: chat });
        }
      });

      return ReS(res, SUCCESS_CODE, "Chat created successfully", {
        ...chat.toObject?.() ?? chat,
        isAdmin: type === "group",
      });
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getChats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return ReE(res, SERVER_ERROR_CODE, "User ID missing");

      const rawPage = req.query.page != null ? Number(req.query.page) : NaN;
      const rawLimit = req.query.limit != null ? Number(req.query.limit) : NaN;
      const usePagination =
        Number.isFinite(rawPage) && rawPage > 0 && Number.isFinite(rawLimit) && rawLimit > 0;
      const page = usePagination ? Math.max(1, Math.floor(rawPage)) : 0;
      const limit = usePagination ? Math.min(200, Math.max(1, Math.floor(rawLimit))) : 0;
      const skip = usePagination ? (page - 1) * limit : 0;

      const findOptions: any = { sort: { updated_at: -1, created_at: -1 }, lean: true };
      if (usePagination) {
        findOptions.skip = skip;
        findOptions.limit = limit + 1;
      }

      const chats: any[] = await chatRepository.find({ members: userId }, findOptions);

      let hasMore = false;
      if (usePagination && chats.length > limit) {
        hasMore = true;
        chats.pop();
      }

      if (!chats.length) {
        const empty = usePagination ? { chats: [], hasMore: false, page, limit } : [];
        return ReS(res, SUCCESS_CODE, "Chats loaded", empty);
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
                  systemType: { $first: "$systemType" },
                  systemMeta: { $first: "$systemMeta" },
                  mentions: { $first: "$mentions" },
                },
              },
            ])
          : Promise.resolve([]),
      ]);

      const unreadStatsByChat = await computeUnreadStatsForChats(userId, chatIds);

      const userById = new Map((users as any[]).map((u) => [u.id, u]));
      const lastByChatId = new Map((lastMessages as any[]).map((m) => [m._id, m]));
      const onlineIds = new Set((await listOnlineUsers()).map((u) => Number(u.id)));

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
            avatar = chat.avatar ?? null;
          }

          const lastMessage = lastByChatId.get(chat.id);
          const preview = lastMessagePreview(lastMessage);
          const unreadStatsForChat = unreadStatsByChat.get(chat.id) || { unreadCount: 0, mentionCount: 0 };
          const unreadCount = unreadStatsForChat.unreadCount;
          const mentionCount = unreadStatsForChat.mentionCount;
          const memberMeta = getUserMemberMeta(chat, userId);

          let isOnline = false;
          if (!isGroup) {
            const otherUserId = memberIds.find((id: number) => id !== userId);
            isOnline = otherUserId ? onlineIds.has(Number(otherUserId)) : false;
          }

          return {
            id: String(chat.id),
            name,
            avatar,
            type: chat.type,
            otherUserId: !isGroup ? memberIds.find((id: number) => id !== userId) : undefined,
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
            status: unreadCount > 0 ? "unread" : "read",
            unreadCount,
            mentionCount,
            memberCount: memberIds.length,
            isAdmin: isGroup ? isChatAdmin(chat, req.user) : false,
            isMuted: !!memberMeta.muted,
            isPinned: !!memberMeta.pinned,
            isArchived: !!memberMeta.archived,
            isOnline,
            _sortPinned: memberMeta.pinned ? 1 : 0,
            _sortAt: lastMessage?.created_at
              ? new Date(lastMessage.created_at).getTime()
              : new Date(chat.updated_at || chat.created_at || 0).getTime(),
          };
        })
        .sort((a, b) => b._sortPinned - a._sortPinned || b._sortAt - a._sortAt)
        .map(({ _sortAt, _sortPinned, ...chat }) => chat);

      const payload = usePagination ? { chats: result, hasMore, page, limit } : result;
      return ReS(res, SUCCESS_CODE, "Chats loaded", payload);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const members = await getChatMembersWithPresence(chat);
      return ReS(res, SUCCESS_CODE, "Members loaded", {
        members,
        isAdmin: isChatAdmin(chat, req.user),
        createdBy: chat!.createdBy,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async addMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const memberIds: number[] = (req.body.memberIds || []).map(Number).filter(Boolean);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type !== "group") return ReE(res, BAD_REQUEST_CODE, "Not a group chat");
      if (!isChatAdmin(chat, req.user)) return ReE(res, SERVER_ERROR_CODE, "Admin access required");

      const existing = new Set<number>((chat!.members || []).map(Number));
      const toAdd = memberIds.filter((id) => !existing.has(id));
      if (!toAdd.length) return ReE(res, BAD_REQUEST_CODE, "No new members to add");

      const newMembers: number[] = [...Array.from(existing), ...toAdd];
      const updated = await chatRepository.updateById(chatId, {
        $set: {
          members: newMembers,
          memberMeta: buildMemberMeta(newMembers, chat!.memberMeta),
        },
      });

      const addedUsers = await userRepository.find(
        { id: { $in: toAdd } },
        { select: "id name", lean: true },
      );
      for (const u of addedUsers as any[]) {
        await createSystemMessage(chatId, "member_joined", {
          userName: u.name,
          userId: u.id,
          actorName: req.user.name,
        });
        SocketService.emitToUser(u.id, `chat_created_${u.id}`, { event: "chat_created", data: updated });

        const route = chatNotificationRoute(chatId);
        const notifyMessage = `${req.user.name} added you to ${chat!.name || "a group"}`;
        void dispatchChatInAppNotification({
          userId: u.id,
          chatId,
          messageId: 0,
          senderId: req.user.id,
          message: notifyMessage,
          route,
          senderName: req.user.name,
          senderProfileImage: req.user.profile_image,
          taskType: EVENT_TASK_TYPE.CREATED,
        }).catch(() => undefined);
      }

      emitChatEvent(chatId, "members_updated", { chatId, members: newMembers });
      return ReS(res, SUCCESS_CODE, "Members added", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const targetUserId = Number(req.params.userId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type !== "group") return ReE(res, BAD_REQUEST_CODE, "Not a group chat");
      if (!isChatAdmin(chat, req.user)) return ReE(res, SERVER_ERROR_CODE, "Admin access required");
      if ((chat!.members || []).length <= 2) return ReE(res, BAD_REQUEST_CODE, "Group must have at least 2 members");

      const newMembers = (chat!.members || []).filter((id: number) => id !== targetUserId);
      const updated = await chatRepository.updateById(chatId, {
        $set: {
          members: newMembers,
          memberMeta: buildMemberMeta(newMembers, chat!.memberMeta),
          admins: (chat!.admins || []).filter((id: number) => id !== targetUserId),
        },
      });

      const targetUser: any = await userRepository.findById(targetUserId, { select: "name", lean: true });
      await createSystemMessage(chatId, "member_removed", {
        userName: targetUser?.name || "User",
        userId: targetUserId,
        actorName: req.user.name,
      });

      emitChatEvent(chatId, "members_updated", { chatId, members: newMembers });
      return ReS(res, SUCCESS_CODE, "Member removed", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async leaveGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const userId = req.user.id;
      const { error, chat } = await assertChatMember(chatId, userId);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type !== "group") return ReE(res, BAD_REQUEST_CODE, "Not a group chat");
      if ((chat!.members || []).length <= 2) return ReE(res, BAD_REQUEST_CODE, "Cannot leave — group would be empty");

      const newMembers = (chat!.members || []).filter((id: number) => id !== userId);
      await chatRepository.updateById(chatId, {
        $set: {
          members: newMembers,
          memberMeta: buildMemberMeta(newMembers, chat!.memberMeta),
          admins: (chat!.admins || []).filter((id: number) => id !== userId),
        },
      });

      await createSystemMessage(chatId, "member_left", {
        userName: req.user.name,
        userId,
      });

      emitChatEvent(chatId, "members_updated", { chatId, members: newMembers });
      return ReS(res, SUCCESS_CODE, "Left group", { chatId });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async promoteAdmin(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const targetUserId = Number(req.body.userId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type !== "group") return ReE(res, BAD_REQUEST_CODE, "Not a group chat");

      const canPromote =
        isSystemAdmin(req.user.role) || Number(chat!.createdBy) === Number(req.user.id);
      if (!canPromote) return ReE(res, SERVER_ERROR_CODE, "Only creator or system admin can promote");

      if (!isChatMember(chat, targetUserId)) return ReE(res, BAD_REQUEST_CODE, "User is not a member");
      const admins = [...new Set([...(chat!.admins || []), targetUserId])];
      const updated = await chatRepository.updateById(chatId, { $set: { admins } });

      const targetUser: any = await userRepository.findById(targetUserId, { select: "name", lean: true });
      await createSystemMessage(chatId, "admin_promoted", {
        userName: targetUser?.name,
        userId: targetUserId,
        actorName: req.user.name,
      });

      emitChatEvent(chatId, "members_updated", { chatId, members: chat!.members, admins });
      return ReS(res, SUCCESS_CODE, "Admin promoted", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async demoteAdmin(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const targetUserId = Number(req.body.userId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type !== "group") return ReE(res, BAD_REQUEST_CODE, "Not a group chat");

      const canDemote =
        isSystemAdmin(req.user.role) || Number(chat!.createdBy) === Number(req.user.id);
      if (!canDemote) return ReE(res, SERVER_ERROR_CODE, "Only creator or system admin can demote");

      if (Number(chat!.createdBy) === targetUserId) {
        return ReE(res, BAD_REQUEST_CODE, "Cannot demote the group creator");
      }

      const admins = (chat!.admins || []).filter((id: number) => id !== targetUserId);
      const updated = await chatRepository.updateById(chatId, { $set: { admins } });

      await createSystemMessage(chatId, "admin_promoted", {
        userName: (await userRepository.findById(targetUserId, { select: "name", lean: true }))?.name,
        userId: targetUserId,
        actorName: req.user.name,
        demoted: true,
      });

      emitChatEvent(chatId, "members_updated", { chatId, members: chat!.members, admins });
      return ReS(res, SUCCESS_CODE, "Admin demoted", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async uploadAvatar(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type !== "group") return ReE(res, BAD_REQUEST_CODE, "Only group chats have icons");
      if (!isChatAdmin(chat, req.user)) return ReE(res, SERVER_ERROR_CODE, "Admin access required");

      const filesMap = req.files as { [key: string]: UploadedFile | UploadedFile[] } | undefined;
      const fileRaw = filesMap?.avatar || filesMap?.file || filesMap?.image;
      if (!fileRaw) return ReE(res, BAD_REQUEST_CODE, "Image file required");

      const uploaded = await uploadFiles({
        category: UploadCategory.CHAT,
        files: fileRaw,
        entityId: chatId,
        multiple: false,
        maxSizeMB: 5,
        allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"],
      });
      const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      const updated = await chatRepository.updateById(chatId, { $set: { avatar: file.url } });

      emitChatEvent(chatId, "chat_updated", updated);
      return ReS(res, SUCCESS_CODE, "Group icon updated", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async markRead(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const messageId = Number(req.body.messageId);
      const userId = req.user.id;
      const { error } = await assertChatMember(chatId, userId);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      if (messageId) {
        const msg: any = await messageRepository.findOne({ id: messageId, chatId }, { lean: true });
        if (!msg) return ReE(res, BAD_REQUEST_CODE, "Invalid message for this chat");
      }

      const existing: any = await chatReadStateRepository.findOne({ chatId, userId }, { lean: true });
      if (existing) {
        await chatReadStateRepository.updateById(existing.id, {
          $set: { lastReadMessageId: messageId, lastReadAt: new Date() },
        });
      } else {
        await chatReadStateRepository.create({
          chatId,
          userId,
          lastReadMessageId: messageId,
          lastReadAt: new Date(),
        });
      }

      // Mark all prior peer messages as read (not only the latest watermark message).
      if (messageId) {
        await messageRepository.updateMany(
          {
            chatId,
            id: { $lte: messageId },
            senderId: { $ne: userId },
          },
          { $addToSet: { readBy: userId } },
        );
      }

      emitChatEvent(chatId, "read_receipt", { chatId, userId, messageId });
      await purgeChatNotificationsForUser(userId, chatId);
      return ReS(res, SUCCESS_CODE, "Marked as read", { chatId, messageId });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getUnread(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const userId = req.user.id;
      const { error } = await assertChatMember(chatId, userId);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);

      const readState: any = await chatReadStateRepository.findOne({ chatId, userId }, { lean: true });
      const lastReadId = readState?.lastReadMessageId || 0;
      const { unreadCount, mentionCount } = await computeUnreadForChat(userId, chatId, lastReadId);

      return ReS(res, SUCCESS_CODE, "Unread loaded", {
        unreadCount,
        mentionCount,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async updateChatName(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { name } = req.body;
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type !== "group") return ReE(res, SERVER_ERROR_CODE, "Chat not found or not a group");
      if (!isChatAdmin(chat, req.user)) return ReE(res, SERVER_ERROR_CODE, "Admin access required");

      const updated = await chatRepository.updateById(chatId, { $set: { name } });
      await createSystemMessage(chatId, "group_renamed", {
        newName: name,
        actorName: req.user.name,
      });

      emitChatEvent(chatId, "chat_updated", updated);
      return ReS(res, SUCCESS_CODE, "Chat name updated successfully", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async toggleMute(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      const meta = getUserMemberMeta(chat, req.user.id);
      const updated = await updateUserMemberMeta(chatId, req.user.id, { muted: !meta.muted });
      emitChatEvent(chatId, "chat_updated", { chatId, userId: req.user.id, muted: !meta.muted });
      return ReS(res, SUCCESS_CODE, meta.muted ? "Unmuted" : "Muted", { muted: !meta.muted, chat: updated });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async togglePin(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      const meta = getUserMemberMeta(chat, req.user.id);
      const updated = await updateUserMemberMeta(chatId, req.user.id, { pinned: !meta.pinned });
      emitChatEvent(chatId, "chat_updated", { chatId, userId: req.user.id, pinned: !meta.pinned });
      return ReS(res, SUCCESS_CODE, meta.pinned ? "Unpinned" : "Pinned", { pinned: !meta.pinned, chat: updated });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async toggleArchive(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      const meta = getUserMemberMeta(chat, req.user.id);
      const updated = await updateUserMemberMeta(chatId, req.user.id, { archived: !meta.archived });
      return ReS(res, SUCCESS_CODE, meta.archived ? "Unarchived" : "Archived", {
        archived: !meta.archived,
        chat: updated,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async deleteChat(req: AuthenticatedRequest, res: Response) {
    try {
      const chatId = Number(req.params.chatId);
      const { error, chat } = await assertChatMember(chatId, req.user.id);
      if (error) return ReE(res, SERVER_ERROR_CODE, error);
      if (chat!.type === "group" && !isChatAdmin(chat, req.user)) {
        return ReE(res, SERVER_ERROR_CODE, "Admin access required");
      }

      const memberIds: number[] = chat!.members || [];
      await messageRepository.deleteMany({ chatId });
      await chatReadStateRepository.deleteMany({ chatId });
      await chatRepository.deleteById(chatId);

      for (const memberId of memberIds) {
        SocketService.emitToUser(memberId, `chat_created_${memberId}`, {
          event: "chat_deleted",
          data: { chatId },
        });
      }

      return ReS(res, SUCCESS_CODE, "Chat deleted successfully", { chatId });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new ChatController();
