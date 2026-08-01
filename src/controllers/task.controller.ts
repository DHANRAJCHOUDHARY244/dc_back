import { Request, Response } from "express";
import {
  leadRepository,
  taskRepository,
  userRepository,
} from "@repositories";
import notificationController from "@controllers/notification.controller";

import {
  BAD_REQUEST_CODE,
  FORBIDDEN_CODE,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";

import { ReE, ReS } from "@services/generalHelper.service";
import { TaskStatus, TaskType } from "@constants/common.enum";
import { Roles } from "src/data/dataInserter";
import { AuthenticatedRequest } from "@constants/common.interface";

const taskPopulate = [
  { path: "user", select: "id name" },
  { path: "creator", select: "id name" },
  { path: "lead" },
];

class TaskController {
  async createTask(req: any, res: Response) {
    try {
      const { type = TaskType.OTHER, user_id, lead_id, name, instruction, due_date } = req.body;
      const creatorId = req.user.id;

      if (!type || !user_id)
        return ReE(res, BAD_REQUEST_CODE, "type and user_id are required");

      if (
        (type === TaskType.LEAD_VISIT || type === TaskType.LEAD_CONVERSION) &&
        !lead_id
      ) {
        return ReE(res, BAD_REQUEST_CODE, "lead_id is required");
      }

      if (lead_id) {
        const lead = await leadRepository.findById(Number(lead_id));
        if (!lead) return ReE(res, RESOURCE_NOT_FOUND, "Lead not found");
      }

      const task: any = await taskRepository.create({
        type,
        user_id,
        created_by: creatorId,
        lead_id: lead_id || null,
        name,
        instruction,
        due_date: due_date || null,
        progress: [
          {
            type: "CREATED",
            message: "Task created",
            updated_by: creatorId,
            updated_at: new Date(),
          },
        ],
      });

      await notificationController.createNotification({
        userId: user_id,
        message: "You have been assigned a new task",
        route: `/tasks/${task.id}`,
        meta: { type: "TASK", taskId: task.id },
      });

      return ReS(res, SUCCESS_CODE, "Task created successfully", task);
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Unable to create task");
    }
  }
  async getTasks(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        status = '',
        type = '',
        assignee_name = '',
        creator_name = '',
        start_date = null,
        end_date = null,
        order_by = "created_at",
        order_direction = "DESC",
      } = req.body;
      const {user} = req;
      const parsedPage = Number(page);
      const parsedLimit = Number(limit);

      const getUserIds = async (name?: string) => {
        if (!name) return null;
        const users = await userRepository.find(
          { name: { $regex: name, $options: "i" } },
          { select: "id", lean: true },
        );
        if (!users.length) throw new Error("USER_NOT_FOUND");
        return users.map((u: any) => u.id);
      };

      let [assigneeIds, creatorIds] = await Promise.all([
        getUserIds(assignee_name),
        getUserIds(creator_name),
      ]);

      if (user.role !== Roles.SUPER_ADMIN) {
        creatorIds = [user.id];
        assigneeIds = [user.id];
      }
      const filter: Record<string, unknown> = {
        ...(status && { status }),
        ...(type && { type }),
        ...(assigneeIds && { user_id: { $in: assigneeIds } }),
        ...(creatorIds && { created_by: { $in: creatorIds } }),
        ...(start_date &&
          end_date && {
          created_at: {
            $gte: new Date(start_date),
            $lte: new Date(end_date),
          },
        }),
      };

      const sortDir = order_direction === "ASC" ? 1 : -1;
      const { count, rows } = await taskRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { [order_by]: sortDir } as Record<string, 1 | -1>,
        populate: taskPopulate,
      });

      return ReS(res, SUCCESS_CODE, "Tasks fetched successfully", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        limit: parsedLimit,
        totalTasks: count,
        data: rows,
      });
    } catch (error: any) {
      console.error("getTasks error:", error);
      if (error.message === "USER_NOT_FOUND") {
        return ReE(res, RESOURCE_NOT_FOUND, "User not found");
      }
      return ReE(res, SERVER_ERROR_CODE, "Unable to fetch tasks");
    }
  }


  async getTaskById(req: Request, res: Response) {
    try {
      const task: any = await taskRepository.findById(Number(req.params.id), {
        populate: taskPopulate,
        lean: true,
      });
      if (!task) return ReE(res, RESOURCE_NOT_FOUND, "Task not found");
      const progressUsers = [
        ...new Set<number>(
          task?.progress?.map((p: any) => p.updated_by) || []
        ),
      ];
      const users:any = await userRepository.find(
        { id: { $in: progressUsers } },
        { select: "id name", lean: true },
      );
      task.progress = task.progress.map((p: any) => {
        const u = users.find((u: any) => u.id === p.updated_by);
        return { ...p, updated_by_name: u ? u.name : "Unknown" };
      });
      return ReS(res, SUCCESS_CODE, "Task fetched successfully", task);
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Unable to fetch task");
    }
  }

