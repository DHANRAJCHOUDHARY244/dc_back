import ChatPermission from "@models/chatPermission.model";
import { BaseRepository } from "./BaseRepository";

export class ChatPermissionRepository extends BaseRepository {
  constructor() {
    super(ChatPermission, false);
  }
}

export const chatPermissionRepository = new ChatPermissionRepository();
