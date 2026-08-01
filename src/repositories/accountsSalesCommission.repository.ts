import AccountsSalesCommission from "@models/accountsSalesCommission.model";
import { BaseRepository } from "./BaseRepository";

export class AccountsSalesCommissionRepository extends BaseRepository {
	constructor() {
		super(AccountsSalesCommission, true);
	}
}

export const accountsSalesCommissionRepository = new AccountsSalesCommissionRepository();
