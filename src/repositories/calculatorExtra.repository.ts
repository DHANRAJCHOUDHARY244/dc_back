import CalculatorExtra from "@models/calculatorExtra.model";
import { BaseRepository } from "./BaseRepository";

export class CalculatorExtraRepository extends BaseRepository {
  constructor() {
    super(CalculatorExtra, true);
  }
}

export const calculatorExtraRepository = new CalculatorExtraRepository();
