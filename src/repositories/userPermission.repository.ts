import UserPermission from "@models/userPermissions.model";
import { BaseRepository } from "./BaseRepository";

export class UserPermissionRepository extends BaseRepository {
  constructor() {
    super(UserPermission, true);
  }
}

export const userPermissionRepository = new UserPermissionRepository();
