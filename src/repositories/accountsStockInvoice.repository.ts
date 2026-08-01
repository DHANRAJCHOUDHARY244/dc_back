import AccountsStockInvoice from "@models/accountsStockInvoice.model";
import { BaseRepository } from "./BaseRepository";

export class AccountsStockInvoiceRepository extends BaseRepository {
	constructor() {
		super(AccountsStockInvoice, true);
	}
}

export const accountsStockInvoiceRepository = new AccountsStockInvoiceRepository();
