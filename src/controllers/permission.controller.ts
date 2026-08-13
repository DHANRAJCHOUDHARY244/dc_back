import { AuthenticatedRequest } from "./../constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { BAD_REQUEST_CODE, RESOURCE_NOT_FOUND, SERVER_ERROR_CODE, SUCCESS_CODE,} from "@constants/serverCode";
import {
  permissionRepository,
  roleRepository,
  userPermissionRepository,
} from "@repositories";
import { Response } from "express";
import { buildMenuTree } from "@services/permissionArrange.service";
import { notifyRolePermissionChange } from "@services/permissionNotify.service";

class PermissionController {
    async addPermission(req: AuthenticatedRequest, res: Response) {
        try {
            const { name, parentId = null, label, icon, type, route, order = null, children = [], component = null, hide = null, status = null, newFeature = null } = req.body;
            if (!name || !label || !route)
                return ReE(res, BAD_REQUEST_CODE, "name, label, route are required");
            const permission = await permissionRepository.create({ name, parentId: parentId || null, label, icon, type, route, order, children, component, hide, status, newFeature });

            const roles = await roleRepository.find();
            await Promise.all(
                roles.map((role: any) =>
                    userPermissionRepository.create({
                        role_id: role.id,
                        permission_id: permission.id,
                        enable: role.name === "SUPER_ADMIN",
                        create: role.name === "SUPER_ADMIN",
                        can_update: role.name === "SUPER_ADMIN",
                        delete: role.name === "SUPER_ADMIN",
                        is_user_specific: false,
                    })
                )
            );

            // Menu tree changed — refresh connected users for every role
            for (const role of roles as any[]) {
              if (role?.id != null) notifyRolePermissionChange(role.id);
            }

            return ReS(res, SUCCESS_CODE, "Permission added successfully!", permission);
        } catch (error) {
            console.log(error);
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }

    async getAllPermissions(req: AuthenticatedRequest, res: Response) {
        try {
            const permissions = await permissionRepository.find(
              {},
              { sort: { order: 1 }, lean: true },
            );
            const tree = buildMenuTree(permissions as any);
            return ReS(res, SUCCESS_CODE, "Permissions fetched successfully", tree);
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }

    async updatePermission(req: AuthenticatedRequest, res: Response) {
        try {
            const { id }: any = req.params;
            const { name, parentId, label, icon, type, route, order, component, hide, status, newFeature } = req.body;

            const permission: any = await permissionRepository.findById(Number(id));
            if (!permission) return ReE(res, RESOURCE_NOT_FOUND, "Permission not found");

            const updated = await permissionRepository.updateById(Number(id), {
              $set: {
                ...(name !== undefined && { name }),
                ...(parentId !== undefined && { parentId: parentId || null }),
                ...(label !== undefined && { label }),
                ...(icon !== undefined && { icon }),
                ...(type !== undefined && { type }),
                ...(route !== undefined && { route }),
                ...(order !== undefined && { order }),
                ...(component !== undefined && { component }),
                ...(hide !== undefined && { hide }),
                ...(status !== undefined && { status }),
                ...(newFeature !== undefined && { newFeature }),
              },
            });

            const roles = await roleRepository.find({}, { select: "id", lean: true });
            for (const role of roles as any[]) {
              if (role?.id != null) notifyRolePermissionChange(role.id);
            }

            return ReS(res, SUCCESS_CODE, "Permission updated successfully", updated);
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }

    async deletePermission(req: AuthenticatedRequest, res: Response) {
        try {
            const { id }: any = req.params;

            const permission = await permissionRepository.findById(Number(id));
            if (!permission) return ReE(res, RESOURCE_NOT_FOUND, "Permission not found");

            const childCount = await permissionRepository.count({ parentId: Number(id) });
            if (childCount > 0)
                return ReE(res, BAD_REQUEST_CODE, "Cannot delete permission with child permissions");

            await userPermissionRepository.deleteMany({ permission_id: Number(id) });
            await permissionRepository.deleteById(Number(id));

            const roles = await roleRepository.find({}, { select: "id", lean: true });
            for (const role of roles as any[]) {
              if (role?.id != null) notifyRolePermissionChange(role.id);
            }

            return ReS(res, SUCCESS_CODE, "Permission deleted successfully");
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
    async getPermissionTree(role_id: number) {
        try {
               const rolePermissions = await userPermissionRepository.find(
                  { role_id, enable: true },
                  { populate: { path: "permission" } },
                );
                const permissionList = rolePermissions.map((entry: any) => {
                  const {create,can_update,enable,delete:is_deleted,is_user_specific} = entry.toJSON();
                  const permission = entry.permission?.toJSON?.() || {};
            
                  return {
                    ...permission,
                    create,
                    delete: is_deleted,
                    can_update,
                    is_user_specific,
                    enable
                  };
                });
            const per = buildMenuTree(permissionList);
            return per
        } catch (error) {
            throw error
        }
    }
    async getPermissionPagination(req: AuthenticatedRequest, res: Response) {
        try {
          const roleId = req.user?.role_id;
          if (!roleId) {
            return ReE(res, BAD_REQUEST_CODE, "Role not found for user");
          }
          const per = await this.getPermissionTree(roleId);
          return ReS(res, SUCCESS_CODE, "Permissions fetched successfully", per);
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
}

export default new PermissionController();
