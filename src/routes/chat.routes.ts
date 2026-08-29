import { Router } from 'express';
import ChatController from '@controllers/chat.controller';
import { chatCreateRateLimit, chatListRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/', chatCreateRateLimit, ChatController.createChat.bind(ChatController));
router.get('/', chatListRateLimit, ChatController.getChats.bind(ChatController));
router.get('/:chatId/members', ChatController.getMembers.bind(ChatController));
router.post('/:chatId/members', ChatController.addMembers.bind(ChatController));
router.delete('/:chatId/members/:userId', ChatController.removeMember.bind(ChatController));
router.post('/:chatId/leave', ChatController.leaveGroup.bind(ChatController));
router.post('/:chatId/admins', ChatController.promoteAdmin.bind(ChatController));
router.post('/:chatId/demote-admin', ChatController.demoteAdmin.bind(ChatController));
router.post('/:chatId/avatar', ChatController.uploadAvatar.bind(ChatController));
router.post('/:chatId/mute', ChatController.toggleMute.bind(ChatController));
router.post('/:chatId/pin', ChatController.togglePin.bind(ChatController));
router.post('/:chatId/archive', ChatController.toggleArchive.bind(ChatController));
router.post('/:chatId/read', ChatController.markRead.bind(ChatController));
router.get('/:chatId/unread', ChatController.getUnread.bind(ChatController));
router.put('/:chatId', ChatController.updateChatName.bind(ChatController));
router.delete('/:chatId', ChatController.deleteChat.bind(ChatController));

export default router;
