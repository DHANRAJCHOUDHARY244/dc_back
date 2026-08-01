import Message from "@models/message.model";
import { BaseRepository } from "./BaseRepository";

export class MessageRepository extends BaseRepository {
  constructor() {
    super(Message, false);
  }
}

export const messageRepository = new MessageRepository();
