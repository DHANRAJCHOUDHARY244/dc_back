import SolarBatteryBill from "@models/solarBatteryBill.model";
import { BaseRepository } from "./BaseRepository";

export class SolarBatteryBillRepository extends BaseRepository {
  constructor() {
    super(SolarBatteryBill, true);
  }
}

export const solarBatteryBillRepository = new SolarBatteryBillRepository();
