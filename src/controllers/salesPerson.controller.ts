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
import { Roles } from "src/data/dataInserter";
import { UpdatesalesPeron } from "@constants/salesPeron.interface";

class SalesPersonController {
  async addNew(req: Request, res: Response) {
    try {
      req.body.is_signup = false;
      authController.register(req, res);
    } catch (error) {
      ReE(res, SERVER_ERROR_CODE, `Server Error:${error}`);
    }
  }
  async listSalesPeron(req: Request, res: Response) {
    try {
      const { limit = 10, page = 1 }: PaginationInterface = req.body;

      const role: any = await roleRepository.findOne(
        { name: Roles.SALES_PERSON },
        { select: "id name label", lean: true },
      );

      if (!role) return ReE(res, NO_CONTENT, "Sales peron role not found");

      const { rows: salesPerons, count: totalItems } = await userRepository.findPaginated(
        { role_id: role.id },
        {
          page,
          limit,
          select: "id name email username mobile_no is_active profile_image",
          lean: true,
        },
      );
      if (!salesPerons || salesPerons.length === 0) {
        return ReE(res, NO_CONTENT, "No salesPerons found");
      }
      const salesPeronsWithRole = salesPerons.map((user: any) => ({
        ...user,
        role: Roles.SALES_PERSON
      }));

      const totalPages = Math.ceil(totalItems / limit);
      const currentPage = page;

      return ReS(res, SUCCESS_CODE, "salesPerons fetched successfully", {
        totalItems,
        totalPages,
        currentPage,
        data: salesPeronsWithRole,
      });
    } catch (error) {
      console.error("Error fetching salesPerons:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async searchSalesPerons(req: Request, res: Response) {
    try {
      const { q = "", limit = "10" } = req.query as { q?: string; limit?: string };
      const query = decodeURIComponent(q);
      const parsedLimit = parseInt(limit);

      const role: any = await roleRepository.findOne(
        { name: Roles.SALES_PERSON},
        { select: "id", lean: true },
      );

      if (!role) return ReE(res, NO_CONTENT, "salesPerons role not found");

      const searchTerm = query.toLowerCase();

      const salesPerons = await userRepository.find(
        {
          role_id: role.id,
          $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { email: { $regex: searchTerm, $options: "i" } },
            { username: { $regex: searchTerm, $options: "i" } },
          ],
        },
        {
          select: "id name email username",
          limit: parsedLimit,
          lean: true,
        },
      );

      if (!salesPerons.length) 
        return ReS(res, SUCCESS_CODE, "No matching salesPerons found",[]);

      return ReS(res, SUCCESS_CODE, "salesPerons found", salesPerons.map((salesPeron: any) => ({
        ...salesPeron,
        role: Roles.SALES_PERSON,
      })));
    } catch (error) {
      console.error("Error searching salesPerons:", error);
      return ReE(res, SERVER_ERROR_CODE, "Internal server error");
    }
  }
  async getsalesPeron(req: Request, res: Response) {
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
        return ReE(res, NO_CONTENT, "No salesPerons found");
      }
      if (!userData?.profile_image) userData.profile_image = faker.image.avatarGitHub();
      else userData.avatar = userData?.profile_image;

      return ReS(res, SUCCESS_CODE, "salesPeron fetched successfully", { ...userData, role: Roles.SALES_PERSON });
    } catch (error) {
      console.error("Error fetching salesPeron:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async deletesalesPeron(req: AuthenticatedRequest, res: Response) {
    try {
      await userController.deleteUser(req, res);
    } catch (error) {
      console.error("Error deleting salesPeron:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updatesalesPeronProfileImage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return ReE(res, FORBIDDEN_CODE, "userId is required");
      const roleDoc: any = await roleRepository.findOne(
        { name: Roles.SALES_PERSON },
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
      console.error("Error deleting salesPerons:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updatesalesPeronPassword(req: AuthenticatedRequest, res: Response) {
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
        { $set: { password: hashedPassword } },
      );
      return ReS(res, SUCCESS_CODE, "Reset successfully.",);
    } catch (error) {
      console.error("Error in updatesalesPeronPassword:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async updatesalesPeronDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = Number(req.params.userId);
      const updatedData: UpdatesalesPeron = req.body;
      const userData: any = await userRepository.findOne(
        { id: userId },
        { lean: true },
      );
      if(updatedData?.role){
        const role_name = Roles[updatedData.role];
        if(!role_name) return ReE(res, BAD_REQUEST_CODE, "Invalid role");
        const role: any = await roleRepository.findOne(
          { name: role_name },
          { select: "id", lean: true },
        );
        if(!role) return ReE(res, BAD_REQUEST_CODE, "Role not found");
        updatedData.role_id = role.id;
      }
      if (!userData) return ReE(res, BAD_REQUEST_CODE, "User Not Found");
      const { password, ...safeUserData } = userData;
      await userRepository.updateMany(
        { id: userId },
        { $set: { ...updatedData } },
      );
      return ReS(res, SUCCESS_CODE, "User Updated Successfully", { ...safeUserData, ...updatedData });
    } catch (error) {
      console.error("Error in updatesalesPeronDetails:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
  async getMetricsAnalysis(req: AuthenticatedRequest, res: Response) {
    try {
      const salesPeronRole:any= await roleRepository.findOne({ name: Roles.SALES_PERSON }, { lean: true });
       if (!salesPeronRole) {
        return ReE(res, NO_CONTENT, "salesPeron role not found");
      }
      const salesPeronId = salesPeronRole.id;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [
        totalSalesPerons,
        newSalesPerons,
        activeSalesPerons,
        inactiveSalesPerons,
        verified,
        unverified,
        recentSalesPerons,
      ] = await Promise.all([
        userRepository.count({ role_id: salesPeronId }),

        userRepository.count({
          role_id: salesPeronId,
          created_at: { $gte: startOfMonth },
        }),

        userRepository.count({ role_id: salesPeronId, is_active: true }),
        userRepository.count({ role_id: salesPeronId, is_active: false }),
        userRepository.count({ role_id: salesPeronId, is_verified: true }),
        userRepository.count({ role_id: salesPeronId, is_verified: false }),
        userRepository.find(
          { role_id: salesPeronId },
          {
            sort: { created_at: -1 },
            limit: 10,
            select: "id name email created_at profile_image",
          },
        ),
      ]);

      return ReS(res, SUCCESS_CODE, "Metrics analysis fetched successfully", {
        totalSalesPerons,
        newSalesPerons,
        activeSalesPerons,
        inactiveSalesPerons,
        verified,
        unverified,
        recentSalesPerons,
      });
    } catch (error) {
      console.error("Analytics Error:", error);
      return ReE(res, SERVER_ERROR_CODE, "Something went wrong");
    }
  }
}
export default new SalesPersonController()
