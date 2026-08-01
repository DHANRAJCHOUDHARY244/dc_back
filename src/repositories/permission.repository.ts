import Permission from "@models/permission.model";
import { BaseRepository } from "./BaseRepository";

export class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission, true);
  }
}

export const permissionRepository = new PermissionRepository();
