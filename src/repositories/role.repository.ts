import Role from "@models/roles.model";
import { BaseRepository } from "./BaseRepository";

export class RoleRepository extends BaseRepository {
  constructor() {
    super(Role, true);
  }
}

export const roleRepository = new RoleRepository();
