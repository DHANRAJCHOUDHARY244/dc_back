import { AuthenticatedRequest } from "@constants/common.interface";
import { BAD_REQUEST_CODE, RESOURCE_NOT_FOUND, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import {
  permissionRepository,
  roleRepository,
  userPermissionRepository,
} from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { buildMenuTreePermissionGrp } from "@services/permissionArrange.service";
import { Response } from "express";

class RolesController {
  async createRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, label, desc, order } = req.body;

      const existingRole = await roleRepository.findOne({
        $or: [{ name }, { label }],
      });

      if (existingRole)
        return ReE(res, SERVER_ERROR_CODE, "Role with this name or label already exists");

      const newRole = await roleRepository.create({ name, label, desc, order });

      return ReS(res, SUCCESS_CODE, "Role created successfully", newRole);
    } catch (error) {
      console.log(error);
      
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 10, name } = req.query;
      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);

      const { rows, count } = await roleRepository.findPaginated(
        {
          ...(name && { name: { $regex: name as string, $options: "i" } }),
        },
        {
          limit: parsedLimit,
          page: parsedPage,
          sort: { order: 1 },
        },
      );

      return ReS(res, SUCCESS_CODE, "Roles retrieved successfully", {
        data: rows,
        totalItems: count,
        totalPages: Math.ceil(count / parsedLimit),
        currentPage: parsedPage,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async updateRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }:any = req.params;
      const { name, label, desc } = req.body;

      const role: any = await roleRepository.findById(Number(id));
      if (!role) return ReE(res, SERVER_ERROR_CODE, "Role not found");

      const updated = await roleRepository.updateById(Number(id), { $set: { name, label, desc } });

      return ReS(res, SUCCESS_CODE, "Role updated successfully", updated);
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async updatePermissionsForRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { role_id, permission } = req.body;

      if (!role_id || !permission || typeof permission.id !== 'number') {
        return ReE(res, BAD_REQUEST_CODE, "Missing role_id or invalid permission data");
      }

      const role = await roleRepository.findById(Number(role_id));
      if (!role) return ReE(res, BAD_REQUEST_CODE, "Role not found");

      const existingPermission = await userPermissionRepository.findOne({
        role_id,
        permission_id: permission.permissions_id,
        id: permission.id,
      });

      const payload = {
        role_id,
        permission_id: permission.permissions_id,
        enable: permission.enable,
        create: permission.create,
        can_update: permission.can_update,
        delete: permission.delete,
        is_user_specific: permission.is_user_specific,
      };

      if (existingPermission) {
        await userPermissionRepository.updateById(existingPermission.id, { $set: payload });
      } else {
        await userPermissionRepository.create(payload);
      }

      return ReS(res, SUCCESS_CODE, "Permission saved successfully");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async deleteRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }:any = req.params;

      const role = await roleRepository.findById(Number(id));
      if (!role) return ReE(res, SERVER_ERROR_CODE, "Role not found");

      await userPermissionRepository.deleteMany({ role_id: Number(id) });
      await roleRepository.deleteById(Number(id));

      return ReS(res, SUCCESS_CODE, "Role deleted successfully");
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  async getRolePermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: role_id }:any = req.params;

      const role: any = await roleRepository.findById(Number(role_id));
      if (!role) return ReE(res, RESOURCE_NOT_FOUND, "Role not found");

      const isSuperAdmin = role.name === "SUPER_ADMIN";

      let rolePermissions = await userPermissionRepository.find(
        { role_id: Number(role_id) },
        { populate: { path: "permission" } },
      );

      const allPermissions = await permissionRepository.find({}, { lean: true });

      if (rolePermissions.length === 0) {
        await Promise.all(
          allPermissions.map((permission: any) =>
            userPermissionRepository.create({
              role_id: Number(role_id),
              permission_id: permission.id,
              enable: isSuperAdmin,
              create: isSuperAdmin,
              can_update: isSuperAdmin,
              delete: isSuperAdmin,
              is_user_specific: false,
            })
          )
        );
      } else {
        const existingPermissionIds = new Set(
          rolePermissions.map((rp: any) => rp.permission_id)
        );

        const missingPermissions = allPermissions.filter(
          (p: any) => !existingPermissionIds.has(p.id)
        );

        if (missingPermissions.length > 0) {
          await Promise.all(
            missingPermissions.map((permission: any) =>
              userPermissionRepository.create({
                role_id: Number(role_id),
                permission_id: permission.id,
                enable: isSuperAdmin,
                create: isSuperAdmin,
                can_update: isSuperAdmin,
                delete: isSuperAdmin,
                is_user_specific: false,
              })
            )
          );
        }
      }

      rolePermissions = await userPermissionRepository.find(
        { role_id: Number(role_id) },
        { populate: { path: "permission" } },
      );

      const permissionList = rolePermissions.map((entry: any) => {
        const accessData = entry.toJSON();
        const permissionDoc = entry.permission;
        const permissionData = permissionDoc?.toJSON?.() ?? permissionDoc ?? {};
        const { id, ...restPermission } = permissionData;

        return {
          ...restPermission,
          ...accessData,
        };
      });

      const permissionTree = buildMenuTreePermissionGrp(permissionList);

      return ReS(res, SUCCESS_CODE, "Permissions retrieved successfully", {
        permissionTree,
      });
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new RolesController();
