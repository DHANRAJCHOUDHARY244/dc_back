import {
  CALCULATOR_DEFAULTS,
  DEFAULT_BATTERY_INSTALL_TIERS,
  DEFAULT_BSTC_FORMULA,
  DEFAULT_DISTANCE_TIERS,
  DEFAULT_INSTALLATION_OPTION_PRICES,
  DEFAULT_SOLAR_INSTALL_FORMULA,
  DEFAULT_STC_FORMULA,
  SOLAR_INSTALL_RATE_CENTS_PER_WATT,
  calculateSolarInstallationDollars,
  evalCalcFormula,
  getDistanceDeliveryCost,
  pickStatePrice,
  resolveBatteryInstallDollars,
  resolveOptionFeeCategoryKeys,
  sumOptionFeeForSelection,
  type BatteryInstallTier,
  type InstallationOptionPrices,
  type OptionFeeCategoryKey,
} from "@constants/calculator.constants";
import { ensureCalculatorCatalogSeeded } from "../data/calculatorCatalog.seed";
import {
  calculatorBrandRepository,
  calculatorCategoryRepository,
  calculatorExtraRepository,
  calculatorProductRepository,
  calculatorSettingsRepository,
} from "@repositories";

const DEFAULT_CALCULATOR_GUIDELINES = [
  "Set the customer's location first — prices and rebates vary by state.",
  "Add products by category from the picker; you can add a battery, inverter and more in one session.",
  "GST is calculated on the full price first, then rebates are deducted from the GST-inclusive amount.",
  "Manage products, brands, prices and fees from the Catalog admin tab.",
];

export async function getOrCreateCalculatorSettings() {
  let settings = await calculatorSettingsRepository.findOne({ id: 1 });
  if (!settings) {
    settings = await calculatorSettingsRepository.create({ id: 1 });
  }
  if (!settings.distance_tiers?.length) {
    settings = await calculatorSettingsRepository.updateById(1, {
      $set: { distance_tiers: DEFAULT_DISTANCE_TIERS },
    });
  }
  if (!settings.guidelines?.length) {
    settings = await calculatorSettingsRepository.updateById(1, {
      $set: { guidelines: DEFAULT_CALCULATOR_GUIDELINES },
    });
  }
  // Seed STC/BSTC rebate defaults for existing settings that predate these fields.
  const rebateDefaults: Record<string, number | string | object> = {};
  if (settings.stc_price == null) rebateDefaults.stc_price = 39;
  if (!settings.stc_formula) rebateDefaults.stc_formula = DEFAULT_STC_FORMULA;
  if (!settings.bstc_formula) rebateDefaults.bstc_formula = DEFAULT_BSTC_FORMULA;
  if (!settings.solar_install_formula) rebateDefaults.solar_install_formula = DEFAULT_SOLAR_INSTALL_FORMULA;
  if (!settings.battery_install_tiers?.length) {
    rebateDefaults.battery_install_tiers = DEFAULT_BATTERY_INSTALL_TIERS;
  }
  if (!settings.installation_option_prices?.solar) {
    rebateDefaults.installation_option_prices = DEFAULT_INSTALLATION_OPTION_PRICES;
  }
  if (settings.panel_removal_cost_per_panel == null) {
    rebateDefaults.panel_removal_cost_per_panel = CALCULATOR_DEFAULTS.panel_removal_cost_per_panel;
  }
  const installRates = settings.solar_install_cents_per_watt as
    | { vic?: number; nsw?: number; act?: number }
    | undefined;
  if (
    !installRates ||
    (Number(installRates.vic) || 0) + (Number(installRates.nsw) || 0) + (Number(installRates.act) || 0) <= 0
  ) {
    rebateDefaults.solar_install_cents_per_watt = {
      vic: SOLAR_INSTALL_RATE_CENTS_PER_WATT,
      nsw: SOLAR_INSTALL_RATE_CENTS_PER_WATT,
      act: SOLAR_INSTALL_RATE_CENTS_PER_WATT,
    };
  }
  if (Object.keys(rebateDefaults).length) {
    settings = await calculatorSettingsRepository.updateById(1, { $set: rebateDefaults });
  }
  return settings;
}

