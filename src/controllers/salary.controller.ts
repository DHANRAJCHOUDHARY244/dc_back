import { Response } from "express";
import { AuthenticatedRequest, DocumentsAuthenticatedRequest } from "@constants/common.interface";
import {
  BAD_REQUEST_CODE,
  NO_CONTENT,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import { Roles } from "src/data/dataInserter";
import { salaryRepository, userRepository } from "@repositories";
import { UploadedFile } from "express-fileupload";
import { sendEmail } from "@utils/email";
import { salarySlipEmailTemplate } from "@template/eventTemplate";
import { CreateSalaryBody } from "@constants/salary.constants";

class SalaryController {
  async saveBankDetails(req: AuthenticatedRequest, res: Response) {
    try {
      if (![Roles.ADMIN, Roles.SUPER_ADMIN].includes(req.user.role)) {
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized Access");
      }

      const { user_id: userId, bank_details } = req.body;
      if (!userId) {
        return ReE(res, BAD_REQUEST_CODE, "userId is required");
      }

      const user = await userRepository.findById(userId);
      if (!user) {
        return ReE(res, BAD_REQUEST_CODE, "User not found");
      }

      const updated = await userRepository.updateById(userId, { $set: { bank_details } });

      return ReS(res, SUCCESS_CODE, "Bank details saved successfully", updated);
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async createSalary(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      if (![Roles.ADMIN, Roles.SUPER_ADMIN].includes(req.user.role)) {
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized Access");
      }

      const {
        user_id,
        date,
        basic,
        bonus = 0,
        tds = 0,
        pf = 0,
        bank_details,
        email,
        employee_name,
        cc = [],
        bcc = [],
      } = req.body as CreateSalaryBody;

      if (!user_id || !date || !basic || !bank_details || !email) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "user_id, date, basic, bank_details and email are required",
        );
      }

      const d = new Date(date);
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const salaryMonth = `${d.getFullYear()}-${month}`;

      const exists = await salaryRepository.findOne({ user_id, salary_month: salaryMonth });

      if (exists) {
        return ReE(res, BAD_REQUEST_CODE, "Salary already exists for this month");
      }

      const parsedBankDetails =
        typeof bank_details === "string" ? JSON.parse(bank_details) : bank_details;

      if (!req.files || !req.files.salary_slip) {
        return ReE(res, BAD_REQUEST_CODE, "Salary slip PDF missing");
      }

      const salarySlipFile = req.files.salary_slip as UploadedFile;

      const salary = await salaryRepository.create({
        user_id,
        date,
        salary_month: salaryMonth,
        basic,
        bonus,
        tds,
        pf,
        creator_id: req.user.id,
        bank_details: parsedBankDetails,
      });

      const ccList: string[] = Array.isArray(cc)
        ? cc
        : cc
          ? cc.split(",").map((e) => e.trim())
          : [];

      const bccList: string[] = Array.isArray(bcc)
        ? bcc
        : bcc
          ? bcc.split(",").map((e) => e.trim())
          : [];

      await sendEmail(
        email,
        `Salary Slip – ${salaryMonth}`,
        salarySlipEmailTemplate(employee_name, salaryMonth),
        ccList,
        bccList,
        [
          {
            filename: `Salary_Slip_${salaryMonth}.pdf`,
            content: salarySlipFile.data,
            contentType: "application/pdf",
          },
        ],
      );

      return ReS(res, SUCCESS_CODE, "Salary created & salary slip emailed successfully", salary);
    } catch (error) {
      console.error("Create salary failed", error);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async getAllSalaries(req: AuthenticatedRequest, res: Response) {
    try {
      if (![Roles.ADMIN, Roles.SUPER_ADMIN].includes(req.user.role)) {
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized Access");
      }

      const { page = 1, limit = 10, user_id, month } = req.body;

      const filter: Record<string, unknown> = {};
      if (user_id) filter.user_id = user_id;
      if (month) filter.salary_month = month;

      const { rows, count } = await salaryRepository.findPaginated(filter, {
        populate: [
          { path: "user", select: "id name email bank_details profile_image" },
          { path: "creator", select: "id name" },
        ],
        sort: { date: -1 },
        page: Number(page),
        limit: Number(limit),
      });

      if (!rows.length) {
        return ReE(res, RESOURCE_NOT_FOUND, "No salary records found");
      }

      return ReS(res, SUCCESS_CODE, "Salaries fetched successfully", {
        totalItems: count,
        totalPages: Math.ceil(count / Number(limit)),
        currentPage: page,
        data: rows,
      });
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async getSalaryById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;

      const salary: any = await salaryRepository.findById(Number(id), {
        populate: [
          { path: "user", select: "id name email bank_details" },
          { path: "creator", select: "id name" },
        ],
      });

      if (!salary) {
        return ReE(res, NO_CONTENT, "Salary not found");
      }

      if (
        ![Roles.ADMIN, Roles.SUPER_ADMIN].includes(req.user.role) &&
        salary.user_id !== req.user.id
      ) {
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized Access");
      }

      return ReS(res, SUCCESS_CODE, "Salary fetched successfully", salary);
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async getMySalaries(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.body;

      const { rows, count } = await salaryRepository.findPaginated(
        { user_id: req.user.id },
        { sort: { date: -1 }, page: Number(page), limit: Number(limit) },
      );

      if (!rows.length) {
        return ReE(res, NO_CONTENT, "No salary records found");
      }

      return ReS(res, SUCCESS_CODE, "My salaries fetched successfully", {
        totalItems: count,
        totalPages: Math.ceil(count / Number(limit)),
        currentPage: page,
        data: rows,
      });
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async updateSalary(req: AuthenticatedRequest, res: Response) {
    try {
      if (![Roles.ADMIN, Roles.SUPER_ADMIN].includes(req.user.role)) {
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized Access");
      }

      const { id }: any = req.params;
      const { date, basic, bonus, tds, pf, bank_details } = req.body;

      const salary: any = await salaryRepository.findById(Number(id));
      if (!salary) {
        return ReE(res, NO_CONTENT, "Salary not found");
      }

      if (date) {
        const salaryMonth = new Date(date).toISOString().slice(0, 7);
        const duplicate = await salaryRepository.findOne({
          user_id: salary.user_id,
          salary_month: salaryMonth,
          id: { $ne: Number(id) },
        });

        if (duplicate) {
          return ReE(res, BAD_REQUEST_CODE, "Salary already exists for this month");
        }
      }

      const updated = await salaryRepository.updateById(Number(id), {
        $set: {
          date: date ?? salary.date,
          basic: basic ?? salary.basic,
          bonus: bonus ?? salary.bonus,
          tds: tds ?? salary.tds,
          pf: pf ?? salary.pf,
          bank_details: bank_details ?? salary.bank_details,
        },
      });

      return ReS(res, SUCCESS_CODE, "Salary updated successfully", updated);
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }

  async deleteSalary(req: AuthenticatedRequest, res: Response) {
    try {
      if (![Roles.ADMIN, Roles.SUPER_ADMIN].includes(req.user.role)) {
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized Access");
      }

      const { id }: any = req.params;
      const salary = await salaryRepository.findById(Number(id));

      if (!salary) {
        return ReE(res, NO_CONTENT, "Salary not found");
      }

      await salaryRepository.deleteById(Number(id));

      return ReS(res, SUCCESS_CODE, "Salary deleted successfully");
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, "Server error");
    }
  }
}

export default new SalaryController();
