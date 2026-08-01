import PaymentHistory from "@models/paymentHistory.model";
import { BaseRepository } from "./BaseRepository";

export class PaymentHistoryRepository extends BaseRepository {
  constructor() {
    super(PaymentHistory, true);
  }
}

export const paymentHistoryRepository = new PaymentHistoryRepository();
