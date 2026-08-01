import Chat from "@models/chat.model";
import { BaseRepository } from "./BaseRepository";

export class ChatRepository extends BaseRepository {
  constructor() {
    super(Chat, false);
  }
}

export const chatRepository = new ChatRepository();