async updateTask(req: AuthenticatedRequest, res: Response) {
  try {
    const taskId:any = req.params.id;
    const {
      type,
      user_id,
      lead_id,
      name,
      instruction,
      due_date,
    } = req.body;

    const task: any = await taskRepository.findById(Number(taskId));
    if (!task) {
      return ReE(res, RESOURCE_NOT_FOUND, "Task not found");
    }

    if (type && !Object.values(TaskType).includes(type)) {
      return ReE(res, BAD_REQUEST_CODE, "Invalid task type");
    }

    if (
      (type === TaskType.LEAD_VISIT ||
        type === TaskType.LEAD_CONVERSION) &&
      !lead_id
    ) {
      return ReE(res, BAD_REQUEST_CODE, "lead_id is required");
    }

    if (lead_id) {
      const lead = await leadRepository.findById(Number(lead_id));
      if (!lead) {
        return ReE(res, RESOURCE_NOT_FOUND, "Lead not found");
      }
    }

    const plain = task?.toObject?.() ?? task;
    const updatePayload: any = {
      ...(type && { type }),
      ...(user_id && { user_id }),
      ...(lead_id !== undefined && { lead_id }),
      ...(name && { name }),
      ...(instruction !== undefined && { instruction }),
      ...(due_date !== undefined && { due_date }),
      progress: [
        ...(plain.progress || []),
        {
          type: "UPDATED",
          message: "Task updated",
          updated_by: req.user.id,
          updated_at: new Date(),
        },
      ],
    };

    const updated = await taskRepository.updateById(Number(taskId), { $set: updatePayload });

    await notificationController.createNotification({
      userId: plain.user_id,
      message: "Task details updated",
      route: `/tasks/${plain.id}`,
      meta: {
        type: "TASK",
        taskId: plain.id,
        updatedBy: req.user.id,
      },
    });

    return ReS(res, SUCCESS_CODE, "Task updated successfully", updated);
  } catch (error) {
    console.error("updateTask error:", error);
    return ReE(res, SERVER_ERROR_CODE, "Unable to update task");
  }
}


  async taskStatus(req: any, res: Response) {
    try {
      const { status, closing_message = null, closing_date = null } = req.body;
      const taskId = req.params.id;

      if (!status)
        return ReE(res, BAD_REQUEST_CODE, "status is required");

      if (!Object.values(TaskStatus).includes(status))
        return ReE(res, BAD_REQUEST_CODE, "Invalid task status");

      const task: any = await taskRepository.findById(Number(taskId));
      if (!task)
        return ReE(res, RESOURCE_NOT_FOUND, "Task not found");

      if (status === TaskStatus.DONE && !closing_message) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "closing_message is required when closing task"
        );
      }

      const plain = task?.toObject?.() ?? task;
      const progressEntry = {
        type: status,
        message:
          closing_message ||
          (status === TaskStatus.PARTIALLY_DONE
            ? "Task partially completed"
            : "Task updated"),
        updated_by: req.user.id,
        updated_at: new Date(),
      };

      const updatePayload: any = {
        status,
        progress: [...(plain.progress || []), progressEntry],
      };

      if (status === TaskStatus.DONE) {
        updatePayload.closing_message = closing_message;
        updatePayload.closing_date = closing_date || new Date();
      }

      const updated = await taskRepository.updateById(Number(taskId), { $set: updatePayload });

      const notificationMessage =
        status === TaskStatus.DONE
          ? "Task marked as completed"
          : status === TaskStatus.PARTIALLY_DONE
            ? "Task marked as partially completed"
            : "Task status updated";

      await notificationController.createNotification({
        userId: plain.user_id,
        message: notificationMessage,
        route: `/tasks/${plain.id}`,
        meta: { type: "TASK", taskId: plain.id, status },
      });

      return ReS(
        res,
        SUCCESS_CODE,
        "Task status updated successfully",
        updated
      );
    } catch (error) {
      console.error("Task Status Error:", error);
      return ReE(res, SERVER_ERROR_CODE, "Unable to update task status");
    }
  }
  async deleteTask(req: AuthenticatedRequest, res: Response) {
    try {
      const task: any = await taskRepository.findById(Number(req.params.id));
      if (!task) return ReE(res, RESOURCE_NOT_FOUND, "Task not found");
      const plain = task?.toObject?.() ?? task;
      const user:any = await userRepository.findOne(
        { id: req.user.id },
        { select: "id name", lean: true },
      );
 if(!user && req.user.role!==Roles.SUPER_ADMIN)
     return ReE(res,FORBIDDEN_CODE,"You are not authorized to delete this task");

      await taskRepository.deleteById(Number(req.params.id));

      await notificationController.createNotification({
        userId: plain.user_id,
        message: "Task deleted",
        route: "/tasks",
        meta: {
          type: "TASK", taskId: plain.id, role: req.user.role,
          senderName: req.user.name,
          assigneeName: user?.name || ''
        },
      });

      return ReS(res, SUCCESS_CODE, "Task deleted successfully");
    } catch(err) {
      console.log(err);
      
      return ReE(res, SERVER_ERROR_CODE, "Unable to delete task");
    }
  }
async getTasksByLoggedInUser(req: any, res: Response) {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      order_by = "created_at",
      order_direction = "DESC",
    } = req.body;

    const parsedPage = Math.max(Number(page), 1);
    const parsedLimit = Math.max(Number(limit), 1);
    const sortDir = order_direction === "ASC" ? 1 : -1;

    const filter: Record<string, unknown> = {
      user_id: req.user.id,
      ...(status && { status }),
      ...(type && { type }),
    };

    const { count, rows } = await taskRepository.findPaginated(filter, {
      page: parsedPage,
      limit: parsedLimit,
      sort: { [order_by]: sortDir } as Record<string, 1 | -1>,
      populate: taskPopulate,
    });

    return ReS(res, SUCCESS_CODE, "Tasks fetched successfully", {
      currentPage: parsedPage,
      totalPages: Math.ceil(count / parsedLimit),
      limit: parsedLimit,
      totalTasks: count,
      data: rows,
    });
  } catch (error) {
    console.error("getTasks error:", error);
    return ReE(res, SERVER_ERROR_CODE, "Unable to fetch tasks");
  }
}

}

export default new TaskController();
