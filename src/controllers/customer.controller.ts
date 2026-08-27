import {
  BAD_REQUEST_CODE,
  FORBIDDEN_CODE,
  NO_CONTENT,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import { generate_Hash_Password, ReE, ReS } from "@services/generalHelper.service";
import { Request, Response } from "express";
import authController from "./auth.controller";
import { PaginationInterface } from "@constants/pagination.interface";
import {
  contactFormRepository,
  invoiceRepository,
  quoteRepository,
  roleRepository,
  userRepository,
} from "@repositories";
import { AuthenticatedRequest } from "@constants/common.interface";
import userController from "./user.controller";
import { faker } from "@faker-js/faker";
import { UpdateCustomer } from "@constants/customer.interface";
import { Roles } from "src/data/dataInserter";

const customerQuotePopulate = [
  { path: "customer", select: "id name email profile_image" },
  { path: "sender", select: "id name email profile_image" },
];

const customerInvoicePopulate = [
  { path: "sender", select: "id name email profile_image" },
  {
    path: "quote",
    populate: { path: "customer", select: "id name email profile_image" },
  },
];

class CustomerController {
  async addNew(req: Request, res: Response) {
    try {
      req.body.is_signup = false;
      authController.register(req, res);
    } catch (error) {
      ReE(res, SERVER_ERROR_CODE, `Server Error:${error}`);
    }
  }
  async listCustomer(req: Request, res: Response) {
    try {
      const { limit = 10, page = 1 }: PaginationInterface = req.body;

      const role: any = await roleRepository.findOne(
        { name: Roles.CUSTOMER },
        { select: "id name label", lean: true },
      );

      if (!role) return ReE(res, NO_CONTENT, "Customer role not found");

      const { rows: customer, count: totalItems } = await userRepository.findPaginated(
        { role_id: role.id },
        {
          page,
          limit,
          select: "id name email username mobile_no is_active profile_image address",
          lean: true,
        },
      );
      if (!customer || customer.length === 0) {
        return ReE(res, NO_CONTENT, "No Customer found");
      }
      const customerWithRole = customer.map((user: any) => ({
        ...user,
        role: Roles.CUSTOMER
      }));

      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = page;

      return ReS(res, SUCCESS_CODE, "Customer fetched successfully", {
        totalItems,
        totalPages,
        currentPage,
        data: customerWithRole,
      });
    } catch (error) {
      console.error("Error fetching customers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async getCustomer(req: Request, res: Response) {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return ReE(res, FORBIDDEN_CODE, "userId is required");
      const userData: any = await userRepository.findOne(
        { id: userId },
        {
          // role_id must be selected or virtual populate("role") returns empty
          select:
            "username email city mobile_no mobile_country_code name is_active is_verified profile_image address id role_id must_change_password",
          populate: { path: "role", select: "id name" },
          lean: true,
        },
      );
      if (!userData) {
        return ReE(res, NO_CONTENT, "No customers found");
      }
      if (!userData?.profile_image) userData.profile_image = faker.image.avatarGitHub();
      else userData.avatar = userData?.profile_image;

      const roleName =
        typeof userData.role === "string"
          ? userData.role
          : userData?.role?.name ?? null;

      return ReS(res, SUCCESS_CODE, "customers fetched successfully", {
        ...userData,
        role_id: userData?.role?.id ?? userData.role_id ?? null,
        role: roleName,
        avatar: userData.avatar || userData.profile_image || null,
      });
    } catch (error) {
      console.error("Error fetching customers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async deleteCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      await userController.deleteUser(req, res);
    } catch (error) {
      console.error("Error deleting customers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updateCustomerProfileImage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return ReE(res, FORBIDDEN_CODE, "userId is required");
      const roleDoc: any = await roleRepository.findOne(
        { name: Roles.CUSTOMER },
        { select: "id", lean: true }
      );
      if (!roleDoc) return ReE(res, FORBIDDEN_CODE, "Role is not present");
      const userData = await userRepository.findOne(
        { id: userId, role_id: roleDoc.id },
        { lean: true },
      );
      if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found");
      req.user = userData;
      await userController.updateProfileImage(req, res);

    } catch (error) {
      console.error("Error deleting customers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updateCustomerPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: userId, new_password } = req.body;

      const userData = await userRepository.findOne(
        { id: userId },
        { lean: true },
      );
      if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found");
      if (!new_password)
        return ReE(res, BAD_REQUEST_CODE, "New password is required");
      const hashedPassword = await generate_Hash_Password(new_password);
      await userRepository.updateMany(
        { id: userId },
        { $set: { password: hashedPassword, must_change_password: false } },
      );
      return ReS(res, SUCCESS_CODE, "Reset successfully.",);
    } catch (error) {
      console.error("Error in updateCustomerPassword:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updateCustomerDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const updatedData: UpdateCustomer = req.body;
      const userData: any = await userRepository.findOne(
        { id: userId },
        { lean: true },
      );
      if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found");
      const payload: any = { ...updatedData };
      delete payload.password;
      delete payload.id;
      delete payload._id;
      if (payload.role) {
        const role_name = Roles[payload.role as keyof typeof Roles];
        if (!role_name) return ReE(res, BAD_REQUEST_CODE, "Invalid role");
        const role: any = await roleRepository.findOne(
          { name: role_name },
          { select: "id", lean: true },
        );
        if (!role) return ReE(res, BAD_REQUEST_CODE, "Role not found");
        payload.role_id = role.id;
        delete payload.role;
      }
      await userRepository.updateMany({ id: userId }, { $set: payload });
      const updated: any = await userRepository.findOne(
        { id: userId },
        {
          populate: { path: "role", select: "id name" },
          select: "-password -otp -otp_verification_token -bank_details -deleted_at",
          lean: true,
        },
      );
      const { role, ...rest } = updated || {};
      return ReS(res, SUCCESS_CODE, "User Updated Successfully", {
        ...rest,
        role_id: role?.id ?? rest.role_id ?? null,
        role: role?.name ?? null,
        avatar: rest.profile_image || null,
      });
    } catch (error) {
      console.error("Error in updateCustomerDetails:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async autocompleteCustomerByNameEmail(req: AuthenticatedRequest, res: Response) {
    try {
      const billTo = (req.body?.billTo ?? req.query?.billTo) as string | undefined;
      const billToEmail = (req.body?.billToEmail ?? req.query?.billToEmail) as string | undefined;
      if (!billTo && !billToEmail) return ReS(res, SUCCESS_CODE, "Customers fetched successfully", []);
      const role: any = await roleRepository.findOne(
        { name: Roles.CUSTOMER },
        { select: "id", lean: true },
      );
      if (!role) return ReE(res, BAD_REQUEST_CODE, "Customer role not found");
      const orConditions: Record<string, unknown>[] = [];
      if (billToEmail?.trim()) {
        orConditions.push({ email: { $regex: billToEmail.trim(), $options: "i" } });
      }
      if (billTo?.trim()) {
        orConditions.push({ name: { $regex: billTo.trim(), $options: "i" } });
      }
      const customers = await userRepository.find(
        {
          role_id: role.id,
          $or: orConditions,
        },
        {
          select: "name email",
          sort: { name: 1 },
          limit: 10,
          lean: true,
        },
      );

      return ReS(res, SUCCESS_CODE, "Customers fetched successfully", customers);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
  async searchCustomers(req: Request, res: Response) {
    try {
      const { q = "", limit = "10" } = req.query as { q?: string; limit?: string };
      const query = decodeURIComponent(q);
      const parsedLimit = parseInt(limit);
      const searchTerm = query.toLowerCase();

      const customer = await userRepository.find(
        {
          $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { email: { $regex: searchTerm, $options: "i" } },
            { username: { $regex: searchTerm, $options: "i" } },
          ],
        },
        {
          select: "id name email username address mobile_no",
          limit: parsedLimit,
          lean: true,
        },
      );

      if (!customer.length) 
        return ReS(res, SUCCESS_CODE, "No matching customer found",[]);

      return ReS(res, SUCCESS_CODE, "Customer found", customer.map((c: any) => ({
        ...c,
        role: Roles.CUSTOMER,
      })));
    } catch (error) {
      console.error("Error searching customer:", error);
      return ReE(res, SERVER_ERROR_CODE, "Internal server error");
    }
  }
  async searchCustomersWithBankDetails(req: Request, res: Response) {
    try {
      const { q = "", limit = "10" } = req.query as { q?: string; limit?: string };
      const query = decodeURIComponent(q);
      const parsedLimit = parseInt(limit);
      const searchTerm = query.toLowerCase();

      const customer = await userRepository.find(
        {
          $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { email: { $regex: searchTerm, $options: "i" } },
            { username: { $regex: searchTerm, $options: "i" } },
          ],
        },
        {
          select: "id name email username address mobile_no bank_details",
          limit: parsedLimit,
          lean: true,
        },
      );

      if (!customer.length) 
        return ReS(res, SUCCESS_CODE, "No matching customer found",[]);

      return ReS(res, SUCCESS_CODE, "Customer found", customer.map((c: any) => ({
        ...c,
        role: Roles.CUSTOMER,
      })));
    } catch (error) {
      console.error("Error searching customer:", error);
      return ReE(res, SERVER_ERROR_CODE, "Internal server error");
    }
  }
  async getMetricsAnalysis(req: Request, res: Response) {
    try {
      const customerRole: any = await roleRepository.findOne({ name: "CUSTOMER" }, { lean: true });

      if (!customerRole) {
        return ReE(res, NO_CONTENT, "Customer role not found");
      }

      const customerRoleId = customerRole.id;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        totalCustomers,
        newCustomers,
        activeCustomers,
        inactiveCustomers,
        verified,
        unverified,
        recentCustomers,
      ] = await Promise.all([
        userRepository.count({ role_id: customerRoleId }),

        userRepository.count({
          role_id: customerRoleId,
          created_at: { $gte: startOfMonth },
        }),

        userRepository.count({ role_id: customerRoleId, is_active: true }),
        userRepository.count({ role_id: customerRoleId, is_active: false }),
        userRepository.count({ role_id: customerRoleId, is_verified: true }),
        userRepository.count({ role_id: customerRoleId, is_verified: false }),
        userRepository.find(
          { role_id: customerRoleId },
          {
            sort: { created_at: -1 },
            limit: 10,
            select: "id name email created_at profile_image",
          },
        ),
      ]);

      return ReS(res, SUCCESS_CODE, "Metrics analysis fetched successfully", {
        totalCustomers,
        newCustomers,
        activeCustomers,
        inactiveCustomers,
        verified,
        unverified,
        recentCustomers,
      });

    } catch (error) {
      console.error("Analytics Error:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async getCustomerQuotesWithPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { limit = 10, page = 1, sort_by = "created_at", sort_order = "DESC",user_id=null } = req.body;
      const userId = user_id??req.user.id;
      const { rows: quotes, count: totalItems } = await quoteRepository.findPaginated(
        {
          $or: [{ customer_id: userId }, { sender_id: userId }],
        },
        {
          page: Number(page),
          limit: Number(limit),
          sort: { [sort_by]: sort_order === "DESC" ? -1 : 1 },
          populate: customerQuotePopulate,
        },
      );
      if (!quotes || quotes.length === 0) {
        return ReE(res, NO_CONTENT, "No quotes found for this customer");
      }
      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = page;
      return ReS(res, SUCCESS_CODE, "Quotes fetched successfully", {
        totalItems,
        totalPages,
        currentPage,
        data: quotes,
      });
    } catch (error) {
      console.error("Error fetching customer quotes:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async getCustomerInvoiceWIthPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { limit = 10, page = 1, sort_by = "created_at", sort_order = "DESC",user_id = null } = req.body;
      const userId = user_id??req.user.id;
      const quotesId: any = await quoteRepository.find(
        {
          $or: [{ customer_id: userId }, { sender_id: userId }],
        },
        { select: "id", lean: true },
      );
      if (!quotesId || quotesId.length === 0) {
        return ReE(res, NO_CONTENT, "No invoices found for this customer");
      }
      const { rows: invoices, count: totalItems } = await invoiceRepository.findPaginated(
        { quote_id: { $in: quotesId.map((q: any) => q.id) } },
        {
          page: Number(page),
          limit: Number(limit),
          sort: { [sort_by]: sort_order === "DESC" ? -1 : 1 },
          populate: customerInvoicePopulate,
        },
      );
      if (!invoices || invoices.length === 0) {
        return ReE(res, NO_CONTENT, "No invoices found for this customer");
      }
      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = page;
      return ReS(res, SUCCESS_CODE, "Invoices fetched successfully", {
        totalItems,
        totalPages,
        currentPage,
        data: invoices,
      });
    } catch (error) {
      console.error("Error fetching customer invoices:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async getCustomerByCfId(req: AuthenticatedRequest, res: Response){
    try {
      const cf_id = Number(req.query.cf_id);
      if (!cf_id) return ReE(res, BAD_REQUEST_CODE, "cf_id is required");
      const cfData:any = await contactFormRepository.findById(cf_id, { lean: true });
      if (!cfData) return ReE(res, NO_CONTENT, "Contact form not found");
      const custData = await userRepository.findOne(
        { email: cfData.email },
        { select: "id email name", lean: true },
      );
      if(!custData)
        return ReE(res, NO_CONTENT,"NO user Found");
      return ReS(res, SUCCESS_CODE, "Invoices fetched successfully", {
        user:custData,
        cf:cfData
      });
    } catch (error) {
      console.error("Error fetching customer data:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
}
export default new CustomerController()
