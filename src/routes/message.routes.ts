import { Router } from 'express';
import MessageController from '@controllers/message.controller';
import { chatMessageRateLimit, chatSearchRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/', chatMessageRateLimit, MessageController.sendMessage.bind(MessageController));
router.get('/search-global', chatSearchRateLimit, MessageController.globalSearch.bind(MessageController));
router.get('/starred', chatSearchRateLimit, MessageController.getStarredMessages.bind(MessageController));
router.get('/pinned/:chatId', MessageController.getPinnedMessages.bind(MessageController));
router.get('/readers/:messageId', MessageController.getMessageReaders.bind(MessageController));
router.get('/search/:chatId', chatSearchRateLimit, MessageController.searchMessages.bind(MessageController));
router.get('/get-all/:chatId', MessageController.getMessages.bind(MessageController));
router.post('/:messageId/pin', MessageController.pinMessage.bind(MessageController));
router.post('/:messageId/star', MessageController.toggleStar.bind(MessageController));
router.post('/:messageId/forward', MessageController.forwardMessage.bind(MessageController));
router.post('/:messageId/reactions', MessageController.addReaction.bind(MessageController));
router.get('/:messageId', MessageController.getMessageById.bind(MessageController));
router.put('/:messageId', MessageController.updateMessage.bind(MessageController));
router.delete('/:messageId', MessageController.deleteMessage.bind(MessageController));

export default router;
