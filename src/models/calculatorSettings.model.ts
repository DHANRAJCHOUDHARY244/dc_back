import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import {
  DEFAULT_BATTERY_INSTALL_TIERS,
  DEFAULT_BSTC_FORMULA,
  DEFAULT_DISTANCE_TIERS,
  DEFAULT_INSTALLATION_OPTION_PRICES,
  DEFAULT_SOLAR_INSTALL_FORMULA,
  DEFAULT_STC_FORMULA,
  SOLAR_INSTALL_RATE_CENTS_PER_WATT,
} from "@constants/calculator.constants";

const StatePriceSchema = new Schema(
  {
    vic: { type: Number, default: 0 },
    nsw: { type: Number, default: 0 },
    act: { type: Number, default: 0 },
  },
  { _id: false },
);

const defaultSolarInstallCents = () => ({
  vic: SOLAR_INSTALL_RATE_CENTS_PER_WATT,
  nsw: SOLAR_INSTALL_RATE_CENTS_PER_WATT,
  act: SOLAR_INSTALL_RATE_CENTS_PER_WATT,
});

const DistanceTierSchema = new Schema(
  {
    min_km: { type: Number, required: true },
    max_km: { type: Number, required: true },
    label: { type: String, required: true },
    prices: { type: StatePriceSchema, default: () => ({}) },
  },
  { _id: false },
);

const DiscountTierSchema = new Schema(
  {
    min_price: { type: Number, default: 0 },
    max_price: { type: Number, default: 0 }, // 0 = no upper limit
    type: { type: String, enum: ["percent", "flat"], default: "percent" },
    value: { type: Number, default: 0 },
    label: { type: String, default: "" },
  },
  { _id: false },
);

const BatteryInstallTierSchema = new Schema(
  {
    max_kwh: { type: Number, required: true },
    label: { type: String, required: true },
    prices: { type: StatePriceSchema, default: () => ({}) },
  },
  { _id: false },
);

const emptySp = () => ({ vic: 0, nsw: 0, act: 0 });

const CategoryOptionFeesSchema = new Schema(
  {
    phase: {
      single: { type: StatePriceSchema, default: emptySp },
      three: { type: StatePriceSchema, default: emptySp },
    },
    story: {
      single: { type: StatePriceSchema, default: emptySp },
      double: { type: StatePriceSchema, default: emptySp },
      multi: { type: StatePriceSchema, default: emptySp },
    },
    coupling: {
      dc: { type: StatePriceSchema, default: emptySp },
      ac: { type: StatePriceSchema, default: emptySp },
    },
  },
  { _id: false },
);

const InstallationOptionPricesSchema = new Schema(
  {
    solar: { type: CategoryOptionFeesSchema, default: () => DEFAULT_INSTALLATION_OPTION_PRICES.solar },
    battery: { type: CategoryOptionFeesSchema, default: () => DEFAULT_INSTALLATION_OPTION_PRICES.battery },
    inverter: { type: CategoryOptionFeesSchema, default: () => DEFAULT_INSTALLATION_OPTION_PRICES.inverter },
  },
  { _id: false },
);

const CalculatorSettingsSchema = new Schema(
  {
    id: { type: Number, unique: true, default: 1 },
    states: {
      type: [
        {
          code: String,
          label: String,
          _id: false,
        },
      ],
      default: () => [
        { code: "VIC", label: "Victoria" },
        { code: "NSW", label: "New South Wales" },
        { code: "ACT", label: "ACT" },
      ],
    },
    profit_margin_vic: { type: Number, default: 2000 },
    profit_margin_nsw_act: { type: Number, default: 2300 },
    default_sales_commission: { type: Number, default: 250 },
    delivery_base: { type: StatePriceSchema, default: () => ({}) },
    delivery_per_km: { type: StatePriceSchema, default: () => ({}) },
    distance_tiers: { type: [DistanceTierSchema], default: () => DEFAULT_DISTANCE_TIERS },
    installation_single_phase: { type: StatePriceSchema, default: () => ({}) },
    installation_three_phase: { type: StatePriceSchema, default: () => ({}) },
    pre_approval: { type: StatePriceSchema, default: () => ({}) },
    grid_connection: { type: StatePriceSchema, default: () => ({}) },
    sub_board_upgrade: { type: StatePriceSchema, default: () => ({}) },
    critical_installation: { type: StatePriceSchema, default: () => ({}) },
    garage_installation: { type: StatePriceSchema, default: () => ({}) },
    extra_wiring_rate_per_m: { type: Number, default: 20 },
    extra_wiring_free_meters: { type: Number, default: 10 },
    panel_removal_cost_per_panel: { type: Number, default: 30 },
    gst_rate: { type: Number, default: 0.1 },
    solar_vic_rebate: { type: Number, default: 1400 },
    solar_vic_interest_free_loan: { type: Number, default: 1400 },
    // Rebate quantity is derived from an editable formula, then multiplied by stc_price.
    // STC formula variable: `kw` (total solar kW). BSTC formula variable: `kwh` (total battery kWh).
    stc_price: { type: Number, default: 39 },
    stc_formula: { type: String, default: DEFAULT_STC_FORMULA },
    bstc_formula: { type: String, default: DEFAULT_BSTC_FORMULA },
    // Solar install labour rate in cents per watt, by location (VIC / NSW / ACT).
    // Used as `cents` in solar_install_formula.
    solar_install_cents_per_watt: { type: StatePriceSchema, default: defaultSolarInstallCents },
    // Editable install $ formula. Variables: kw, cents, watts, rate.
    solar_install_formula: { type: String, default: DEFAULT_SOLAR_INSTALL_FORMULA },
    // Battery install by pack size (ex GST), prices per VIC / NSW / ACT.
    battery_install_tiers: {
      type: [BatteryInstallTierSchema],
      default: () => DEFAULT_BATTERY_INSTALL_TIERS,
    },
    // Phase / story / coupling fees for Solar, Battery, Inverter — VIC / NSW / ACT each.
    installation_option_prices: {
      type: InstallationOptionPricesSchema,
      default: () => DEFAULT_INSTALLATION_OPTION_PRICES,
    },
    discount_tiers: { type: [DiscountTierSchema], default: () => [] },
    guidelines: {
      type: [String],
      default: () => [
        "Set the customer's location first — prices and rebates vary by state.",
        "Add products by category from the picker; you can add a battery, inverter and more in one session.",
        "GST is calculated on the full price first, then rebates are deducted from the GST-inclusive amount.",
        "Manage products, brands, prices and fees from the Catalog admin tab.",
      ],
    },
  },
  collectionOptions("calculator_settings"),
);

applyBasePlugins(CalculatorSettingsSchema, { collection: "calculator_settings", paranoid: false });

const CalculatorSettings =
  mongoose.models.CalculatorSettings ?? mongoose.model("CalculatorSettings", CalculatorSettingsSchema);
export default CalculatorSettings;
