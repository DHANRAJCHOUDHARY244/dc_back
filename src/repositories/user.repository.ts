import User from "@models/users.model";
import { BaseRepository } from "./BaseRepository";

export class UserRepository extends BaseRepository {
  constructor() {
    super(User, true);
  }
}

export const userRepository = new UserRepository();
