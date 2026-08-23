import {
  DEFAULT_BATTERY_STC_BANDS,
  DEFAULT_BATTERY_STC_WINDOWS,
  computeBatteryStcWithBands,
  type BatteryStcCapacityBand,
  type BatteryStcFactorWindow,
} from "@constants/batteryStc.constants";
import { DEFAULT_STC_FORMULA, evalCalcFormula } from "@constants/calculator.constants";
import { rebateSchemeRepository } from "@repositories";

export type RebateEngineSite = {
  state?: string;
  postcode?: string;
  customer_type?: string;
  occupancy?: string;
  vpp?: boolean;
  vppProvider?: string;
  waNetwork?: string;
  installationDate?: string | Date | null;
  solarVicRebate?: boolean;
  solarVicLoan?: boolean;
  solarVicEligibleConfirmed?: boolean;
  vicHotWaterRebate?: boolean;
  vicHotWaterLocalManufactured?: boolean;
  waBatteryRebateConfirmed?: boolean;
  waInterestFreeLoan?: boolean;
  existingSolar?: boolean;
  batteryInstallType?: string;
  /** Explicit confirmation map keyed by scheme code */
  confirmedSchemes?: Record<string, boolean>;
};

export type RebateEngineProducts = {
  solarKw?: number;
  batteryKwh?: number;
  systemRetail?: number;
  hasHotWater?: boolean;
};

export type RebateEngineSettings = {
  stc_price?: number;
  stc_formula?: string;
  solar_vic_rebate?: number;
  solar_vic_interest_free_loan?: number;
  bstc_bands?: BatteryStcCapacityBand[];
  bstc_windows?: BatteryStcFactorWindow[];
  stc_zone_factor?: number;
};

export type AppliedRebateLine = {
  scheme_code: string;
  scheme_name: string;
  label: string;
  amount: number;
  status: "eligible" | "needs_confirmation" | "not_eligible" | "applied";
  is_loan: boolean;
  explanation: string;
  calc_detail?: string;
};

