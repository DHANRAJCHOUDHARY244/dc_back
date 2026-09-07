import { productCategoryConfigRepository } from "@repositories";

const DEFAULT_ICON = "solar:box-bold-duotone";
const DEFAULT_COLOR = "#64748b";
const DEFAULT_GRADIENT = "from-slate-500 to-slate-600";

/** Known Som's Energy product master categories (PDF + CRM). */
const KNOWN_CATEGORY_META: Record<string, { label: string; icon: string; color: string; gradient: string; sort_order: number }> = {
  BATTERY: {
    label: "Battery",
    icon: "solar:battery-charge-bold-duotone",
    color: "#8b5cf6",
    gradient: "from-violet-500 to-purple-600",
    sort_order: 10,
  },
  SOLAR_PANEL: {
    label: "Solar Panel",
    icon: "solar:sun-bold-duotone",
    color: "#f59e0b",
    gradient: "from-amber-500 to-orange-500",
    sort_order: 20,
  },
  AIRCON: {
    label: "Air Conditioner",
    icon: "solar:wind-bold-duotone",
    color: "#3b82f6",
    gradient: "from-blue-500 to-sky-500",
    sort_order: 30,
  },
  HEAT_PUMP: {
    label: "Heat Pump",
    icon: "solar:fire-bold-duotone",
    color: "#ef4444",
    gradient: "from-red-500 to-orange-500",
    sort_order: 40,
  },
  EV_CHARGER: {
    label: "EV Charger",
    icon: "solar:electric-refueling-bold-duotone",
    color: "#10b981",
    gradient: "from-emerald-500 to-teal-500",
    sort_order: 50,
  },
  WATER_FILTRATION: {
    label: "Water Filtration",
    icon: "solar:waterdrop-bold-duotone",
    color: "#06b6d4",
    gradient: "from-cyan-500 to-sky-500",
    sort_order: 60,
  },
  INVERTER: {
    label: "Inverter",
    icon: "solar:bolt-bold-duotone",
    color: "#0ea5e9",
    gradient: "from-sky-500 to-blue-500",
    sort_order: 70,
  },
  EXTRAS: {
    label: "Extras",
    icon: "solar:settings-bold-duotone",
    color: "#6b7280",
    gradient: "from-slate-500 to-gray-600",
    sort_order: 80,
  },
  OTHERS: {
    label: "Others",
    icon: "solar:box-bold-duotone",
    color: "#64748b",
    gradient: "from-slate-500 to-slate-600",
    sort_order: 90,
  },
};

export function formatCategoryLabel(category: string): string {
  return String(category || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeCategory(category: string): string {
  return String(category || "").trim().toUpperCase();
}

export async function ensureCategoryConfigs(categories: string[]) {
  const unique = [...new Set(categories.map(normalizeCategory).filter(Boolean))];
  if (!unique.length) return;

  const existing = await productCategoryConfigRepository.find(
    { category: { $in: unique } },
    { lean: true },
  );
  const have = new Set(existing.map((r: any) => r.category));

  for (const category of unique) {
    if (have.has(category)) continue;
    const known = KNOWN_CATEGORY_META[category];
    await productCategoryConfigRepository.create({
      category,
      label: known?.label ?? formatCategoryLabel(category),
      icon: known?.icon ?? DEFAULT_ICON,
      color: known?.color ?? DEFAULT_COLOR,
      gradient: known?.gradient ?? DEFAULT_GRADIENT,
      sort_order: known?.sort_order ?? 0,
      is_active: true,
    });
  }
}

export async function getCategoryConfigMap(categories?: string[]) {
  const filter: Record<string, unknown> = { is_active: { $ne: false } };
  if (categories?.length) {
    filter.category = { $in: categories.map(normalizeCategory) };
  }

  const rows: any[] = await productCategoryConfigRepository.find(filter, {
    sort: { sort_order: 1, label: 1 },
    lean: true,
  });

  return new Map(rows.map((r) => [r.category, r]));
}

export async function enrichCategoryRows(rows: Array<{ category: string; count: number }>) {
  const codes = rows.map((r) => r.category).filter(Boolean);
  await ensureCategoryConfigs(codes);
  const configMap = await getCategoryConfigMap(codes);

  return rows
    .map((row) => {
      const key = normalizeCategory(row.category);
      const cfg: any = configMap.get(key);
      return {
        category: row.category,
        count: row.count,
        label: cfg?.label ?? formatCategoryLabel(row.category),
        icon: cfg?.icon ?? DEFAULT_ICON,
        color: cfg?.color ?? DEFAULT_COLOR,
        gradient: cfg?.gradient ?? DEFAULT_GRADIENT,
        sort_order: cfg?.sort_order ?? 0,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export async function upsertCategoryConfig(
  category: string,
  data: Partial<{
    label: string;
    icon: string;
    color: string;
    gradient: string;
    sort_order: number;
    is_active: boolean;
  }>,
) {
  const key = normalizeCategory(category);
  if (!key) throw new Error("category is required");

  const existing: any = await productCategoryConfigRepository.findOne({ category: key }, { lean: true });
  if (existing) {
    await productCategoryConfigRepository.updateOne(
      { category: key },
      {
        $set: {
          ...(data.label !== undefined ? { label: data.label } : {}),
          ...(data.icon !== undefined ? { icon: data.icon } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.gradient !== undefined ? { gradient: data.gradient } : {}),
          ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
          ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        },
      },
    );
    return productCategoryConfigRepository.findOne({ category: key }, { lean: true });
  }

  return productCategoryConfigRepository.create({
    category: key,
    label: data.label ?? formatCategoryLabel(key),
    icon: data.icon ?? DEFAULT_ICON,
    color: data.color ?? DEFAULT_COLOR,
    gradient: data.gradient ?? DEFAULT_GRADIENT,
    sort_order: data.sort_order ?? 0,
    is_active: data.is_active !== false,
  });
}
