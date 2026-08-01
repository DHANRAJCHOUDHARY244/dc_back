import AccountsPreApprovalGrid from "@models/accountsPreApprovalGrid.model";
import { BaseRepository } from "./BaseRepository";

export class AccountsPreApprovalGridRepository extends BaseRepository {
	constructor() {
		super(AccountsPreApprovalGrid, true);
	}
}

export const accountsPreApprovalGridRepository = new AccountsPreApprovalGridRepository();
