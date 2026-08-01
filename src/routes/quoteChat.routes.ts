import quoteChatController from '@controllers/quoteChat.controller';
import { Router } from 'express';

const router = Router();

router.post('/v1/send', quoteChatController.sendMessage.bind(quoteChatController));
router.post('/token', quoteChatController.sendChatToken.bind(quoteChatController));
router.post('/v1/get-all/:quote_id', quoteChatController.getMessages.bind(quoteChatController));
router.put('/v1/:messageId', quoteChatController.updateMessage.bind(quoteChatController));
router.delete('/v1/:messageId', quoteChatController.deleteMessage.bind(quoteChatController));

export default router;
