import AccountsStockDelivery from "@models/accountsStockDelivery.model";
import { BaseRepository } from "./BaseRepository";

export class AccountsStockDeliveryRepository extends BaseRepository {
	constructor() {
		super(AccountsStockDelivery, true);
	}
}

export const accountsStockDeliveryRepository = new AccountsStockDeliveryRepository();
