/**
 * Federal Battery STC capacity bands + date windows (mirrors frontend).
 */

export type BatteryStcCapacityBand = {
  min_kwh: number;
  max_kwh: number | null;
  share: number;
};

export type BatteryStcFactorWindow = {
  start_date: string;
  end_date: string;
  factor: number;
};

export const DEFAULT_BATTERY_STC_BANDS: BatteryStcCapacityBand[] = [
  { min_kwh: 0, max_kwh: 14, share: 1 },
  { min_kwh: 14, max_kwh: 28, share: 0.6 },
  { min_kwh: 28, max_kwh: 50, share: 0.15 },
  { min_kwh: 50, max_kwh: null, share: 0 },
];

export const DEFAULT_BATTERY_STC_WINDOWS: BatteryStcFactorWindow[] = [
  { start_date: "2026-05-01", end_date: "2026-12-31", factor: 6.8 },
  { start_date: "2025-01-01", end_date: "2026-04-30", factor: 6.8 },
];

function dayStamp(d?: string | Date | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export function resolveBatteryStcFactor(
  installDate?: string | Date | null,
  windows: BatteryStcFactorWindow[] = DEFAULT_BATTERY_STC_WINDOWS,
): number {
  const day = dayStamp(installDate);
  const match = windows.find((w) => day >= w.start_date && day <= w.end_date);
  if (match) return Number(match.factor) || 0;
  const last = windows[windows.length - 1];
  return Number(last?.factor) || 6.8;
}

export function eligibleBatteryKwhForStc(
  usableKwh: number,
  bands: BatteryStcCapacityBand[] = DEFAULT_BATTERY_STC_BANDS,
): { eligible: number; bands_applied: Array<{ kwh: number; share: number }> } {
  let remaining = Math.max(0, Number(usableKwh) || 0);
  let eligible = 0;
  const bands_applied: Array<{ kwh: number; share: number }> = [];
  const sorted = [...bands].sort((a, b) => a.min_kwh - b.min_kwh);

  for (const band of sorted) {
    if (remaining <= 0) break;
    const upper = band.max_kwh == null ? Infinity : band.max_kwh;
    const span = Math.max(0, upper - band.min_kwh);
    if (span <= 0 && band.max_kwh != null) continue;
    const inBand = band.max_kwh == null ? remaining : Math.min(remaining, span);
    if (inBand <= 0) continue;
    const share = Math.max(0, Number(band.share) || 0);
    eligible += inBand * share;
    bands_applied.push({ kwh: inBand, share });
    remaining -= inBand;
  }

  return { eligible: Math.round(eligible * 1000) / 1000, bands_applied };
}

export function computeBatteryStcWithBands(opts: {
  usableKwh: number;
  installDate?: string | Date | null;
  stcPrice: number;
  bands?: BatteryStcCapacityBand[];
  windows?: BatteryStcFactorWindow[];
}) {
  const price = Number(opts.stcPrice) > 0 ? Number(opts.stcPrice) : 39;
  const factor = resolveBatteryStcFactor(opts.installDate, opts.windows);
  const { eligible, bands_applied } = eligibleBatteryKwhForStc(opts.usableKwh, opts.bands);
  const certificates = Math.max(0, Math.floor(eligible * factor));
  const value = Math.round(certificates * price * 100) / 100;
  return {
    eligible_kwh: eligible,
    factor,
    certificates,
    value,
    price,
    bands_applied,
    formula: `floor(${eligible} kWh × ${factor}) × $${price}`,
  };
}
