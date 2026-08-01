import CalculatorBrand from "@models/calculatorBrand.model";
import { BaseRepository } from "./BaseRepository";

export class CalculatorBrandRepository extends BaseRepository {
  constructor() {
    super(CalculatorBrand, true);
  }
}

export const calculatorBrandRepository = new CalculatorBrandRepository();
