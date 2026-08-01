import CalculatorProduct from "@models/calculatorProduct.model";
import { BaseRepository } from "./BaseRepository";

export class CalculatorProductRepository extends BaseRepository {
  constructor() {
    super(CalculatorProduct, true);
  }
}

export const calculatorProductRepository = new CalculatorProductRepository();
