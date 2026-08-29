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
import { quoteRepository, roleRepository, userRepository } from "@repositories";
import { AuthenticatedRequest } from "@constants/common.interface";
import userController from "./user.controller";
import { faker } from "@faker-js/faker";
import { UpdateInstaller } from "@constants/installer.interface";
import { resolveRoleIdFromInput } from "@services/roleResolver.service";
import { Roles } from "src/data/dataInserter";

class InstallerController {
  async addNew(req: Request, res: Response) {
    try {
      req.body.is_signup = false;
      await authController.register(req, res);
    } catch (error) {
      ReE(res, SERVER_ERROR_CODE, `Server Error:${error}`);
    }
  }
  async listInstaller(req: Request, res: Response) {
    try {
      const { limit = 10, page = 1 }: PaginationInterface = req.body;

      const role: any = await roleRepository.findOne(
        { name: Roles.INSTALLER },
        { select: "id name label", lean: true },
      );

      if (!role) return ReE(res, NO_CONTENT, "Installer role not found");

      const { rows: installers, count: totalItems } = await userRepository.findPaginated(
        { role_id: role.id },
        {
          page,
          limit,
          select: "id name email username mobile_no is_active profile_image",
          lean: true,
        },
      );
      if (!installers || installers.length === 0) {
        return ReE(res, NO_CONTENT, "No installers found");
      }
      const installersWithRole = installers.map((user: any) => ({
        ...user,
        role: Roles.INSTALLER
      }));

      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = page;

      return ReS(res, SUCCESS_CODE, "Installers fetched successfully", {
        totalItems,
        totalPages,
        currentPage,
        data: installersWithRole,
      });
    } catch (error) {
      console.error("Error fetching installers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async searchInstallers(req: Request, res: Response) {
    try {
      const { q = "", limit = "10" } = req.query as { q?: string; limit?: string };
      const query = decodeURIComponent(q);
      const parsedLimit = parseInt(limit);

      const role: any = await roleRepository.findOne(
        { name: Roles.INSTALLER },
        { select: "id", lean: true },
      );

      if (!role) return ReE(res, NO_CONTENT, "Installer role not found");

      const searchTerm = query.toLowerCase();

      const installers = await userRepository.find(
        {
          role_id: role.id,
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

      if (!installers.length) 
        return ReS(res, SUCCESS_CODE, "No matching installers found",[]);

      return ReS(res, SUCCESS_CODE, "Installers found", installers.map((installer: any) => ({
        ...installer,
        role: Roles.INSTALLER,
      })));
    } catch (error) {
      console.error("Error searching installers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Internal server error");
    }
  }
  async getInstaller(req: Request, res: Response) {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return ReE(res, FORBIDDEN_CODE, "userId is required");
      const userData: any = await userRepository.findOne(
        { id: userId },
        {
          select: "username email city mobile_no mobile_country_code name is_active profile_image address id",
          lean: true,
        },
      );
      if (!userData) {
        return ReE(res, NO_CONTENT, "No installer found");
      }
      if (!userData?.profile_image) userData.profile_image = faker.image.avatarGitHub();
      else userData.avatar = userData?.profile_image;

      return ReS(res, SUCCESS_CODE, "Installers fetched successfully", { ...userData, role: Roles.INSTALLER });
    } catch (error) {
      console.error("Error fetching installers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async deleteInstaller(req: AuthenticatedRequest, res: Response) {
    try {
      await userController.deleteUser(req, res);
    } catch (error) {
      console.error("Error deleting installers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updateInstallerProfileImage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return ReE(res, FORBIDDEN_CODE, "userId is required");
      const roleDoc: any = await roleRepository.findOne(
        { name: Roles.INSTALLER },
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
      console.error("Error deleting installers:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updateInstallerPassword(req: AuthenticatedRequest, res: Response) {
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
      console.error("Error in updateInstallerPassword:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updateInstallerDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const updatedData: UpdateInstaller = req.body;
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
        try {
          payload.role_id = await resolveRoleIdFromInput(payload.role);
        } catch {
          return ReE(res, BAD_REQUEST_CODE, "Invalid role — role not found in database");
        }
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
      console.error("Error in updateInstallerDetails:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async getMetricsAnalysis(req: AuthenticatedRequest, res: Response) {
    try {
      const installerRole:any= await roleRepository.findOne({ name: "INSTALLER" }, { lean: true });
       if (!installerRole) {
        return ReE(res, NO_CONTENT, "Installer role not found");
      }
      const installerId = installerRole.id;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [
        totalInstallers,
        newInstallers,
        activeInstallers,
        inactiveInstallers,
        verified,
        unverified,
        recentInstallers,
      ] = await Promise.all([
        userRepository.count({ role_id: installerId }),

        userRepository.count({
          role_id: installerId,
          created_at: { $gte: startOfMonth },
        }),

        userRepository.count({ role_id: installerId, is_active: true }),
        userRepository.count({ role_id: installerId, is_active: false }),
        userRepository.count({ role_id: installerId, is_verified: true }),
        userRepository.count({ role_id: installerId, is_verified: false }),
        userRepository.find(
          { role_id: installerId },
          {
            sort: { created_at: -1 },
            limit: 10,
            select: "id name email created_at profile_image",
          },
        ),
      ]);

      return ReS(res, SUCCESS_CODE, "Metrics analysis fetched successfully", {
        totalInstallers,
        newInstallers,
        activeInstallers,
        inactiveInstallers,
        verified,
        unverified,
        recentInstallers,
      });
    } catch (error) {
      console.error("Analytics Error:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
}
export default new InstallerController()