export type RebateEngineResult = {
  solar_stc: AppliedRebateLine | null;
  battery_stc: AppliedRebateLine | null;
  state_rebates: AppliedRebateLine[];
  vpp_incentives: AppliedRebateLine[];
  finance_lines: AppliedRebateLine[];
  deductions_total: number;
  finance_total: number;
  lines: AppliedRebateLine[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function dayStamp(d?: string | Date | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function inDateWindow(scheme: any, day: string): boolean {
  if (scheme.start_date) {
    const s = dayStamp(scheme.start_date);
    if (day < s) return false;
  }
  if (scheme.end_date) {
    const e = dayStamp(scheme.end_date);
    if (day > e) return false;
  }
  return true;
}

function matchesCustomer(scheme: any, site: RebateEngineSite): boolean {
  const want = String(scheme.customer_type || "any").toLowerCase();
  if (want === "any") return true;
  const got = String(site.customer_type || "Residential").toLowerCase();
  if (want === "residential") return got.includes("residen");
  if (want === "commercial") return got.includes("commer") || got.includes("smb") || got.includes("business");
  return true;
}

function isConfirmed(scheme: any, site: RebateEngineSite): boolean {
  if (!scheme.requires_confirmation) return true;
  const map = site.confirmedSchemes || {};
  if (map[scheme.code] === true) return true;
  // Legacy site toggles
  if (scheme.code === "vic_pv_rebate" && site.solarVicRebate && site.solarVicEligibleConfirmed !== false) {
    return !!site.solarVicRebate;
  }
  if (scheme.code === "vic_pv_loan" && site.solarVicLoan) return true;
  if (scheme.code === "vic_hot_water" && site.vicHotWaterRebate) return true;
  if (scheme.code?.startsWith("wa_battery_") && site.waBatteryRebateConfirmed) return true;
  if (scheme.code === "wa_interest_free_loan" && site.waInterestFreeLoan) return true;
  if (scheme.code === "nsw_vpp_incentive" && site.vpp) return true;
  return false;
}

function computeSchemeAmount(
  scheme: any,
  products: RebateEngineProducts,
  settings: RebateEngineSettings,
  site: RebateEngineSite,
): { amount: number; detail: string } {
  const type = String(scheme.rebate_type || "fixed");
  const unit = Number(scheme.amount) || 0;
  const max = Number(scheme.max_amount) || 0;
  const kwh = Number(products.batteryKwh) || 0;
  const kw = Number(products.solarKw) || 0;
  const retail = Number(products.systemRetail) || 0;
  const stcPrice = Number(settings.stc_price) > 0 ? Number(settings.stc_price) : 39;

  if (type === "fixed") {
    let amount = unit;
    if (scheme.code === "vic_hot_water" && site.vicHotWaterLocalManufactured) {
      amount = Number(scheme.rules?.local_manufactured_amount) || max || unit;
    }
    if (max > 0) amount = Math.min(amount, max);
    return { amount: round2(amount), detail: `Fixed $${amount}` };
  }
  if (type === "per_kwh") {
    let amount = round2(kwh * unit);
    if (max > 0) amount = Math.min(amount, max);
    return { amount, detail: `${kwh} kWh × $${unit}${max ? ` (max $${max})` : ""}` };
  }
  if (type === "percent") {
    let amount = round2((retail * unit) / 100);
    if (max > 0) amount = Math.min(amount, max);
    return { amount, detail: `${unit}% of retail` };
  }
  if (type === "per_stc") {
    const amount = round2(unit * stcPrice);
    return { amount, detail: `${unit} STC × $${stcPrice}` };
  }
  if (type === "solar_stc") {
    const formula = settings.stc_formula || DEFAULT_STC_FORMULA;
    const zone = Number(settings.stc_zone_factor) || Number(scheme.rules?.zone_factor) || 1.185;
    const qty = Math.max(0, Math.floor(evalCalcFormula(formula, { kw, zone })));
    const amount = round2(qty * stcPrice);
    return { amount, detail: `floor(${kw} × zone) → ${qty} × $${stcPrice}` };
  }
  if (type === "battery_stc_bands") {
    const bands: BatteryStcCapacityBand[] =
      Array.isArray(scheme.rules?.bands) && scheme.rules.bands.length
        ? scheme.rules.bands
        : settings.bstc_bands?.length
          ? settings.bstc_bands
          : DEFAULT_BATTERY_STC_BANDS;
    const windows: BatteryStcFactorWindow[] =
      Array.isArray(scheme.rules?.windows) && scheme.rules.windows.length
        ? scheme.rules.windows
        : settings.bstc_windows?.length
          ? settings.bstc_windows
          : DEFAULT_BATTERY_STC_WINDOWS;
    const result = computeBatteryStcWithBands({
      usableKwh: kwh,
      installDate: site.installationDate,
      stcPrice,
      bands,
      windows,
    });
    return { amount: result.value, detail: result.formula };
  }
  return { amount: 0, detail: "" };
}

function gateScheme(
  scheme: any,
  site: RebateEngineSite,
  products: RebateEngineProducts,
): { ok: boolean; status: AppliedRebateLine["status"]; reason: string } {
  if (!scheme.active) return { ok: false, status: "not_eligible", reason: "Inactive" };
  const day = dayStamp(site.installationDate);
  if (!inDateWindow(scheme, day)) return { ok: false, status: "not_eligible", reason: "Outside date window" };
  if (!matchesCustomer(scheme, site)) {
    return { ok: false, status: "not_eligible", reason: "Customer type mismatch" };
  }

  const state = String(site.state || "").toUpperCase();
  if (scheme.jurisdiction === "state") {
    const s = String(scheme.state || "").toUpperCase();
    if (s && s !== "ALL" && s !== state) {
      return { ok: false, status: "not_eligible", reason: `Requires ${s}` };
    }
  }

  if (scheme.vpp_required && !site.vpp) {
    return { ok: false, status: "needs_confirmation", reason: "VPP participation required" };
  }
  if (scheme.retailer_required) {
    const need = String(scheme.retailer_required).toLowerCase();
    const got = String(site.waNetwork || site.vppProvider || "").toLowerCase();
    if (!got.includes(need.split(" ")[0])) {
      return { ok: false, status: "needs_confirmation", reason: `Requires ${scheme.retailer_required}` };
    }
  }

  const kw = Number(products.solarKw) || 0;
  const kwh = Number(products.batteryKwh) || 0;
  if (scheme.min_system_kw > 0 && kw < scheme.min_system_kw) {
    return { ok: false, status: "not_eligible", reason: `Min ${scheme.min_system_kw} kW` };
  }
  if (scheme.max_system_kw > 0 && kw > scheme.max_system_kw) {
    return { ok: false, status: "not_eligible", reason: `Max ${scheme.max_system_kw} kW` };
  }
  if (scheme.min_battery_kwh > 0 && kwh < scheme.min_battery_kwh) {
    return { ok: false, status: "not_eligible", reason: `Min ${scheme.min_battery_kwh} kWh` };
  }
  if (scheme.max_battery_kwh > 0 && kwh > scheme.max_battery_kwh) {
    return { ok: false, status: "not_eligible", reason: `Max ${scheme.max_battery_kwh} kWh` };
  }
  if (scheme.product_type === "hot_water" && !products.hasHotWater && !site.vicHotWaterRebate) {
    return { ok: false, status: "needs_confirmation", reason: "Hot water product / confirmation needed" };
  }
  if (scheme.product_type === "battery" && kwh <= 0) {
    return { ok: false, status: "not_eligible", reason: "No battery capacity" };
  }
  if (scheme.product_type === "solar" && kw <= 0 && scheme.rebate_type !== "fixed") {
    // fixed solar rebates (VIC PV) can still apply with confirmation even if kw unknown
  }

  if (scheme.requires_confirmation && !isConfirmed(scheme, site)) {
    return { ok: false, status: "needs_confirmation", reason: "Awaiting salesperson confirmation" };
  }

  return { ok: true, status: "eligible", reason: "" };
}

/** Evaluate all active schemes for a quote/calculator context. */
export async function evaluateRebates(
  site: RebateEngineSite,
  products: RebateEngineProducts,
  settings: RebateEngineSettings = {},
): Promise<RebateEngineResult> {
  const schemes = await rebateSchemeRepository.find(
    { active: true },
    { sort: { sort_order: 1, id: 1 }, lean: true },
  );

  const lines: AppliedRebateLine[] = [];
  let solar_stc: AppliedRebateLine | null = null;
  let battery_stc: AppliedRebateLine | null = null;
  const state_rebates: AppliedRebateLine[] = [];
  const vpp_incentives: AppliedRebateLine[] = [];
  const finance_lines: AppliedRebateLine[] = [];

  for (const scheme of schemes as any[]) {
    const gate = gateScheme(scheme, site, products);
    const { amount, detail } = computeSchemeAmount(scheme, products, settings, site);

    const line: AppliedRebateLine = {
      scheme_code: scheme.code,
      scheme_name: scheme.name,
      label: scheme.name,
      amount: gate.ok ? amount : 0,
      status: gate.ok ? (isConfirmed(scheme, site) || !scheme.requires_confirmation ? "applied" : "eligible") : gate.status,
      is_loan: !!scheme.is_loan,
      explanation: scheme.explanation || scheme.eligibility_text || gate.reason,
      calc_detail: detail,
    };

    // Always surface federal STCs when product exists (auto, no confirmation)
    if (scheme.rebate_type === "solar_stc" || scheme.code === "federal_solar_stc") {
      if ((Number(products.solarKw) || 0) > 0) {
        const auto = { ...line, amount, status: "applied" as const };
        solar_stc = auto;
        lines.push(auto);
      }
      continue;
    }
    if (scheme.rebate_type === "battery_stc_bands" || scheme.code === "federal_battery_stc") {
      if ((Number(products.batteryKwh) || 0) > 0) {
        const auto = { ...line, amount, status: "applied" as const };
        battery_stc = auto;
        lines.push(auto);
      }
      continue;
    }

    if (!gate.ok) {
      if (gate.status === "needs_confirmation" && amount > 0) {
        lines.push({ ...line, amount: 0, status: "needs_confirmation" });
      }
      continue;
    }

    if (amount <= 0) continue;

    if (scheme.is_loan) {
      finance_lines.push(line);
      lines.push(line);
      continue;
    }

    if (scheme.product_type === "vpp" || scheme.code.includes("vpp")) {
      vpp_incentives.push(line);
    } else {
      state_rebates.push(line);
    }
    lines.push(line);
  }

  // Fallback federal STCs if schemes not seeded yet
  const stcPrice = Number(settings.stc_price) > 0 ? Number(settings.stc_price) : 39;
  if (!solar_stc && (Number(products.solarKw) || 0) > 0) {
    const formula = settings.stc_formula || DEFAULT_STC_FORMULA;
    const qty = Math.max(0, Math.floor(evalCalcFormula(formula, { kw: products.solarKw })));
    const amount = round2(qty * stcPrice);
    if (amount > 0) {
      solar_stc = {
        scheme_code: "federal_solar_stc",
        scheme_name: "Federal Solar STC",
        label: "Solar STC",
        amount,
        status: "applied",
        is_loan: false,
        explanation: "Federal Small-scale Technology Certificates for solar PV.",
        calc_detail: `${qty} × $${stcPrice}`,
      };
      lines.unshift(solar_stc);
    }
  }
  if (!battery_stc && (Number(products.batteryKwh) || 0) > 0) {
    const result = computeBatteryStcWithBands({
      usableKwh: Number(products.batteryKwh) || 0,
      installDate: site.installationDate,
      stcPrice,
      bands: settings.bstc_bands,
      windows: settings.bstc_windows,
    });
    if (result.value > 0) {
      battery_stc = {
        scheme_code: "federal_battery_stc",
        scheme_name: "Federal Battery STC",
        label: "Battery STC",
        amount: result.value,
        status: "applied",
        is_loan: false,
        explanation: "Cheaper Home Batteries STC with capacity bands.",
        calc_detail: result.formula,
      };
      lines.splice(solar_stc ? 1 : 0, 0, battery_stc);
    }
  }

  const deductions_total = round2(
    lines.filter((l) => !l.is_loan && l.amount > 0 && l.status === "applied").reduce((s, l) => s + l.amount, 0),
  );
  const finance_total = round2(finance_lines.reduce((s, l) => s + l.amount, 0));

  return {
    solar_stc,
    battery_stc,
    state_rebates,
    vpp_incentives,
    finance_lines,
    deductions_total,
    finance_total,
    lines,
  };
}

export const DEFAULT_REBATE_SCHEMES = [
  {
    code: "federal_solar_stc",
    name: "Federal Solar STC",
    jurisdiction: "federal",
    state: "",
    product_type: "solar",
    rebate_type: "solar_stc",
    requires_confirmation: false,
    stackable: true,
    eligibility_text: "Applies Australia-wide for eligible solar PV systems.",
    explanation: "STC quantity from system kW × zone factor × deeming years, × certificate price.",
    sort_order: 10,
    active: true,
  },
  {
    code: "federal_battery_stc",
    name: "Federal Battery STC (Cheaper Home Batteries)",
    jurisdiction: "federal",
    state: "",
    product_type: "battery",
    rebate_type: "battery_stc_bands",
    requires_confirmation: false,
    stackable: true,
    eligibility_text: "Capacity bands: 0–14 kWh 100%, 14–28 60%, 28–50 15%, >50 none.",
    explanation: "Eligible kWh × date-based factor (default 6.8 for May–Dec 2026) × STC price.",
    rules: {
      bands: DEFAULT_BATTERY_STC_BANDS,
      windows: DEFAULT_BATTERY_STC_WINDOWS,
    },
    sort_order: 20,
    active: true,
  },
  {
    code: "vic_pv_rebate",
    name: "Solar VIC PV rebate",
    jurisdiction: "state",
    state: "VIC",
    product_type: "solar",
    rebate_type: "fixed",
    amount: 1400,
    max_amount: 1400,
    requires_confirmation: true,
    stackable: true,
    eligibility_text: "Confirm Solar Victoria eligibility (income / prior claim / property rules).",
    explanation: "Instant rebate up to $1,400 for eligible Victorian residential solar.",
    sort_order: 100,
    active: true,
  },
  {
    code: "vic_pv_loan",
    name: "Solar VIC interest-free loan",
    jurisdiction: "state",
    state: "VIC",
    product_type: "solar",
    rebate_type: "fixed",
    amount: 1400,
    max_amount: 1400,
    is_loan: true,
    requires_confirmation: true,
    eligibility_text: "Optional interest-free loan — displayed separately, not deducted from Final Payable.",
    explanation: "Up to $1,400 interest-free loan. Does not reduce the quote final price.",
    sort_order: 110,
    active: true,
  },
  {
    code: "vic_hot_water",
    name: "Solar VIC Hot Water rebate",
    jurisdiction: "state",
    state: "VIC",
    product_type: "hot_water",
    rebate_type: "fixed",
    amount: 1000,
    max_amount: 1400,
    requires_confirmation: true,
    eligibility_text: "Locally manufactured systems may attract up to $1,400.",
    explanation: "Hot water rebate $1,000 (or $1,400 if locally manufactured).",
    rules: { local_manufactured_amount: 1400 },
    sort_order: 120,
    active: true,
  },
  {
    code: "nsw_vpp_incentive",
    name: "NSW VPP incentive",
    jurisdiction: "state",
    state: "NSW",
    product_type: "vpp",
    rebate_type: "fixed",
    amount: 0,
    vpp_required: true,
    requires_confirmation: true,
    eligibility_text: "Configure dollar amount in Admin → Rebates. Requires VPP participation.",
    explanation: "Placeholder NSW VPP upfront incentive — set amount when program terms are known.",
    sort_order: 200,
    active: true,
  },
  {
    code: "wa_battery_synergy",
    name: "WA Battery rebate (Synergy)",
    jurisdiction: "state",
    state: "WA",
    product_type: "battery",
    rebate_type: "per_kwh",
    amount: 130,
    max_amount: 1300,
    vpp_required: true,
    retailer_required: "Synergy",
    requires_confirmation: true,
    eligibility_text: "Synergy network · VPP required · $130/kWh up to $1,300.",
    explanation: "Western Australia Synergy battery rebate.",
    sort_order: 300,
    active: true,
  },
  {
    code: "wa_battery_horizon",
    name: "WA Battery rebate (Horizon Power)",
    jurisdiction: "state",
    state: "WA",
    product_type: "battery",
    rebate_type: "per_kwh",
    amount: 380,
    max_amount: 3800,
    vpp_required: true,
    retailer_required: "Horizon",
    requires_confirmation: true,
    eligibility_text: "Horizon Power · VPP required · $380/kWh up to $3,800.",
    explanation: "Western Australia Horizon Power battery rebate.",
    sort_order: 310,
    active: true,
  },
  {
    code: "wa_interest_free_loan",
    name: "WA no-interest loan",
    jurisdiction: "state",
    state: "WA",
    product_type: "any",
    rebate_type: "fixed",
    amount: 0,
    is_loan: true,
    requires_confirmation: true,
    eligibility_text: "Display-only finance option — configure amount in admin. Never deducted.",
    explanation: "WA interest-free loan shown separately from Final Payable.",
    sort_order: 320,
    active: true,
  },
];

export async function seedDefaultRebateSchemes(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const row of DEFAULT_REBATE_SCHEMES) {
    const existing = await rebateSchemeRepository.findOne({ code: row.code });
    if (existing) {
      skipped += 1;
      continue;
    }
    await rebateSchemeRepository.create(row as any);
    created += 1;
  }
  return { created, skipped };
}
