import AccountsInstallerInvoice from "@models/accountsInstallerInvoice.model";
import { BaseRepository } from "./BaseRepository";

export class AccountsInstallerInvoiceRepository extends BaseRepository {
	constructor() {
		super(AccountsInstallerInvoice, true);
	}
}

export const accountsInstallerInvoiceRepository = new AccountsInstallerInvoiceRepository();
