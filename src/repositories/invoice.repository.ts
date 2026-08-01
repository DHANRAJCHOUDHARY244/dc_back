import Invoice from "@models/invoice.model";
import { BaseRepository } from "./BaseRepository";

export class InvoiceRepository extends BaseRepository {
  constructor() {
    super(Invoice, true);
  }
}

export const invoiceRepository = new InvoiceRepository();
