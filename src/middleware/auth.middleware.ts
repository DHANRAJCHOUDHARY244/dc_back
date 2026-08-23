import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ReE } from "@services/generalHelper.service";
import { UNAUTHORIZED_CODE } from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import { roleRepository } from "@repositories";

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.body.token || req.query.token || req.headers['token'];
  try {
    if (!token) return ReE(res, UNAUTHORIZED_CODE, "Unauthorized");
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
    req.user = decoded;

    if (!req.user.role_id && req.user.role) {
      const role = await roleRepository.findOne(
        { name: req.user.role },
        { select: "id", lean: true },
      );
      if (role) req.user.role_id = (role as { id: number }).id;
    }

    next();
  } catch (error) {
    return ReE(res, UNAUTHORIZED_CODE, "Invalid token");
  }
};
