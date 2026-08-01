import { productCategoryConfigRepository } from "@repositories";

const DEFAULT_ICON = "solar:box-bold-duotone";
const DEFAULT_COLOR = "#64748b";
const DEFAULT_GRADIENT = "from-slate-500 to-slate-600";

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
    await productCategoryConfigRepository.create({
      category,
      label: formatCategoryLabel(category),
      icon: DEFAULT_ICON,
      color: DEFAULT_COLOR,
      gradient: DEFAULT_GRADIENT,
      sort_order: 0,
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
