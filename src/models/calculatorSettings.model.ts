import mongoose, { Schema } from "mongoose";
import { applyBasePlugins, collectionOptions } from "@db/plugins";
import {
  DEFAULT_BATTERY_INSTALL_TIERS,
  DEFAULT_BSTC_FORMULA,
  DEFAULT_DISTANCE_TIERS,
  DEFAULT_INSTALLATION_OPTION_PRICES,
  DEFAULT_PROFIT_MARGINS,
  DEFAULT_SOLAR_INSTALL_FORMULA,
  DEFAULT_STC_FORMULA,
  SOLAR_INSTALL_RATE_CENTS_PER_WATT,
} from "@constants/calculator.constants";
import { statePriceAll } from "@constants/auStatePrice.constants";
import {
  DEFAULT_BATTERY_STC_BANDS,
  DEFAULT_BATTERY_STC_WINDOWS,
} from "@constants/batteryStc.constants";
import { emptySp, StatePriceSchema } from "../schemas/statePrice.schema";

export const DEFAULT_AU_CALCULATOR_STATES = [
  { code: "VIC", label: "Victoria" },
  { code: "NSW", label: "New South Wales" },
  { code: "ACT", label: "ACT" },
  { code: "QLD", label: "Queensland" },
  { code: "SA", label: "South Australia" },
  { code: "WA", label: "Western Australia" },
  { code: "TAS", label: "Tasmania" },
  { code: "NT", label: "Northern Territory" },
];

const defaultSolarInstallCents = () => statePriceAll(SOLAR_INSTALL_RATE_CENTS_PER_WATT);

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
      default: () => DEFAULT_AU_CALCULATOR_STATES,
    },
    profit_margin_vic: { type: Number, default: 2000 },
    profit_margin_nsw_act: { type: Number, default: 2300 },
    /** Per-state profit margins (vic/nsw/act/qld/sa/wa/tas/nt). Preferred over legacy fields. */
    profit_margins: {
      type: {
        vic: { type: Number, default: 2000 },
        nsw: { type: Number, default: 2300 },
        act: { type: Number, default: 2300 },
        qld: { type: Number, default: 2300 },
        sa: { type: Number, default: 2300 },
        wa: { type: Number, default: 2300 },
        tas: { type: Number, default: 2300 },
        nt: { type: Number, default: 2300 },
      },
      default: () => ({ ...DEFAULT_PROFIT_MARGINS }),
    },
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
    panel_removal_cost_per_panel: { type: StatePriceSchema, default: () => statePriceAll(30) },
    gst_rate: { type: Number, default: 0.1 },
    solar_vic_rebate: { type: Number, default: 1400 },
    solar_vic_interest_free_loan: { type: Number, default: 1400 },
    // Rebate quantity is derived from an editable formula, then multiplied by stc_price.
    // STC formula variable: `kw` (total solar kW). BSTC formula variable: `kwh` (total battery kWh).
    stc_price: { type: Number, default: 39 },
    stc_formula: { type: String, default: DEFAULT_STC_FORMULA },
    bstc_formula: { type: String, default: DEFAULT_BSTC_FORMULA },
    /** Nationwide STC zone factor fallback until postcode mapping is filled */
    stc_zone_factor: { type: Number, default: 1.185 },
    /** When true, BSTC uses capacity bands + date windows instead of flat formula */
    bstc_use_bands: { type: Boolean, default: true },
    bstc_capacity_bands: {
      type: [
        {
          min_kwh: Number,
          max_kwh: { type: Number, default: null },
          share: Number,
          _id: false,
        },
      ],
      default: () => DEFAULT_BATTERY_STC_BANDS,
    },
    bstc_factor_windows: {
      type: [
        {
          start_date: String,
          end_date: String,
          factor: Number,
          _id: false,
        },
      ],
      default: () => DEFAULT_BATTERY_STC_WINDOWS,
    },
    // Solar install labour rate in cents per watt, by location (all AU states).
    // Used as `cents` in solar_install_formula.
    solar_install_cents_per_watt: { type: StatePriceSchema, default: defaultSolarInstallCents },
    // Editable install $ formula. Variables: kw, cents, watts, rate.
    solar_install_formula: { type: String, default: DEFAULT_SOLAR_INSTALL_FORMULA },
    // Battery install by pack size (ex GST), prices per AU state.
    battery_install_tiers: {
      type: [BatteryInstallTierSchema],
      default: () => DEFAULT_BATTERY_INSTALL_TIERS,
    },
    // Phase / story / coupling fees for Solar, Battery, Inverter — all AU states.
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
