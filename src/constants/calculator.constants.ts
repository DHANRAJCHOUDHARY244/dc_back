/** Numeric fallbacks only — catalog data lives in MongoDB */
export const CALCULATOR_DEFAULTS = {
  profit_margin_vic: 2000,
  profit_margin_nsw_act: 2300,
  default_sales_commission: 250,
  extra_wiring_rate_per_m: 20,
  extra_wiring_free_meters: 10,
  panel_removal_cost_per_panel: 30,
  gst_rate: 0.1,
} as const;

export type DistanceTier = {
  min_km: number;
  max_km: number;
  label: string;
  prices: { vic: number; nsw: number; act: number };
};

export const DEFAULT_DISTANCE_TIERS: DistanceTier[] = [
  { min_km: 1, max_km: 50, label: "1–50 km", prices: { vic: 0, nsw: 0, act: 0 } },
  { min_km: 51, max_km: 100, label: "51–100 km", prices: { vic: 0, nsw: 0, act: 0 } },
  { min_km: 101, max_km: 150, label: "101–150 km", prices: { vic: 0, nsw: 0, act: 0 } },
  { min_km: 151, max_km: 200, label: "151–200 km", prices: { vic: 0, nsw: 0, act: 0 } },
  { min_km: 201, max_km: 250, label: "201–250 km", prices: { vic: 0, nsw: 0, act: 0 } },
  { min_km: 251, max_km: 300, label: "251–300 km", prices: { vic: 0, nsw: 0, act: 0 } },
];

// Editable rebate-quantity formulas. `kw` = total solar system size (kW),
// `kwh` = total battery size. Admins can edit these from Catalog admin.
export const DEFAULT_STC_FORMULA = "floor(kw * 1.185 * 5)";
export const DEFAULT_BSTC_FORMULA = "floor(kwh * 6.8)";

/** Solar installation labour: 30 cents per watt default; used as `cents` in the install formula. */
export const SOLAR_INSTALL_RATE_CENTS_PER_WATT = 30;

/**
 * Editable solar install $ formula.
 * Variables: `kw` (system size), `cents` (¢/W for selected state), `watts` (kw*1000), `rate` (cents/100).
 */
export const DEFAULT_SOLAR_INSTALL_FORMULA = "kw * 1000 * (cents / 100)";

export type BatteryInstallTier = {
  max_kwh: number;
  label: string;
  prices: { vic: number; nsw: number; act: number };
};

/**
 * Battery installation (ex GST) by pack size. Defaults match VIC sheet;
 * NSW/ACT start the same and can be edited per location in Catalog admin.
 * • Up to 23kWh – $1500  • Up to 32kWh – $1700
 * • Up to 42kWh – $2000  • Up to 50kWh – $2300
 */
export const DEFAULT_BATTERY_INSTALL_TIERS: BatteryInstallTier[] = [
  { max_kwh: 23, label: "Up to 23kWh", prices: { vic: 1500, nsw: 1500, act: 1500 } },
  { max_kwh: 32, label: "Up to 32kWh", prices: { vic: 1700, nsw: 1700, act: 1700 } },
  { max_kwh: 42, label: "Up to 42kWh", prices: { vic: 2000, nsw: 2000, act: 2000 } },
  { max_kwh: 50, label: "Up to 50kWh", prices: { vic: 2300, nsw: 2300, act: 2300 } },
];

/** Resolve battery install $ (ex GST) from total kWh and location. */
export function resolveBatteryInstallDollars(
  totalKwh: number,
  state: string,
  tiers: BatteryInstallTier[] = DEFAULT_BATTERY_INSTALL_TIERS,
): { amount: number; tier: BatteryInstallTier | null; label: string } {
  const kwh = Number(totalKwh) || 0;
  if (kwh <= 0 || !tiers?.length) return { amount: 0, tier: null, label: "" };
  const sorted = [...tiers].sort((a, b) => a.max_kwh - b.max_kwh);
  let match = sorted.find((t) => kwh <= t.max_kwh) ?? null;
  // Over largest band → use last tier
  if (!match) match = sorted[sorted.length - 1];
  const amount = pickStatePrice(match.prices, state);
  return {
    amount: Math.round(amount * 100) / 100,
    tier: match,
    label: match.label,
  };
}

/**
 * Safely evaluate a simple math formula with the provided variables. Only digits,
 * arithmetic operators, parentheses, commas, dots and lowercase identifiers are
 * allowed; identifiers must resolve to a provided variable or an allowed function
 * (floor, ceil, round, min, max, abs). Anything else returns 0.
 */
export function evalCalcFormula(formula: string, vars: Record<string, number>): number {
  const expr = String(formula || "").trim();
  // Disallow uppercase (blocks globalThis/Function etc.) and any unexpected chars.
  if (!expr || !/^[0-9+\-*/(). ,a-z_]+$/.test(expr)) return 0;
  const scope: Record<string, unknown> = {
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
    ...vars,
  };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(scope), `"use strict"; return (${expr});`);
    const out = fn(...Object.values(scope));
    return Number.isFinite(out) ? Number(out) : 0;
  } catch {
    return 0;
  }
}

