import { Router } from 'express';
import MessageController from '@controllers/message.controller';


const router = Router();

router.post('/', MessageController.sendMessage.bind(MessageController));
router.get('/get-all/:chatId', MessageController.getMessages.bind(MessageController));
router.get('/:messageId', MessageController.getMessageById.bind(MessageController));
router.put('/:messageId', MessageController.updateMessage.bind(MessageController));
router.delete('/:messageId', MessageController.deleteMessage.bind(MessageController));

export default router;
