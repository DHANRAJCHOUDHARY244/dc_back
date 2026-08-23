/** AU-wide state price keys used in calculator catalog (VIC … NT). */
export type StatePriceKey = "vic" | "nsw" | "act" | "qld" | "sa" | "wa" | "tas" | "nt";

export const AU_STATE_PRICE_KEYS: StatePriceKey[] = ["vic", "nsw", "act", "qld", "sa", "wa", "tas", "nt"];

export type StatePriceMap = Record<StatePriceKey, number>;

export function emptyStatePrice(fill = 0): StatePriceMap {
  return {
    vic: fill,
    nsw: fill,
    act: fill,
    qld: fill,
    sa: fill,
    wa: fill,
    tas: fill,
    nt: fill,
  };
}

export function normalizeStatePrice(value?: Partial<StatePriceMap> | null): StatePriceMap {
  const out = emptyStatePrice(0);
  if (!value) return out;
  for (const k of AU_STATE_PRICE_KEYS) {
    out[k] = Number(value[k]) || 0;
  }
  return out;
}

export function statePriceKey(code: string): StatePriceKey {
  const c = String(code || "VIC").toUpperCase();
  const map: Record<string, StatePriceKey> = {
    VIC: "vic",
    NSW: "nsw",
    ACT: "act",
    QLD: "qld",
    SA: "sa",
    WA: "wa",
    TAS: "tas",
    NT: "nt",
  };
  return map[c] || "vic";
}

export function pickStatePrice(
  prices: Partial<StatePriceMap> | null | undefined,
  state: string,
): number {
  if (!prices) return 0;
  const key = statePriceKey(state);
  const direct = Number(prices[key] ?? 0);
  if (direct > 0) return direct;
  return Number(prices.vic ?? prices.nsw ?? prices.act ?? 0);
}

export function statePriceAll(amount: number): StatePriceMap {
  return emptyStatePrice(amount);
}

/** When loading legacy VIC/NSW/ACT-only rows, seed QLD/SA/WA/TAS/NT from VIC if missing. */
export function expandLegacyStatePrice(raw?: Partial<StatePriceMap> | null): StatePriceMap {
  const out = normalizeStatePrice(raw);
  const seed = out.vic || out.nsw || out.act || 0;
  for (const k of ["qld", "sa", "wa", "tas", "nt"] as StatePriceKey[]) {
    if (raw?.[k] == null && seed > 0) out[k] = seed;
  }
  return out;
}