/** Evaluate solar install $ from the admin formula (fallback to default ¢/W maths). */
export function calculateSolarInstallationDollars(
  totalKw: number,
  centsPerWatt: number = SOLAR_INSTALL_RATE_CENTS_PER_WATT,
  formula: string = DEFAULT_SOLAR_INSTALL_FORMULA,
): number {
  const kw = Number(totalKw) || 0;
  const cents = Number(centsPerWatt) || 0;
  if (kw <= 0 || cents < 0) return 0;
  const watts = kw * 1000;
  const rate = cents / 100;
  const expr = String(formula || "").trim() || DEFAULT_SOLAR_INSTALL_FORMULA;
  const raw = evalCalcFormula(expr, { kw, cents, watts, rate });
  if (!Number.isFinite(raw) || raw < 0) {
    return Math.round(kw * 1000 * (cents / 100) * 100) / 100;
  }
  return Math.round(raw * 100) / 100;
}

export type CalculatorStateCode = "VIC" | "NSW" | "ACT";

export function statePriceKey(code: string): "vic" | "nsw" | "act" {
  const c = code.toUpperCase();
  if (c === "NSW") return "nsw";
  if (c === "ACT") return "act";
  return "vic";
}

export function pickStatePrice(
  prices: { vic?: number; nsw?: number; act?: number } | null | undefined,
  state: string,
): number {
  if (!prices) return 0;
  return Number(prices[statePriceKey(state)] ?? 0);
}

export function resolveDistanceTier(distanceKm: number, tiers: DistanceTier[]): DistanceTier | null {
  if (!tiers?.length) return null;
  const km = Math.max(1, distanceKm || 1);
  const match = tiers.find((t) => km >= t.min_km && km <= t.max_km);
  if (match) return match;
  const sorted = [...tiers].sort((a, b) => a.min_km - b.min_km);
  if (km < sorted[0].min_km) return sorted[0];
  return sorted[sorted.length - 1];
}

export function getDistanceDeliveryCost(
  distanceKm: number,
  tiers: DistanceTier[] | undefined,
  state: string,
  deliveryBase = 0,
): { cost: number; tier: DistanceTier | null; label: string } {
  const tier = resolveDistanceTier(distanceKm, tiers || DEFAULT_DISTANCE_TIERS);
  if (!tier) {
    return { cost: deliveryBase, tier: null, label: "Delivery" };
  }
  const tierPrice = pickStatePrice(tier.prices, state);
  return {
    cost: tierPrice + deliveryBase,
    tier,
    label: tier.label,
  };
}

/** Categories that use Phase / Story / Coupling priced options */
export type OptionFeeCategoryKey = "solar" | "battery" | "inverter";

export type StatePriceMap = { vic: number; nsw: number; act: number };

export type CategoryOptionFees = {
  phase: { single: StatePriceMap; three: StatePriceMap };
  story: { single: StatePriceMap; double: StatePriceMap; multi: StatePriceMap };
  coupling: { dc: StatePriceMap; ac: StatePriceMap };
};

export type InstallationOptionPrices = Record<OptionFeeCategoryKey, CategoryOptionFees>;

const emptyState = (): StatePriceMap => ({ vic: 0, nsw: 0, act: 0 });

export function emptyCategoryOptionFees(): CategoryOptionFees {
  return {
    phase: { single: emptyState(), three: emptyState() },
    story: { single: emptyState(), double: emptyState(), multi: emptyState() },
    coupling: { dc: emptyState(), ac: emptyState() },
  };
}

export const DEFAULT_INSTALLATION_OPTION_PRICES: InstallationOptionPrices = {
  solar: emptyCategoryOptionFees(),
  battery: emptyCategoryOptionFees(),
  inverter: emptyCategoryOptionFees(),
};

/** Map a catalog category name/slug to option-fee key(s). Combo → solar + battery. */
export function resolveOptionFeeCategoryKeys(categoryNameOrSlug: string): OptionFeeCategoryKey[] {
  const key = String(categoryNameOrSlug || "").toLowerCase();
  if (!key) return [];
  if (key.includes("combo")) return ["solar", "battery"];
  const out: OptionFeeCategoryKey[] = [];
  if (key.includes("solar") && !key.includes("battery")) out.push("solar");
  else if (key.includes("solar")) out.push("solar");
  if (key.includes("battery")) out.push("battery");
  if (key.includes("inverter")) out.push("inverter");
  // Pure solar slug "solar" already handled; if only "solar" in name:
  if (!out.length && key === "solar") out.push("solar");
  return out;
}

export function sumOptionFeeForSelection(
  prices: InstallationOptionPrices | null | undefined,
  categoryKeys: OptionFeeCategoryKey[],
  kind: "phase" | "story" | "coupling",
  choice: string,
  state: string,
): number {
  if (!prices || !categoryKeys.length) return 0;
  let total = 0;
  const choiceKey = String(choice || "").toLowerCase();
  for (const cat of categoryKeys) {
    const block = prices[cat];
    if (!block) continue;
    const group = block[kind] as Record<string, StatePriceMap> | undefined;
    if (!group) continue;
    total += pickStatePrice(group[choiceKey], state);
  }
  return Math.round(total * 100) / 100;
}
