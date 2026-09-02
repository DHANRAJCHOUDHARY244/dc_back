import notificationController from "@controllers/notification.controller";
import { Router } from "express";

const router = Router();

router.post("/v1/get-user-notifications",notificationController.getUserNotifications.bind(notificationController));
router.put("/v1/mark-multiple-notification-as-read",notificationController.markMultipleAsRead.bind(notificationController));
router.delete("/v1/multiple-delete",notificationController.deleteNotifications.bind(notificationController));
router.delete("/v1/chat",notificationController.deleteChatNotifications.bind(notificationController));
export default router;