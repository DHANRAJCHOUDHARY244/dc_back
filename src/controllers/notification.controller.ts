import {
  BAD_REQUEST_CODE,
  NO_CONTENT,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import { AuthenticatedRequest } from "@constants/common.interface";
import { Response } from "express";
import { notificationRepository } from "@repositories";
import { Roles } from "src/data/dataInserter";
import { notificationCutoffDate } from "@services/notificationLifecycle.service";

function escapeRegex(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class NotificationController {
  async  createNotification ({userId,message,route,meta = {},}:
     {userId: number;message: string;route: string;meta?: Record<string, any>;}) {
  try {
    const notification = await notificationRepository.create({ userId, message, route, meta_information: meta,});
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}
  async getUserNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const { limit = 10, page = 1, status = null, type = null } = req.body;
      const { id: userId, role } = req.user;
      const cutoff = notificationCutoffDate();

      const filter: any = { created_at: { $gte: cutoff } };
      if (role !== Roles.SUPER_ADMIN) filter.userId = userId;

      if (status === "read") filter.isRead = true;
      if (status === "unread") filter.isRead = false;

      if (type)
        filter["meta_information.type"] = {
          $regex: `^${escapeRegex(String(type))}$`,
          $options: "i",
        };

      const { count, rows } = await notificationRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { created_at: -1 },
      });

      if (!rows || rows.length === 0) {
        return ReE(res, NO_CONTENT, "No notifications found");
      }

      const userFilter = role !== Roles.SUPER_ADMIN ? { userId, created_at: { $gte: cutoff } } : { created_at: { $gte: cutoff } };
      const summaryRows: any[] = await notificationRepository.aggregateRaw([
        { $match: userFilter },
        {
          $facet: {
            global: [{ $count: "count" }],
            unread: [{ $match: { isRead: false } }, { $count: "count" }],
            read: [{ $match: { isRead: true } }, { $count: "count" }],
          },
        },
      ]);
      const facet = summaryRows[0] || {};
      const globalCount = facet.global?.[0]?.count ?? 0;
      const unreadCount = facet.unread?.[0]?.count ?? 0;
      const readCount = facet.read?.[0]?.count ?? 0;

      const totalPages = Math.ceil(count / limit);

      return ReS(res, SUCCESS_CODE, "Notifications fetched successfully", {
        pagination: {
          totalItems: count,
          totalPages,
          currentPage: Number(page),
          limit: Number(limit),
        },
        summary: {
          globalCount,
          unreadCount,
          readCount,
        },
        data: rows,
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }

  async markMultipleAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0)
        return ReE(res, BAD_REQUEST_CODE, "ids array is required");

      const filter: any = { id: { $in: ids } };
      if (req.user.role !== Roles.SUPER_ADMIN) filter.userId = req.user.id;

      await notificationRepository.updateMany(filter, { $set: { isRead: true } });

      return ReS(res, SUCCESS_CODE, "Notifications marked as read", { updatedIds: ids });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }

  async deleteNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0)
        return ReE(res, BAD_REQUEST_CODE, "ids array is required");

      const filter: any = { id: { $in: ids } };
      if (req.user.role !== Roles.SUPER_ADMIN) filter.userId = req.user.id;

      const result: any = await notificationRepository.deleteMany(filter);

      if (!result?.deletedCount && !result?.modifiedCount)
        return ReE(res, NO_CONTENT, "No notifications found to delete");

      return ReS(res, SUCCESS_CODE, "Notifications deleted successfully", { deletedIds: ids });
    } catch (error) {
      console.error("Error deleting notifications:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
}

export default new NotificationController();
