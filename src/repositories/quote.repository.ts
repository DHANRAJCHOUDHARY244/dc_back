import Quote from "@models/quote.model";
import { BaseRepository } from "./BaseRepository";

export class QuoteRepository extends BaseRepository {
  constructor() {
    super(Quote, true);
  }
}

export const quoteRepository = new QuoteRepository();
