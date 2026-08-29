import {
    BAD_REQUEST_CODE,
    FORBIDDEN_CODE,
    NO_CONTENT,
    SERVER_ERROR_CODE,
    SUCCESS_CODE,
} from "@constants/serverCode";
import { compare_Hash_Password, generate_Hash_Password, ReE, ReS } from "@services/generalHelper.service";
import {  Response } from "express";
import {
    invoiceRepository,
    quoteRepository,
    roleRepository,
    userRepository,
} from "@repositories";
import { AuthenticatedRequest } from "@constants/common.interface";
import { fileUpload } from 'express-fileupload';
import { Roles } from "src/data/dataInserter";
import { getRelativeFilePath, uploadFiles } from "@utils/fileUpload.helper";
import { UploadCategory } from "@constants/common.enum";
import { isProtectedSuperAdminEmail } from "@config/protectedUsers.config";

const invoicePopulate = [
  { path: "sender", select: "id name email profile_image" },
  {
    path: "quote",
    populate: { path: "customer", select: "id name email profile_image" },
  },
];

class UserController {
    async deleteUser(req: AuthenticatedRequest, res: Response) {
        try {
            const { user } = req;
            if (isProtectedSuperAdminEmail(user?.email)) {
              return ReE(res, BAD_REQUEST_CODE, "This system owner account cannot be removed");
            }
            if (Roles.SUPER_ADMIN === user.role) return ReE(res, BAD_REQUEST_CODE, "Super Admin role cannot be deleted");

            let roleDoc: any = null;
            if (user.role_id) {
              roleDoc = await roleRepository.findOne({ id: user.role_id }, { select: "id name", lean: true });
            } else if (user.role) {
              roleDoc = await roleRepository.findOne(
                { name: Roles[user.role as string] || user.role },
                { select: "id name", lean: true },
              );
            }
            if (!roleDoc) return ReE(res, FORBIDDEN_CODE, "Role is not present");
            if (roleDoc.name === Roles.SUPER_ADMIN) {
              return ReE(res, BAD_REQUEST_CODE, "Super Admin role cannot be deleted");
            }
            const userData = await userRepository.findOne(
                { id: user.id, role_id: roleDoc.id },
                { lean: true },
            );
            if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found To Remove");
            await userRepository.deleteById(user.id);
          return ReS(res,SUCCESS_CODE,"User deleted Successfully");
        } catch (error) {
            console.error("Error deleting users:", error);
            return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
        }
    }
     async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const { user } = req;
      const {
        name,
        phone,
        mobile_no,
        address,
        city,
        about,
        is_active,
        active_crm_company_unit_id,
        default_crm_company_unit_id,
      } = req.body;

      const $set: Record<string, unknown> = {
        name,
        mobile_no: phone ?? mobile_no,
        address,
        city,
        about,
        is_active,
      };
      if (isProtectedSuperAdminEmail(user.email)) {
        $set.is_active = true;
      }
      if (active_crm_company_unit_id !== undefined) {
        $set.active_crm_company_unit_id = active_crm_company_unit_id;
      }
      if (default_crm_company_unit_id !== undefined) {
        $set.default_crm_company_unit_id = default_crm_company_unit_id;
      }

      await userRepository.updateMany({ id: user.id }, { $set });

      const updatedUser = await userRepository.findById(user.id, {
        select:
          "id name email mobile_no address city profile_image is_active active_crm_company_unit_id default_crm_company_unit_id",
      });

