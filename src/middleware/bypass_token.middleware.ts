import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ReE } from "@services/generalHelper.service";
import { UNAUTHORIZED_CODE } from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import { extractAuthToken } from "@utils/extractToken";

export const bypassValidation = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = extractAuthToken(req);
    try {
        const bypass_token:any =
          req.query.bypass_token ||
          req.params.bypass_token ||
          req.body?.bypass_token;
        if (!bypass_token) {
            if (!token) return ReE(res, UNAUTHORIZED_CODE, "Unauthorized");
            const decoded = jwt.verify(token, process.env.JWT_SECRET!);
            req.user = decoded;
        }
        else {
            req.bypass_token = decodeURIComponent(bypass_token);
        }
        next();
    } catch (error) {
        return ReE(res, UNAUTHORIZED_CODE, "Invalid token");
    }
};
