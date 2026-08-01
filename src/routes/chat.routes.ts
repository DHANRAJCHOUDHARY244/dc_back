import { Router } from 'express';
import ChatController from '@controllers/chat.controller';

const router = Router();

router.post('/', ChatController.createChat.bind(ChatController));
router.get('/', ChatController.getChats.bind(ChatController));
router.put('/:chatId', ChatController.updateChatName.bind(ChatController));
router.delete('/:chatId', ChatController.deleteChat.bind(ChatController));

export default router;