      return ReS(res, SUCCESS_CODE, "Profile updated successfully", updatedUser);
    } catch (error) {
      console.error("Update profile error:", error);
      return ReE(res, SERVER_ERROR_CODE, "Failed to update profile");
    }
  }
     async updateProfileImage(req: AuthenticatedRequest, res: Response) {
    try {
       const files = req.files as fileUpload.FileArray;
       const { user } = req;
      if (!files?.files)
        return ReE(res, FORBIDDEN_CODE, "No file uploaded.");
      const file = files.files as fileUpload.UploadedFile;
      const existing: any = await userRepository.findById(user.id, {
        select: "id profile_image",
        lean: true,
      });
      const oldPath = existing?.profile_image
        ? getRelativeFilePath(existing.profile_image)
        : null;
      const uploaded = await uploadFiles({
      category: UploadCategory.USER_PROFILE,
      files: file,
      entityId: user.id,
      deleteOldPaths: oldPath ? [oldPath] : [],
      allowedTypes: [],
      maxSizeMB: 5,
    });
    
      await userRepository.updateMany(
        { id: user.id },
        { $set: { profile_image: uploaded.url } },
      );
      return ReS(res, SUCCESS_CODE, "Profile image updated successfully", {
        profile_image: uploaded.url,
        avatar: uploaded.url,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
   async getUserQuotesWithPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { limit = 10, page = 1, sort_by = "created_at", sort_order = "DESC",user_id=null } = req.body;
      const userId = user_id??req.user.id;
      const whereCondition: any = { customer_id: userId };
      switch (req.user.role) {
        case Roles.CUSTOMER:
          whereCondition.customer_id = userId;
          break;
        case Roles.INSTALLER:
          return ReE(res, FORBIDDEN_CODE, "Installers cannot access customer quotes");
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          delete whereCondition.customer_id;
          whereCondition.sender_id = userId;
          break;
        default:
          return ReE(res, FORBIDDEN_CODE, "Unauthorized access to customer quotes");
      }
      const { rows: quotes, count: totalItems } = await quoteRepository.findPaginated(
        { ...whereCondition },
        {
          page: Number(page),
          limit: Number(limit),
          sort: { [sort_by]: sort_order === "DESC" ? -1 : 1 },
          populate: [
            { path: "customer", select: "id name email profile_image" },
            { path: "sender", select: "id name email profile_image" },
          ],
        },
      );
      if (!quotes || quotes.length === 0) {
        return ReE(res, NO_CONTENT, "No quotes found for this"+`${req.user.role}`);
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
   async getUserInvoiceWIthPagination(req: AuthenticatedRequest, res: Response) {
    try {
      const { limit = 10, page = 1, sort_by = "created_at", sort_order = "DESC",user_id = null } = req.body;
       const userId = user_id??req.user.id;
      const whereCondition: any = { customer_id: userId };
      switch (req.user.role) {
        case Roles.CUSTOMER:
          whereCondition.customer_id = userId;
          break;
        case Roles.INSTALLER:
          return ReE(res, FORBIDDEN_CODE, "Installers cannot access customer quotes");
        case Roles.SUPER_ADMIN:
        case Roles.ADMIN:
          delete whereCondition.customer_id;
          whereCondition.sender_id = userId;
          break;
        default:
          return ReE(res, FORBIDDEN_CODE, "Unauthorized access to customer quotes");
      }
      const quotesId: any = await quoteRepository.find(
        { ...whereCondition },
        { select: "id", lean: true },
      );
      if (!quotesId || quotesId.length === 0) {
        return ReE(res, NO_CONTENT, "No invoices found for this"+`${req?.user?.role} ${req?.user?.email}`);
      }
      const { rows: invoices, count: totalItems } = await invoiceRepository.findPaginated(
        { quote_id: { $in: quotesId.map((q: any) => q.id) } },
        {
          page: Number(page),
          limit: Number(limit),
          sort: { [sort_by]: sort_order === "DESC" ? -1 : 1 },
          populate: invoicePopulate,
        },
      );
      if (!invoices || invoices.length === 0) {
        return ReE(res, NO_CONTENT, "No invoices found for this"+`${req?.user?.role} ${req?.user?.email}`);
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
   async updatePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const {user}=req;
      const { new_password, old_password } = req.body;

      const userData = await userRepository.findOne(
        { id: user.id },
        { lean: true },
      );
      if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found");
      if (!new_password)
        return ReE(res, BAD_REQUEST_CODE, "New password is required");
      if (String(new_password).length < 8)
        return ReE(res, BAD_REQUEST_CODE, "Password must be at least 8 characters");
      // Force-change flow (must_change_password) may omit old password; otherwise require it
      if (!userData.must_change_password) {
        if (!old_password)
          return ReE(res, BAD_REQUEST_CODE, "Old password is required");
        const isMatch = await compare_Hash_Password(old_password, userData.password);
        if (!isMatch) return ReE(res, FORBIDDEN_CODE, "Old Password is incorrect");
      }
      const hashedPassword = await generate_Hash_Password(new_password);
      await userRepository.updateMany(
        { id: user.id },
        { $set: { password: hashedPassword, must_change_password: false } },
      );
      const updated: any = await userRepository.findById(user.id, {
        select: "-password -otp -otp_verification_token -bank_details",
        lean: true,
      });
      return ReS(res, SUCCESS_CODE, "Password updated successfully.", {
        id: updated?.id,
        must_change_password: false,
        profile_image: updated?.profile_image || null,
        avatar: updated?.profile_image || null,
      });
    } catch (error) {
      console.error("Error in updateCustomerPassword:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
}
export default new UserController()
