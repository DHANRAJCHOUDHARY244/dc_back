import CustomInvoice from "@models/customInvoice.model";
import { BaseRepository } from "./BaseRepository";

export class CustomInvoiceRepository extends BaseRepository {
  constructor() {
    super(CustomInvoice, true);
  }
}

export const customInvoiceRepository = new CustomInvoiceRepository();
