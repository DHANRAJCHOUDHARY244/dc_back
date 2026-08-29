import ChatReadState from "@models/chatReadState.model";
import { BaseRepository } from "./BaseRepository";

export class ChatReadStateRepository extends BaseRepository {
  constructor() {
    super(ChatReadState, false);
  }
}

export const chatReadStateRepository = new ChatReadStateRepository();
