import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE } from "@services/generalHelper.service";
import { FORBIDDEN_CODE, UNAUTHORIZED_CODE } from "@constants/serverCode";
import {
  permissionRepository,
  roleRepository,
  userPermissionRepository,
} from "@repositories";

const actionTypeToColumn = (action: string) => {
  switch (action.toUpperCase()) {
    case "READ":
      return "enable";
    case "WRITE":
      return "create";
    case "UPDATE":
      return "can_update";
    case "DELETE":
      return "delete";
    default:
      return null;
  }
};

export const authorizeByHeader = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user?.id || !req.user?.role) {
      return ReE(res, UNAUTHORIZED_CODE, "Unauthorized");
    }

    const route = req.headers["route"] as string;
    const actionType = req.headers["action"] as string;

    if (!route || !actionType) {
      return ReE(res, FORBIDDEN_CODE, "Permission headers missing (route / action)");
    }

    const permissionColumn = actionTypeToColumn(actionType);
    if (!permissionColumn) {
      return ReE(res, FORBIDDEN_CODE, "Invalid action type");
    }

    const role = await roleRepository.findOne({ name: req.user.role }, { select: "id", lean: true });
    if (!role) {
      return ReE(res, FORBIDDEN_CODE, "Role not found");
    }

    const permissionExists = await permissionRepository.findOne({ route }, { select: "id", lean: true });
    if (!permissionExists) {
      return ReE(res, FORBIDDEN_CODE, `Permission not defined for route ${route}`);
    }

    const userSpecificEntry = await userPermissionRepository.findOne(
      { user_id: req.user.id, is_user_specific: true },
      {
        populate: { path: "permission", match: { route }, select: "id route" },
        lean: true,
      },
    );

    if (userSpecificEntry?.permission) {
      if (!(userSpecificEntry as any)[permissionColumn]) {
        return ReE(res, FORBIDDEN_CODE, `User-specific permission denied (${actionType} ${route})`);
      }

      req.user.permission_scope = "USER";
      req.user.permission_action = actionType;
      req.user.permission_route = route;
      return next();
    }

    const rolePermission = await userPermissionRepository.findOne(
      {
        role_id: (role as any).id,
        is_user_specific: false,
        [permissionColumn]: true,
      },
      {
        populate: { path: "permission", match: { route }, select: "id route" },
        lean: true,
      },
    );

    if (!rolePermission?.permission) {
      return ReE(res, FORBIDDEN_CODE, `Role permission denied (${actionType} ${route})`);
    }

    req.user.permission_scope = "ROLE";
    req.user.permission_action = actionType;
    req.user.permission_route = route;
    next();
  } catch (error) {
    console.error("Authorization error:", error);
    return ReE(res, FORBIDDEN_CODE, "Authorization failed");
  }
};
