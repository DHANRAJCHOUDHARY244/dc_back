import CalculatorSettings from "@models/calculatorSettings.model";
import { BaseRepository } from "./BaseRepository";

export class CalculatorSettingsRepository extends BaseRepository {
  constructor() {
    super(CalculatorSettings, false);
  }
}

export const calculatorSettingsRepository = new CalculatorSettingsRepository();