export async function getCalculatorCatalog() {
  await ensureCalculatorCatalogSeeded();
  const [settings, categories, brands, extras, products] = await Promise.all([
    getOrCreateCalculatorSettings(),
    calculatorCategoryRepository.find({ active: true }, { sort: { sort_order: 1, name: 1 }, lean: true }),
    calculatorBrandRepository.find({ active: true }, { sort: { sort_order: 1, name: 1 }, lean: true }),
    calculatorExtraRepository.find({ active: true }, { sort: { sort_order: 1, label: 1 }, lean: true }),
    calculatorProductRepository.find({ active: true }, { sort: { sort_order: 1, name: 1 }, lean: true }),
  ]);

  const brandsByCategory = brands.reduce<Record<number, any[]>>((acc, b: any) => {
    if (!acc[b.category_id]) acc[b.category_id] = [];
    acc[b.category_id].push(b);
    return acc;
  }, {});

  const categoriesWithBrands = categories.map((c: any) => ({
    ...c,
    brands: brandsByCategory[c.id] || [],
  }));

  return {
    settings,
    states: settings.states || [],
    categories: categoriesWithBrands,
    extras,
    products,
  };
}

export type CalculatorLineItem = {
  product_id: number;
  variant_index?: number;
  quantity?: number;
};

/** Ad-hoc quote catalog lines (no calculator_products id required). */
export type QuoteEstimateLine = {
  id?: string;
  name?: string;
  category?: string;
  quantity?: number;
  /** Unit supply & install price from the quote catalog */
  unit_price?: number;
  capacity?: string;
  model?: string;
};

