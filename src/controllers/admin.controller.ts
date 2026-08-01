/* =========================================================
   ADMIN PANEL – ALL IN ONE FILE
   (Controller + Helpers + Registry + Dashboard)
========================================================= */

import {
  BAD_REQUEST_CODE,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";

import { Request, Response } from "express";
import { ReE, ReS, generate_Hash_Password } from "@services/generalHelper.service";
import { AuthenticatedRequest } from "@constants/common.interface";
import { Roles } from "src/data/dataInserter";
import {
  userRepository,
  roleRepository,
  quoteRepository,
  invoiceRepository,
  customInvoiceRepository,
  taskRepository,
  salaryRepository,
  expenseRepository,
  documentRepository,
  stockOrderRepository,
} from "@repositories";

import authController from "./auth.controller";
import userController from "./user.controller";

const parsePagination = (body: any) => {
  const limit = Math.max(Number(body.limit) || 10, 1);
  const page = Math.max(Number(body.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};

const parseSorting = (body: any) => {
  const sort_by = body.sort_by || "created_at";
  const sort_order = body.sort_order === "ASC" ? 1 : -1;
  return { [sort_by]: sort_order as 1 | -1 };
};

const resolveRoleId = async (role?: keyof typeof Roles) => {
  if (!role) return null;
  const roleName = Roles[role];
  const roleData: any = await roleRepository.findOne({ name: roleName });
  if (!roleData) throw new Error("INVALID_ROLE");
  return roleData.id;
};

const ENTITY_REGISTRY: Record<string, { repo: any; userKeys: string[] }> = {
  users: { repo: userRepository, userKeys: ["id"] },
  quotes: { repo: quoteRepository, userKeys: ["customer_id", "sender_id"] },
  invoices: { repo: invoiceRepository, userKeys: ["sender_id"] },
  customInvoices: { repo: customInvoiceRepository, userKeys: ["customer_id", "sender_id"] },
  tasks: { repo: taskRepository, userKeys: ["user_id", "created_by"] },
  salaries: { repo: salaryRepository, userKeys: ["user_id", "creator_id"] },
  expenses: { repo: expenseRepository, userKeys: ["created_by"] },
  stocks: { repo: stockOrderRepository, userKeys: ["sender_id"] },
  documents: { repo: documentRepository, userKeys: ["user_id", "uploader_id"] },
};

const fetchEntityList = async ({
  entity,
  userId,
  limit,
  page,
  sort,
  extraWhere = {},
}: any) => {
  const config = ENTITY_REGISTRY[entity];
  if (!config) throw new Error("INVALID_ENTITY");

  const filter: Record<string, unknown> = { ...extraWhere };

  if (userId) {
    filter.$or = config.userKeys.map((key: string) => ({ [key]: userId }));
  }

  return config.repo.findPaginated(filter, { limit, page, sort });
};

class AdminPanelController {
  async createUser(req: Request, res: Response) {
    try {
      req.body.is_signup = false;
      return authController.register(req, res);
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "User creation failed");
    }
  }

  async listUsers(req: Request, res: Response) {
    try {
      const {
        role = null,
        is_active = null,
        is_verified = null,
        created_from = null,
        created_to = null,
        search = null,
        city = null,
        mobile_no = null,
      } = req.body;

      const { limit, page } = parsePagination(req.body);
      const filter: Record<string, unknown> = {};

      if (role) {
        const roleId = await resolveRoleId(role);
        if (!roleId) return ReE(res, BAD_REQUEST_CODE, "Invalid role");
        filter.role_id = roleId;
      }

      if (is_active !== null) filter.is_active = Boolean(is_active);
      if (is_verified !== null) filter.is_verified = Boolean(is_verified);

      if (created_from || created_to) {
        filter.created_at = {};
        if (created_from) (filter.created_at as any).$gte = new Date(created_from);
        if (created_to) (filter.created_at as any).$lte = new Date(created_to);
      }

      if (city) filter.city = city;
      if (mobile_no) filter.mobile_no = mobile_no;

      if (search) {
        const q = String(search);
        filter.$or = [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { username: { $regex: q, $options: "i" } },
        ];
      }

      const { rows, count } = await userRepository.findPaginated(filter, {
        limit,
        page,
        sort: { created_at: -1 },
        populate: { path: "role", select: "id name" },
        select: "-password -otp -otp_verification_token -bank_details -deleted_at",
        lean: true,
      });

      if (!rows.length) {
        return ReS(res, SUCCESS_CODE, "No users found", []);
      }

      const mappedUsers = rows.map((user: any) => {
        const { role, ...rest } = user;
        return {
          ...rest,
          role_id: role?.id ?? null,
          role: role?.name ?? null,
        };
      });

      return ReS(res, SUCCESS_CODE, "Users fetched successfully", {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        data: mappedUsers,
      });
    } catch (err: any) {
      console.error("listUsers error:", err);
      return ReE(res, BAD_REQUEST_CODE, err.message);
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const payload = { ...req.body };
      delete payload.password;

      if (payload.role) {
        payload.role_id = await resolveRoleId(payload.role);
        delete payload.role;
      }

      await userRepository.updateById(userId, { $set: payload });
      return ReS(res, SUCCESS_CODE, "User updated successfully");
    } catch (err: any) {
      return ReE(res, BAD_REQUEST_CODE, err.message);
    }
  }

  async updateUserPassword(req: Request, res: Response) {
    try {
      const { id, new_password } = req.body;
      if (!new_password) return ReE(res, BAD_REQUEST_CODE, "Password required");

      const password = await generate_Hash_Password(new_password);
      await userRepository.updateById(Number(id), { $set: { password } });

      return ReS(res, SUCCESS_CODE, "Password updated");
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Password update failed");
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId }: any = req.params;
      const userData = await userRepository.findById(Number(userId), { lean: true });
      if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found");
      req.user = userData;
      return userController.deleteUser(req, res);
    } catch (error) {
      console.error("Error deleting user:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }

  async updateCustomerProfileImage(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId }: any = req.params;
      const userData = await userRepository.findById(Number(userId), { lean: true });
      if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found");
      req.user = userData;
      await userController.updateProfileImage(req, res);
    } catch (error) {
      console.error("Error profile image update of user:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }

  async searchUsers(req: Request, res: Response) {
    try {
      const q = String(req.query.q || "");

      const users = await userRepository.find(
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { username: { $regex: q, $options: "i" } },
          ],
        },
        { limit: Number(req.query.limit) || 10 },
      );

      return ReS(res, SUCCESS_CODE, "Users found", users);
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Search failed");
    }
  }

  async entityList(req: Request, res: Response) {
    try {
      const { entity, user_id } = req.body;
      const { limit, page } = parsePagination(req.body);
      const sort = parseSorting(req.body);

      const result = await fetchEntityList({
        entity,
        userId: user_id,
        limit,
        page,
        sort,
      });

      if (!result.rows.length) return ReS(res, SUCCESS_CODE, "No records found");

      return ReS(res, SUCCESS_CODE, "Fetched successfully", {
        totalItems: result.count,
        totalPages: Math.ceil(result.count / limit),
        currentPage: page,
        data: result.rows,
      });
    } catch (err: any) {
      return ReE(res, BAD_REQUEST_CODE, err.message);
    }
  }

  async dashboard(_req: AuthenticatedRequest, res: Response) {
    try {
      const [users, quotes, invoices, tasks, expenseAgg, salaries, stocks] =
        await Promise.all([
          userRepository.count(),
          quoteRepository.count(),
          invoiceRepository.count(),
          taskRepository.count({ status: "PENDING" }),
          expenseRepository.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]),
          salaryRepository.count(),
          stockOrderRepository.count(),
        ]);

      const totalExpenses = Number((expenseAgg[0] as any)?.total) || 0;

      return ReS(res, SUCCESS_CODE, "Dashboard loaded", {
        cards: {
          users,
          quotes,
          invoices,
          pendingTasks: tasks,
          totalExpenses,
          salaries,
          stockOrders: stocks,
        },
      });
    } catch {
      return ReE(res, SERVER_ERROR_CODE, "Dashboard failed");
    }
  }
}

export default new AdminPanelController();
