import { Response } from "express";
import { activityTrackerRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import {
  SUCCESS_CODE,
  BAD_REQUEST_CODE,
  SERVER_ERROR_CODE,
} from "@constants/serverCode";

class ActivityTrackerController {
  async logActivity(req: any, res: Response) {
    try {
      const user_id = req.user.id;
      const { date, slot, logs } = req.body;

      if (!date || !slot || !logs) {
        return ReE(res, BAD_REQUEST_CODE, "slot and non-empty logs are required");
      }

      let tracker: any = await activityTrackerRepository.findOne({ user_id, date });

      if (!tracker) {
        tracker = await activityTrackerRepository.create({
          user_id,
          date,
          activities: [{ slot, logs }],
        });
      } else {
        if (tracker.is_leave) {
          return ReE(res, BAD_REQUEST_CODE, "Cannot add activity on leave day");
        }

        const activities = [...(tracker.activities || [])];
        const slotIndex = activities.findIndex((a: any) => a.slot === slot);

        if (slotIndex > -1) {
          activities[slotIndex].logs = logs;
        } else {
          activities.push({ slot, logs });
        }

        tracker = await activityTrackerRepository.updateById(tracker.id, {
          $set: { activities },
        });
      }

      return ReS(res, SUCCESS_CODE, "Activity saved", tracker);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async editSlot(req: any, res: Response) {
    try {
      const user_id = req.user.id;
      const { id, slot, logs } = req.body;

      if (!id || !slot || typeof logs !== "string") {
        return ReE(res, BAD_REQUEST_CODE, "id, slot and logs (string) are required");
      }

      const tracker: any = await activityTrackerRepository.findOne({ user_id, id });

      if (!tracker) {
        return ReE(res, BAD_REQUEST_CODE, "No activity found");
      }

      const activities = Array.isArray(tracker.activities)
        ? JSON.parse(JSON.stringify(tracker.activities))
        : [];

      const slotIndex = activities.findIndex((a: any) => a.slot === slot);

      if (slotIndex !== -1) {
        activities[slotIndex].logs = logs;
      } else {
        activities.push({ slot, logs: [logs] });
      }

      const updated = await activityTrackerRepository.updateById(tracker.id, {
        $set: { activities },
      });

      return ReS(res, SUCCESS_CODE, "Log added successfully", updated);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async markLeave(req: any, res: Response) {
    try {
      const user_id = req.user.id;
      const { date, reason } = req.body;

      if (!date || !reason) {
        return ReE(res, BAD_REQUEST_CODE, "date and reason are required");
      }

      const { doc } = await activityTrackerRepository.findOrCreate(
        { user_id, date },
        { user_id, date },
      );

      await activityTrackerRepository.updateById(doc.id, {
        $set: {
          is_leave: true,
          leave_reason: reason || null,
          activities: [],
        },
      });

      return ReS(res, SUCCESS_CODE, "Leave marked");
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async reportByDate(req: any, res: Response) {
    try {
      const { date } = req.query;

      if (!date) {
        return ReE(res, BAD_REQUEST_CODE, "date is required");
      }

      const data = await activityTrackerRepository.find(
        { date },
        {
          populate: { path: "user", select: "id name email" },
          sort: { user_id: 1 },
        },
      );

      return ReS(res, SUCCESS_CODE, "Report fetched", data);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async reportByDateRangeFullLogs(req: any, res: Response) {
    try {
      let { start_date, end_date, user_id, page, limit } = req.query;

      if (!start_date || !end_date) {
        return ReE(res, BAD_REQUEST_CODE, "start_date and end_date are required");
      }

      const userId = user_id ? parseInt(user_id, 10) : req.user.id;
      const pageNum = page ? parseInt(page, 10) : 1;
      const pageLimit = limit ? parseInt(limit, 10) : 10;

      const start = new Date(`${start_date} 00:00:00`);
      const end = new Date(`${end_date} 23:59:59`);

      const { rows, count } = await activityTrackerRepository.findPaginated(
        {
          user_id: userId,
          date: { $gte: start, $lte: end },
        },
        {
          populate: { path: "user", select: "id name email" },
          sort: { date: 1 },
          page: pageNum,
          limit: pageLimit,
        },
      );

      const countLogs = (logs: any): number => {
        if (!logs) return 0;
        if (Array.isArray(logs)) return logs.length;
        if (typeof logs === "string") return logs.split("\n").filter(Boolean).length;
        return 0;
      };

      let totalLogs = 0;
      const slotSummary: Record<string, number> = {};

      rows.forEach((day: any) => {
        if (!day.activities) return;
        day.activities.forEach((a: any) => {
          const logCount = countLogs(a.logs);
          totalLogs += logCount;
          slotSummary[a.slot] = (slotSummary[a.slot] || 0) + logCount;
        });
      });

      const topSlot =
        Object.entries(slotSummary).length > 0
          ? Object.entries(slotSummary).sort((a: any, b: any) => b[1] - a[1])[0]
          : null;

      return ReS(res, SUCCESS_CODE, "Activity logs fetched successfully", {
        pagination: {
          totalRecords: count,
          totalPages: Math.ceil(count / pageLimit),
          currentPage: pageNum,
          limit: pageLimit,
        },
        summary: {
          totalDays: count,
          totalLogs,
          topSlot,
        },
        slotSummary,
        records: rows,
      });
    } catch (err) {
      console.error("Report Error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }
}

export default new ActivityTrackerController();
