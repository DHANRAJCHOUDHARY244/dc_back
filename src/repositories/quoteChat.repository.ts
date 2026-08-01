import QuoteChat from "@models/quote-chat.model";
import { BaseRepository } from "./BaseRepository";

export class QuoteChatRepository extends BaseRepository {
  constructor() {
    super(QuoteChat, true);
  }
}

export const quoteChatRepository = new QuoteChatRepository();
