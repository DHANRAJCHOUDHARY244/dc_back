import AccountsRebate from "@models/accountsRebate.model";
import { BaseRepository } from "./BaseRepository";

export class AccountsRebateRepository extends BaseRepository {
	constructor() {
		super(AccountsRebate, true);
	}
}

export const accountsRebateRepository = new AccountsRebateRepository();
