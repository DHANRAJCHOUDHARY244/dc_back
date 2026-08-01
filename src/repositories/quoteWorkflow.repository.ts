import QuoteWorkflow from "@models/quoteWorkflow";
import { BaseRepository } from "./BaseRepository";

export class QuoteWorkflowRepository extends BaseRepository {
  constructor() {
    super(QuoteWorkflow, true);
  }
}

export const quoteWorkflowRepository = new QuoteWorkflowRepository();
