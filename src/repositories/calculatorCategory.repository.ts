import CalculatorCategory from "@models/calculatorCategory.model";
import { BaseRepository } from "./BaseRepository";

export class CalculatorCategoryRepository extends BaseRepository {
  constructor() {
    super(CalculatorCategory, true);
  }
}

export const calculatorCategoryRepository = new CalculatorCategoryRepository();
