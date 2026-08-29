import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { roleRepository, userRepository } from "@repositories";
import { sendEmailRegSignOtpAsync } from "@services/email.service";
import {
  compare_Hash_Password,
  generate_6_Digit_Otp,
  generate_Hash_Password,
  ReE,
  ReS,
} from "@services/generalHelper.service";
import {
  BAD_REQUEST_CODE,
  FORBIDDEN_CODE,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";

import { OtpType } from "@constants/common.enum";
import { AuthenticatedRequest } from "@constants/common.interface";
import { faker } from "@faker-js/faker";
import permissionController from "./permission.controller";
import { Roles } from "src/data/dataInserter";
import { getCompanyConfig } from "@services/crmSettings.service";
import { resolveRoleHomePath } from "@services/roleHomePath.service";
class AuthController {

  private async getUserInfoRoleAndPermission(user_data: any, is_remember = false) {
    if (!user_data?.profile_image) user_data.avatar = faker.image.avatarGitHub();
    else user_data.avatar = user_data?.profile_image;

    const [role_info, permissions_info] = await Promise.all([
      roleRepository.findOne(
        { id: user_data.role_id },
        { select: "id name", lean: true },
      ),
      permissionController.getPermissionTree(user_data.role_id),
    ]);

    const { password: user_pass, otp, ...userInfo } = user_data;
    const token = jwt.sign(
      {
        id: user_data.id,
        email: user_data.email,
        role: role_info?.name,
        role_id: role_info?.id ?? user_data.role_id,
        name: user_data.name,
        profile_image: user_data.avatar,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: is_remember ? "15d" : "1d",
      },
    );
    return {
      user: {
        ...userInfo,
        username: userInfo.username,
        name: userInfo.name,
        role: role_info?.name,
        permissions: permissions_info,
      },
      token,
      home_path: resolveRoleHomePath(role_info?.name, permissions_info as any[]),
    }
  }
  async register(req: Request, res: Response) {
    try {
      let {
        name,
        username,
        email,
        password,
        mobile_no,
        mobile_country_code,
        city,
        address,
        is_signup = true,
        role,
      } = req.body;

      name = name?.trim();
      username = username?.trim().toLowerCase();
      email = email?.trim().toLowerCase();
      city = city?.trim() || undefined;
      address = address?.trim() || undefined;

      const existingUser = await userRepository.findOne(
        { $or: [{ email }, { username }] },
        { lean: true },
      );

      if (existingUser)
        return ReE(res, BAD_REQUEST_CODE, "User already exists");

      const hashedPassword = await generate_Hash_Password(password);
      const genOtp = generate_6_Digit_Otp();

      const roleName = role
        ? (Roles[role as keyof typeof Roles] ?? String(role).trim())
        : Roles.CUSTOMER;

      const roleDoc: any = await roleRepository.findOne(
        { name: roleName },
        { select: "id", lean: true },
      );
      const roleId = roleDoc?.id ?? null;

      const user: any = await userRepository.create({
        name,
        username,
        email,
        password: hashedPassword,
        mobile_no,
        mobile_country_code,
        city,
        address,
        otp: {
          otp: genOtp,
          otp_type: OtpType.VERIFY_EMAIL,
          expired_at: new Date(Date.now() + 10 * 60 * 1000),
        },
        role_id: roleId,
      });

      try {
        const roleNameForHr = roleName;
        if (roleNameForHr !== Roles.CUSTOMER && user?.id) {
          const { ensureEmployeeProfile } = await import("@services/hrAttendance.service");
          await ensureEmployeeProfile(user.id);
        }
      } catch (profileErr: any) {
        console.error("HR profile provision failed:", profileErr?.message);
      }

      if (is_signup) {
        const cfg = await getCompanyConfig();
        const emailPayload = {
          email,
          subject: `Welcome ${name} - Verify Your Email`,
          client_name: name,
          id: user.id,
          type: "USER",
          message: `Welcome ${name} to ${cfg.nameShort} family. Please verify your email using the OTP below.`,
          otp: genOtp,
        };

        sendEmailRegSignOtpAsync(emailPayload, "Registration OTP email");
      }

      return ReS(res, SUCCESS_CODE, "User registered successfully.");
    } catch (error) {
      console.log(error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async login(req: Request, res: Response) {
    try {
      let { username, password, is_remember = false } = req.body;

      username = username?.trim().toLowerCase();

      if (!username || !password) {
        return ReE(res, BAD_REQUEST_CODE, "Username and password are required");
      }

      const user = await userRepository.findOne(
        { $or: [{ email: username }, { username }] },
        { select: { otp: 0 }, lean: true },
      );

      if (!user) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid credentials");
      }

      const isMatch = await compare_Hash_Password(password, user.password);
      if (!isMatch) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid credentials");
      }

      if (!user.is_verified) {
        return ReE(res, BAD_REQUEST_CODE, "Email not verified");
      }

      if (user.is_active === false) {
        return ReE(res, BAD_REQUEST_CODE, "Account is deactivated");
      }

      const resData = await this.getUserInfoRoleAndPermission(
        user,
        is_remember
      );

      return ReS(res, SUCCESS_CODE, "Login successful", resData);
    } catch (error) {
      console.log(error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async reset_password_req(req: AuthenticatedRequest, res: Response) {
    try {
      const { new_password, old_password = null } = req.body;
      const { user } = req;
      const userDetails = await userRepository.findOne({ id: user.id }, { lean: true });
      if (!userDetails) return ReE(res, RESOURCE_NOT_FOUND, "User not found");

      if (!old_password) {
        if (!user?.otp_type) return ReE(res, FORBIDDEN_CODE, "Invalid Token");
        if (!userDetails?.otp_verification_token) return ReE(res, RESOURCE_NOT_FOUND, "User not found Or Invalid Token");
      }
      if (old_password) {
        const isMatch = await compare_Hash_Password(old_password, userDetails.password);
        if (!isMatch) return ReE(res, FORBIDDEN_CODE, "Old Password is incorrect");
      }
      if (!new_password)
        return ReE(res, BAD_REQUEST_CODE, "New password is required");
      const hashedPassword = await generate_Hash_Password(new_password);
      await userRepository.updateMany(
        { id: user.id },
        { $set: { password: hashedPassword, otp_verification_token: null, must_change_password: false } },
      );
      const refreshed: any = await userRepository.findOne({ id: user.id }, { lean: true, select: { otp: 0 } });
      const resData = await this.getUserInfoRoleAndPermission(refreshed || userDetails);

      return ReS(res, SUCCESS_CODE, "Reset successfully.", resData);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error:${error}`);
    }
  }

  async verify_Email(req: Request, res: Response) {
    try {
      const { email, otp, resend } = req.body;
      const userData = await userRepository.findOne({ email }, { lean: true });
      if (!userData) return ReE(res, RESOURCE_NOT_FOUND, "User not found");
      const { otp: otp_, ...user } = userData;
      const otpData = typeof otp_ === 'string' ? JSON.parse(otp_) : otp_ || null;
      if (user.is_verified) return ReE(res, BAD_REQUEST_CODE, "Email already verified");

      if (resend) {
        const genOtp = generate_6_Digit_Otp();
        await userRepository.updateMany(
          { id: user.id },
          {
            $set: {
              otp: {
                otp: genOtp,
                otp_type: OtpType.VERIFY_EMAIL,
                expired_at: new Date(Date.now() + 10 * 60 * 1000),
                is_active: true,
              },
            },
          },
        );
        const emailPayload = {
          email,
          subject: `Verify your email - ${userData.name}`,
          client_name: userData.name,
          id: user.id,
          type: "Email Verification",
          message: `${userData.name}, please verify your email address by entering the OTP below. It expires in 10 minutes.`,
          otp: genOtp
        }
        sendEmailRegSignOtpAsync(emailPayload, "Email verification OTP");
        return ReS(res, SUCCESS_CODE, "Otp sent to your email");
      }

      if (!otp) return ReE(res, BAD_REQUEST_CODE, "Otp is required");

      if (!otpData || parseInt(otp) !== otpData.otp || new Date(otpData.expired_at) < new Date() || otpData.otp_type !== OtpType.VERIFY_EMAIL)
        return ReE(res, BAD_REQUEST_CODE, "Invalid or expired otp");

      await userRepository.updateMany(
        { id: user.id },
        { $set: { is_verified: true, otp: null, must_change_password: true } },
      );

      const refreshed: any = await userRepository.findOne({ id: user.id }, { lean: true, select: { otp: 0 } });
      const resData = await this.getUserInfoRoleAndPermission(refreshed || { ...user, is_verified: true, must_change_password: true });

      return ReS(res, SUCCESS_CODE, "Email verified successfully. Please set a new password.", resData);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async verify_forgot_password_otp(req: Request, res: Response) {
    try {
      const { email, otp, resend } = req.body;
      const userData = await userRepository.findOne({ email }, { lean: true });
      if (!userData) return ReE(res, RESOURCE_NOT_FOUND, "User not found");
      const { otp: otpData, ...user } = userData;

      if (resend) {
        const genOtp = generate_6_Digit_Otp();
        await userRepository.updateMany(
          { id: user.id },
          {
            $set: {
              otp: {
                otp: genOtp,
                otp_type: OtpType.FORGOT_PASSWORD,
                expired_at: new Date(Date.now() + 10 * 60 * 1000),
              },
            },
          },
        );
        const emailPayload = {
          email,
          subject: `Password reset OTP - ${userData.name}`,
          client_name: userData.name,
          id: user.id,
          type: "Password Reset",
          message: `${userData.name}, use the OTP below to reset your password. It expires in 10 minutes.`,
          otp: genOtp
        }
        sendEmailRegSignOtpAsync(emailPayload, "Forgot password OTP");
        return ReS(res, SUCCESS_CODE, "Otp sent to your email");
      }

      if (!otp) return ReE(res, BAD_REQUEST_CODE, "Otp is required");

      if (
        !otpData ||
        parseInt(String(otp), 10) !== otpData.otp ||
        new Date(otpData.expired_at) < new Date() ||
        otpData.otp_type !== OtpType.FORGOT_PASSWORD
      ) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid or expired otp");
      }

      const otpToken = jwt.sign({ id: user.id, email: user.email, otp_type: OtpType.FORGOT_PASSWORD }, process.env.JWT_SECRET!, { expiresIn: "15m" });
      await userRepository.updateMany(
        { id: user.id },
        { $set: { otp_verification_token: otpToken, otp: null } },
      );
      return ReS(res, SUCCESS_CODE, "Otp verified successfully", { token: otpToken });
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async searchUsers(req: Request, res: Response) {
    try {
      const { q = "", limit = "10" } = req.query as { q?: string; limit?: string };
      const query = decodeURIComponent(q);
      const parsedLimit = parseInt(limit);

      const searchTerm = query.toLowerCase();

      const users: any = await userRepository.find(
        {
          $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { email: { $regex: searchTerm, $options: "i" } },
            { username: { $regex: searchTerm, $options: "i" } },
          ],
        },
        {
          select: "id name email profile_image",
          limit: parsedLimit,
          lean: true,
        },
      );

      if (!users.length)
        return ReS(res, SUCCESS_CODE, "No matching users found", []);
      const usersWithAvatar = users.map((user: any) => {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.profile_image || faker.image.avatar(),
        };
      });
      return ReS(res, SUCCESS_CODE, "Installers found", usersWithAvatar);
    } catch (error) {
      console.error("Error searching users:", error);
      return ReE(res, SERVER_ERROR_CODE, "Internal server error");
    }
  }

  /** Stateless JWT logout — client clears token; endpoint avoids 404 on sign-out. */
  async logout(_req: Request, res: Response) {
    return ReS(res, SUCCESS_CODE, "Logged out successfully", {});
  }
}

export default new AuthController();
