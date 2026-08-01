import StockOrder from "@models/stockOrder.model";
import { BaseRepository } from "./BaseRepository";

export class StockOrderRepository extends BaseRepository {
  constructor() {
    super(StockOrder, true);
  }
}

export const stockOrderRepository = new StockOrderRepository();
