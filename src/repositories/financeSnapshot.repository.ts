import FinanceSnapshot from "@models/finance_snapshot.model";
import { BaseRepository } from "./BaseRepository";

export class FinanceSnapshotRepository extends BaseRepository {
  constructor() {
    super(FinanceSnapshot, true);
  }
}

export const financeSnapshotRepository = new FinanceSnapshotRepository();