export type EstimateInput = {
  state: string;
  category_id?: number;
  brand_id?: number;
  product_id?: number;
  variant_index?: number;
  line_items?: CalculatorLineItem[];
  /** Quote form products — priced/sized without calculator catalog IDs */
  quote_lines?: QuoteEstimateLine[];
  phase?: "single" | "three";
  story_type?: string;
  coupling?: "ac" | "dc";
  garage_installation?: boolean;
  distance_km?: number;
  sub_board_upgrade?: boolean;
  critical_installation?: boolean;
  extra_wiring_meters?: number;
  /** When true, charge panel_removal_count × cost per panel */
  panel_removal?: boolean;
  panel_removal_count?: number;
  /** Optional override; defaults to settings.panel_removal_cost_per_panel */
  panel_removal_cost_per_panel?: number;
  selected_extras?: number[];
  rebates?: Record<string, number>;
  include_sales_commission?: boolean;
  /** When false, skip distance/delivery charges (quotes). Default true. */
  include_delivery?: boolean;
  sales_commission?: number;
  emi_months?: number;
  emi_interest_rate?: number;
  pre_approval?: boolean;
  grid_connection?: boolean;
  discount_enabled?: boolean;
  discount_note?: string;
  solar_vic_rebate_enabled?: boolean;
  solar_vic_loan_enabled?: boolean;
  /** When true, use installation_cost instead of auto ¢/W solar install */
  installation_manual_override?: boolean;
  /** Manual solar installation $ (used when installation_manual_override is true) */
  installation_cost?: number;
  /** When true, use battery_installation_cost instead of kWh tier auto */
  battery_installation_manual_override?: boolean;
  /** Manual battery installation $ (used when battery_installation_manual_override is true) */
  battery_installation_cost?: number;
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

type RebateConfig = { price: number; stcFormula: string; bstcFormula: string };

/** STC quantity/value from the editable formula (variable `kw` = total solar size). */
export function computeStc(systemKw: number, cfg: RebateConfig): { qty: number; value: number } {
  const kw = Number(systemKw) || 0;
  if (kw <= 0) return { qty: 0, value: 0 };
  const qty = Math.max(0, Math.floor(evalCalcFormula(cfg.stcFormula, { kw })));
  return { qty, value: round(qty * cfg.price) };
}

/** BSTC quantity/value from the editable formula (variable `kwh` = total battery size). */
export function computeBstc(batteryKwh: number, cfg: RebateConfig): { qty: number; value: number } {
  const kwh = Number(batteryKwh) || 0;
  if (kwh <= 0) return { qty: 0, value: 0 };
  const qty = Math.max(0, Math.floor(evalCalcFormula(cfg.bstcFormula, { kwh })));
  return { qty, value: round(qty * cfg.price) };
}

/** Parse a battery size (kWh) from free text like "10kWh", "10 kWh", "10kw". */
function parseBatteryKwhFromText(...parts: Array<string | null | undefined>): number {
  for (const part of parts) {
    const text = String(part || "").trim();
    if (!text) continue;
    // Prefer explicit kWh match; also accept "kW" for batteries where catalogs misuse the unit.
    const match = text.match(/(\d+(?:\.\d+)?)\s*k\s*w?h?/i) || text.match(/(\d+(?:\.\d+)?)/);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

/**
 * Resolve usable battery kWh for BSTC.
 * Prefer `battery_kwh`. For battery-only products, fall back to `size_kw` / capacity / label
 * because admins often put the pack size in the Size (kW) field.
 */
function resolveBatteryKwh(
  variant: any,
  opts: { hasBstc: boolean; hasStc: boolean },
): number {
  const explicit = Number(variant?.battery_kwh) || 0;
  if (explicit > 0) return explicit;

  const fromText = parseBatteryKwhFromText(variant?.capacity, variant?.label);
  if (fromText > 0) return fromText;

  // Battery-only category: Size (kW) is commonly used for pack kWh.
  if (opts.hasBstc && !opts.hasStc) {
    const sizeFallback = Number(variant?.size_kw) || 0;
    if (sizeFallback > 0) return sizeFallback;
  }

  return 0;
}

async function resolveLineItemCosts(
  items: CalculatorLineItem[],
  state: string,
  rebateConfig: RebateConfig,
): Promise<{
  productCost: number;
  installationCost: number;
  stcRebate: number;
  bstcRebate: number;
  stcQty: number;
  bstcQty: number;
  totalSolarKw: number;
  totalBatteryKwh: number;
  optionFeeCategories: OptionFeeCategoryKey[];
  productName: string;
  variantLabel: string;
  lineItemsBreakdown: Array<{
    product_id: number;
    productName: string;
    variantLabel: string;
    quantity: number;
    productCost: number;
    installationCost: number;
    stcRebate: number;
    bstcRebate: number;
    stcQty: number;
    systemKw: number;
  }>;
}> {
  let productCost = 0;
  let installationCost = 0;
  // STC is computed on the AGGREGATE solar system size (floored once), not per unit,
  // because e.g. 10 × 475W panels = 4.75 kW → 28 STCs (not 10 × floor(0.475 …)).
  let totalSolarKw = 0;
  let manualStcSum = 0;
  // BSTC is looked up from the AGGREGATE battery size (kWh) — the table is non-linear.
  let totalBatteryKwh = 0;
  let manualBstcSum = 0;
  const optionFeeCategorySet = new Set<OptionFeeCategoryKey>();
  const labels: string[] = [];
  const lineItemsBreakdown: Array<{
    product_id: number;
    productName: string;
    variantLabel: string;
    quantity: number;
    productCost: number;
    installationCost: number;
    stcRebate: number;
    bstcRebate: number;
    stcQty: number;
    systemKw: number;
  }> = [];

  for (const item of items) {
    const qty = item.quantity ?? 1;
    const product: any = await calculatorProductRepository.findOne({ id: item.product_id }, { lean: true });
    if (!product) continue;

    const vi = item.variant_index ?? 0;
    const variant = product.variants?.[vi];
    if (!variant) continue;

    const category: any = product.category_id
      ? await calculatorCategoryRepository.findOne({ id: product.category_id }, { lean: true })
      : null;
    const rebateOpts = new Set<string>((category?.rebate_options ?? []).map((k: string) => String(k).toLowerCase()));
    const catKey = String(category?.slug || category?.name || "").toLowerCase();
    const looksLikeBattery = catKey.includes("battery");
    const looksLikeSolar = catKey.includes("solar") && !looksLikeBattery;
    const hasBstc = rebateOpts.has("bstc") || looksLikeBattery;
    const hasStc = rebateOpts.has("stc") || looksLikeSolar || (!hasBstc && rebateOpts.size === 0);
    // Pure battery categories often store pack size in size_kw by mistake.
    const batteryOnly = hasBstc && !rebateOpts.has("stc") && !looksLikeSolar;

    for (const k of resolveOptionFeeCategoryKeys(catKey || category?.name || "")) {
      optionFeeCategorySet.add(k);
    }

    const itemProductCost = round(pickStatePrice(variant.prices, state) * qty);
    const itemInstallationCost = round(pickStatePrice(variant.installation_prices, state) * qty);

    // System size may be stored in kW (e.g. 6.6) for full systems or in WATTS
    // (e.g. 475) for individual panels — normalize anything ≥ 100 to kW.
    // Do not treat battery-only size_kw as solar STC input.
    const rawSize = batteryOnly ? 0 : Number(variant.size_kw) || 0;
    const unitKw = rawSize >= 100 ? rawSize / 1000 : rawSize;
    const lineKw = round(unitKw * qty);

    // STC: auto-calculated from aggregate system size unless a manual override is set.
    const manualStc = Number(variant.stc_rebate) || 0;
    if (manualStc > 0) {
      manualStcSum += round(manualStc * qty);
    } else if (unitKw > 0 && (hasStc || !hasBstc)) {
      totalSolarKw += unitKw * qty;
    }

    // BSTC: aggregate battery kWh unless a manual override is set.
    const batteryKwh = resolveBatteryKwh(variant, { hasBstc, hasStc });
    const manualBstc = Number(variant.bstc_rebate) || 0;
    if (manualBstc > 0) {
      manualBstcSum += round(manualBstc * qty);
    } else if (batteryKwh > 0 && (hasBstc || Number(variant.battery_kwh) > 0)) {
      totalBatteryKwh += batteryKwh * qty;
    }

    productCost += itemProductCost;
    installationCost += itemInstallationCost;
    labels.push(`${product.name} · ${variant.label}${qty > 1 ? ` ×${qty}` : ""}`);

    lineItemsBreakdown.push({
      product_id: item.product_id,
      productName: product.name,
      variantLabel: variant.label,
      quantity: qty,
      productCost: itemProductCost,
      installationCost: itemInstallationCost,
      stcRebate: 0,
      bstcRebate: 0,
      stcQty: 0,
      systemKw: lineKw,
    });
  }

  const autoStc = computeStc(totalSolarKw, rebateConfig);
  const stcRebate = round(autoStc.value + manualStcSum);
  const stcQty = autoStc.qty;

  const autoBstc = computeBstc(totalBatteryKwh, rebateConfig);
  const bstcQty = autoBstc.qty;
  const bstcRebate = round(autoBstc.value + manualBstcSum);

  return {
    productCost,
    installationCost,
    stcRebate,
    bstcRebate,
    bstcQty,
    stcQty,
    totalSolarKw: round(totalSolarKw),
    totalBatteryKwh: round(totalBatteryKwh),
    optionFeeCategories: [...optionFeeCategorySet],
    productName: labels.join(", "),
    variantLabel: "",
    lineItemsBreakdown,
  };
}

function classifyQuoteCategory(category?: string): {
  looksLikeBattery: boolean;
  looksLikeSolar: boolean;
  looksLikeInverter: boolean;
  optionKeys: OptionFeeCategoryKey[];
} {
  const cat = String(category || "").toUpperCase();
  const looksLikeBattery = cat.includes("BATTERY");
  const looksLikeSolar =
    cat.includes("SOLAR") || cat === "PANEL" || cat.includes("PANEL");
  const looksLikeInverter = cat.includes("INVERTER");
  // Map quote PANEL / SOLAR_PANEL → "solar" so install option fees resolve.
  const feeSlug = looksLikeBattery
    ? "battery"
    : looksLikeInverter
      ? "inverter"
      : looksLikeSolar
        ? "solar"
        : cat.toLowerCase();
  const optionKeys = resolveOptionFeeCategoryKeys(feeSlug);
  return { looksLikeBattery, looksLikeSolar, looksLikeInverter, optionKeys };
}

function parseKwFromCapacityLabel(...parts: Array<string | null | undefined>): number {
  for (const part of parts) {
    const text = String(part || "").trim();
    if (!text) continue;
    const match = text.match(/(\d+(?:\.\d+)?)/);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    // ≥ 100 treated as watts → kW (same as calculator catalog panels)
    return value >= 100 ? value / 1000 : value;
  }
  return 0;
}

/**
 * Cost + STC/BSTC sizing from quote catalog lines (products collection),
 * so the quote form can drive the same engine without calculator_product ids.
 */
function resolveQuoteLineCosts(
  items: QuoteEstimateLine[],
  rebateConfig: RebateConfig,
): {
  productCost: number;
  stcRebate: number;
  bstcRebate: number;
  stcQty: number;
  bstcQty: number;
  totalSolarKw: number;
  totalBatteryKwh: number;
  optionFeeCategories: OptionFeeCategoryKey[];
  productName: string;
  lineItemsBreakdown: Array<{
    product_id: number;
    productName: string;
    variantLabel: string;
    quantity: number;
    productCost: number;
    installationCost: number;
    stcRebate: number;
    bstcRebate: number;
    stcQty: number;
    systemKw: number;
  }>;
} {
  let productCost = 0;
  let totalSolarKw = 0;
  let totalBatteryKwh = 0;
  const optionFeeCategorySet = new Set<OptionFeeCategoryKey>();
  const labels: string[] = [];
  const lineItemsBreakdown: Array<{
    product_id: number;
    productName: string;
    variantLabel: string;
    quantity: number;
    productCost: number;
    installationCost: number;
    stcRebate: number;
    bstcRebate: number;
    stcQty: number;
    systemKw: number;
  }> = [];

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const { looksLikeBattery, looksLikeSolar, optionKeys } = classifyQuoteCategory(item.category);
    for (const k of optionKeys) optionFeeCategorySet.add(k);

    const unitPrice = Number(item.unit_price) || 0;
    const itemProductCost = round(unitPrice * qty);
    productCost += itemProductCost;

    const sizeLabel = item.capacity || item.model || "";
    let lineKw = 0;
    if (looksLikeSolar && !looksLikeBattery) {
      const unitKw = parseKwFromCapacityLabel(sizeLabel);
      lineKw = round(unitKw * qty);
      if (unitKw > 0) totalSolarKw += unitKw * qty;
    } else if (looksLikeBattery) {
      const unitKwh = parseBatteryKwhFromText(item.capacity, item.model, item.name);
      if (unitKwh > 0) totalBatteryKwh += unitKwh * qty;
    }

    const name = String(item.name || "Item").trim();
    labels.push(`${name}${qty > 1 ? ` ×${qty}` : ""}`);
    lineItemsBreakdown.push({
      product_id: 0,
      productName: name,
      variantLabel: sizeLabel || "",
      quantity: qty,
      productCost: itemProductCost,
      installationCost: 0,
      stcRebate: 0,
      bstcRebate: 0,
      stcQty: 0,
      systemKw: lineKw,
    });
  }

  const autoStc = computeStc(totalSolarKw, rebateConfig);
  const autoBstc = computeBstc(totalBatteryKwh, rebateConfig);

  return {
    productCost,
    stcRebate: autoStc.value,
    bstcRebate: autoBstc.value,
    stcQty: autoStc.qty,
    bstcQty: autoBstc.qty,
    totalSolarKw: round(totalSolarKw),
    totalBatteryKwh: round(totalBatteryKwh),
    optionFeeCategories: [...optionFeeCategorySet],
    productName: labels.join(", "),
    lineItemsBreakdown,
  };
}

export async function estimateCalculatorPrice(input: EstimateInput) {
  const settings = await getOrCreateCalculatorSettings();
  const state = input.state?.toUpperCase() || "VIC";

  const lineItems: CalculatorLineItem[] =
    input.line_items?.length
      ? input.line_items
      : input.product_id
        ? [{ product_id: input.product_id, variant_index: input.variant_index, quantity: 1 }]
        : [];

  const rebateConfig = {
    price: Number(settings.stc_price ?? 39),
    stcFormula: settings.stc_formula || DEFAULT_STC_FORMULA,
    bstcFormula: settings.bstc_formula || DEFAULT_BSTC_FORMULA,
  };

  const catalogCosts = await resolveLineItemCosts(lineItems, state, rebateConfig);
  const quoteCosts =
    input.quote_lines?.length
      ? resolveQuoteLineCosts(input.quote_lines, rebateConfig)
      : null;

  const productCost = round(catalogCosts.productCost + (quoteCosts?.productCost || 0));
  const lineInstallationCost = catalogCosts.installationCost;
  // Aggregate kW/kWh across catalogs, then floor STC/BSTC once (same as calculator UI).
  const totalSolarKw = round(catalogCosts.totalSolarKw + (quoteCosts?.totalSolarKw || 0));
  const totalBatteryKwh = round(catalogCosts.totalBatteryKwh + (quoteCosts?.totalBatteryKwh || 0));
  const autoStcMerged = computeStc(totalSolarKw, rebateConfig);
  const autoBstcMerged = computeBstc(totalBatteryKwh, rebateConfig);
  // Catalog may include per-variant manual STC/BSTC overrides on top of auto sizing.
  const catalogAutoStc = computeStc(catalogCosts.totalSolarKw, rebateConfig).value;
  const catalogAutoBstc = computeBstc(catalogCosts.totalBatteryKwh, rebateConfig).value;
  const catalogManualStc = Math.max(0, round(catalogCosts.stcRebate - catalogAutoStc));
  const catalogManualBstc = Math.max(0, round(catalogCosts.bstcRebate - catalogAutoBstc));
  const variantStcRebate = round(autoStcMerged.value + catalogManualStc);
  const variantBstcRebate = round(autoBstcMerged.value + catalogManualBstc);
  const variantStcQty = autoStcMerged.qty;
  const variantBstcQty = autoBstcMerged.qty;
  const optionFeeCategoriesFromLines = [
    ...catalogCosts.optionFeeCategories,
    ...(quoteCosts?.optionFeeCategories || []),
  ].filter((v, i, arr) => arr.indexOf(v) === i);
  const productName = [catalogCosts.productName, quoteCosts?.productName].filter(Boolean).join(", ");
  const variantLabel = catalogCosts.variantLabel;
  const lineItemsBreakdown = [
    ...catalogCosts.lineItemsBreakdown,
    ...(quoteCosts?.lineItemsBreakdown || []),
  ];

  // Also include picker category when products aren't added yet (or extras-only).
  let optionFeeCategories = [...optionFeeCategoriesFromLines];
  if (input.category_id) {
    const cat: any = await calculatorCategoryRepository.findOne({ id: input.category_id }, { lean: true });
    if (cat) {
      const keys = resolveOptionFeeCategoryKeys(cat.slug || cat.name || "");
      for (const k of keys) {
        if (!optionFeeCategories.includes(k)) optionFeeCategories.push(k);
      }
    }
  }

  const solarInstallRateCents = (() => {
    const fromSettings = pickStatePrice(settings.solar_install_cents_per_watt, state);
    return fromSettings > 0 ? fromSettings : SOLAR_INSTALL_RATE_CENTS_PER_WATT;
  })();
  const solarInstallFormula = String(settings.solar_install_formula || "").trim() || DEFAULT_SOLAR_INSTALL_FORMULA;

  const autoSolarInstall = calculateSolarInstallationDollars(
    totalSolarKw,
    solarInstallRateCents,
    solarInstallFormula,
  );

  const batteryInstallTiers: BatteryInstallTier[] =
    Array.isArray(settings.battery_install_tiers) && settings.battery_install_tiers.length
      ? (settings.battery_install_tiers as BatteryInstallTier[])
      : DEFAULT_BATTERY_INSTALL_TIERS;
  const autoBattery = resolveBatteryInstallDollars(totalBatteryKwh, state, batteryInstallTiers);
  const autoBatteryInstall = autoBattery.amount;
  const batteryInstallTierLabel = autoBattery.label;

  let solarInstallCost = 0;
  if (input.installation_manual_override) {
    solarInstallCost = round(Number(input.installation_cost) || 0);
  } else if (autoSolarInstall > 0) {
    solarInstallCost = autoSolarInstall;
  }

  let batteryInstallCost = 0;
  if (input.battery_installation_manual_override) {
    batteryInstallCost = round(Number(input.battery_installation_cost) || 0);
  } else if (autoBatteryInstall > 0) {
    batteryInstallCost = autoBatteryInstall;
  }

  let installationCost = round(solarInstallCost + batteryInstallCost);
  if (installationCost <= 0) {
    installationCost = lineInstallationCost;
  }

  const optionPrices = (settings.installation_option_prices ||
    DEFAULT_INSTALLATION_OPTION_PRICES) as InstallationOptionPrices;
  const phaseChoice = input.phase === "three" ? "three" : "single";
  const storyChoice = ["single", "double", "multi"].includes(String(input.story_type || ""))
    ? String(input.story_type)
    : "single";
  const couplingChoice = input.coupling === "ac" ? "ac" : "dc";

  const phaseOptionFee = sumOptionFeeForSelection(
    optionPrices,
    optionFeeCategories,
    "phase",
    phaseChoice,
    state,
  );
  const storyOptionFee = sumOptionFeeForSelection(
    optionPrices,
    optionFeeCategories,
    "story",
    storyChoice,
    state,
  );
  const couplingOptionFee = sumOptionFeeForSelection(
    optionPrices,
    optionFeeCategories,
    "coupling",
    couplingChoice,
    state,
  );
  const installationOptionsCost = round(phaseOptionFee + storyOptionFee + couplingOptionFee);
  const installationOptionsBreakdown = [
    phaseOptionFee > 0
      ? {
          key: "phase",
          label: phaseChoice === "three" ? "Three phase" : "Single phase",
          amount: phaseOptionFee,
        }
      : null,
    storyOptionFee > 0
      ? {
          key: "story",
          label:
            storyChoice === "double"
              ? "Double storey"
              : storyChoice === "multi"
                ? "Multi storey"
                : "Single storey",
          amount: storyOptionFee,
        }
      : null,
    couplingOptionFee > 0
      ? {
          key: "coupling",
          label: couplingChoice === "ac" ? "AC couple" : "DC couple",
          amount: couplingOptionFee,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; amount: number }[];

  const deliveryBase = pickStatePrice(settings.delivery_base, state);
  const distanceDelivery =
    input.include_delivery === false
      ? { cost: 0, tier: null, label: "" }
      : getDistanceDeliveryCost(
          input.distance_km ?? 1,
          settings.distance_tiers,
          state,
          deliveryBase,
        );
  const deliveryCost = round(distanceDelivery.cost);
  const distanceTierLabel = distanceDelivery.label;

  let extrasCost = 0;
  const extrasBreakdown: { id: number; label: string; amount: number }[] = [];
  if (input.selected_extras?.length) {
    for (const extraId of input.selected_extras) {
      const extra: any = await calculatorExtraRepository.findOne({ id: extraId }, { lean: true });
      if (extra) {
        const amount = pickStatePrice(extra.prices, state);
        extrasCost += amount;
        extrasBreakdown.push({ id: extra.id, label: extra.label, amount });
      }
    }
  }

  // Install add-ons (not catalog extras) — shown as their own lines in the estimate.
  const subBoardUpgradeCost = input.sub_board_upgrade
    ? pickStatePrice(settings.sub_board_upgrade, state)
    : 0;
  const criticalInstallationCost = input.critical_installation
    ? pickStatePrice(settings.critical_installation, state)
    : 0;
  const garageInstallationCost = input.garage_installation
    ? pickStatePrice(settings.garage_installation, state)
    : 0;

  const panelRemovalRate =
    input.panel_removal_cost_per_panel != null
      ? Number(input.panel_removal_cost_per_panel)
      : Number(settings.panel_removal_cost_per_panel ?? CALCULATOR_DEFAULTS.panel_removal_cost_per_panel);
  const panelRemovalCount =
    input.panel_removal && Number(input.panel_removal_count) > 0 ? Math.floor(Number(input.panel_removal_count)) : 0;
  const panelRemovalCost =
    panelRemovalCount > 0 ? round(panelRemovalCount * Math.max(0, panelRemovalRate)) : 0;

  const installAddonsCost = round(
    subBoardUpgradeCost + criticalInstallationCost + garageInstallationCost + panelRemovalCost,
  );

  const freeM = settings.extra_wiring_free_meters ?? 10;
  const rate = settings.extra_wiring_rate_per_m ?? 20;
  const wiringM = input.extra_wiring_meters ?? 0;
  const wiringCost = wiringM > freeM ? round((wiringM - freeM) * rate) : 0;

  let stateFees = 0;
  if ((state === "NSW" || state === "ACT") && input.pre_approval) {
    stateFees += pickStatePrice(settings.pre_approval, state);
  }
  if ((state === "NSW" || state === "ACT") && input.grid_connection) {
    stateFees += pickStatePrice(settings.grid_connection, state);
  }

  const salesCommission =
    input.include_sales_commission !== false
      ? input.sales_commission ?? settings.default_sales_commission ?? 250
      : 0;

  const profitMargin =
    state === "VIC" ? settings.profit_margin_vic ?? 2000 : settings.profit_margin_nsw_act ?? 2300;

  const rebates: Record<string, number> = { ...(input.rebates || {}) };

  // STC (solar) and BSTC (battery) rebates are read from the selected product
  // variants. Variant values take priority over any manual entry.
  if (variantStcRebate > 0) rebates.stc = variantStcRebate;
  if (variantBstcRebate > 0) rebates.bstc = variantBstcRebate;

  const solarVicBlocked = state === "NSW" || state === "ACT";

  // Solar VIC toggles apply admin-configured default amounts (VIC only).
  if (!solarVicBlocked) {
    if (input.solar_vic_rebate_enabled) {
      rebates.solar_vic_rebate = Number(settings.solar_vic_rebate ?? 1400);
    }
    if (input.solar_vic_loan_enabled) {
      rebates.solar_vic_interest_free_loan = Number(settings.solar_vic_interest_free_loan ?? 1400);
    }
  }

  const totalRebate = round(
    Object.values(rebates).reduce((s, v) => s + (Number(v) || 0), 0),
  );

  const effectiveRebate =
    totalRebate - (solarVicBlocked ? Number(rebates.solar_vic || 0) : 0);

  const subtotalBeforeRebate = round(
    productCost +
      installationCost +
      installationOptionsCost +
      deliveryCost +
      salesCommission +
      profitMargin +
      extrasCost +
      installAddonsCost +
      wiringCost +
      stateFees,
  );

  // Auto-detect a discount tier by matching the pre-GST subtotal against the
  // admin-configured price ranges. Applied before GST.
  let discountAmount = 0;
  let discountLabel = "";
  const discountTiers: any[] = Array.isArray(settings.discount_tiers) ? settings.discount_tiers : [];
  if (input.discount_enabled && discountTiers.length) {
    const tier = discountTiers.find((t: any) => {
      const min = Number(t.min_price) || 0;
      const max = Number(t.max_price) || 0;
      return subtotalBeforeRebate >= min && (max <= 0 || subtotalBeforeRebate <= max);
    });
    if (tier) {
      discountAmount =
        tier.type === "flat"
          ? round(Number(tier.value) || 0)
          : round(subtotalBeforeRebate * ((Number(tier.value) || 0) / 100));
      discountAmount = Math.min(discountAmount, subtotalBeforeRebate);
      discountLabel =
        tier.label ||
        (tier.type === "flat" ? `$${tier.value} discount` : `${tier.value}% discount`);
    }
  }
  const subtotalAfterDiscount = round(Math.max(0, subtotalBeforeRebate - discountAmount));

  const gstRate = settings.gst_rate ?? 0.1;
  // GST is calculated on the (discounted) full price BEFORE any rebate is applied.
  const gstAmount = round(subtotalAfterDiscount * gstRate);
  const priceWithGst = round(subtotalAfterDiscount + gstAmount);
  // Rebate is deducted AFTER GST — from the GST-inclusive price.
  const customerOutOfPocket = round(Math.max(0, priceWithGst - effectiveRebate));
  const afterRebate = customerOutOfPocket;

  let emiMonthly: number | null = null;
  if (input.emi_months && input.emi_months > 0) {
    const principal = customerOutOfPocket;
    const rate = (input.emi_interest_rate ?? 0) / 100 / 12;
    if (rate <= 0) {
      emiMonthly = round(principal / input.emi_months);
    } else {
      emiMonthly = round(
        (principal * rate * Math.pow(1 + rate, input.emi_months)) /
          (Math.pow(1 + rate, input.emi_months) - 1),
      );
    }
  }

  return {
    state,
    productName,
    variantLabel,
    lineItemsBreakdown,
    breakdown: {
      productCost,
      installationCost,
      installationOptionsCost,
      installationOptionsBreakdown,
      optionFeeCategories,
      deliveryCost,
      distanceTierLabel,
      salesCommission,
      profitMargin,
      extrasCost,
      wiringCost,
      installAddonsCost,
      garageInstallationCost,
      criticalInstallationCost,
      subBoardUpgradeCost,
      panelRemovalCost,
      panelRemovalCount,
      panelRemovalCostPerPanel: panelRemovalRate,
      stateFees,
      extrasBreakdown,
      stcQty: variantStcQty,
      bstcQty: variantBstcQty,
      stcPrice: rebateConfig.price,
      solarKw: totalSolarKw,
      batteryKwh: totalBatteryKwh,
      autoSolarInstall,
      solarInstallCost,
      solarInstallRateCents,
      solarInstallFormula,
      installationManualOverride: !!input.installation_manual_override,
      autoBatteryInstall,
      batteryInstallCost,
      batteryInstallTierLabel,
      batteryInstallationManualOverride: !!input.battery_installation_manual_override,
      subtotalBeforeRebate,
      discountEnabled: !!input.discount_enabled,
      discountAmount,
      discountLabel,
      discountNote: input.discount_note || "",
      subtotalAfterDiscount,
      rebates,
      totalRebate: effectiveRebate,
      priceWithGst,
      afterRebate,
      gstRate,
      gstAmount,
      customerOutOfPocket,
      emiMonthly,
      emiMonths: input.emi_months ?? null,
    },
    formula:
      state === "VIC"
        ? "(Products + Installation + Delivery + Commission + $2000 margin + Extras) + GST − Rebates"
        : "(Products + Installation + Delivery + Commission + $2300 margin + Extras + NSW/ACT fees) + GST − Rebates",
  };
}

export { pickStatePrice, getDistanceDeliveryCost, resolveDistanceTier } from "@constants/calculator.constants";
export { DEFAULT_DISTANCE_TIERS } from "@constants/calculator.constants";
