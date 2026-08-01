/** Fallback installation types — overridden by quote_builder_settings in DB when configured */
export const DEFAULT_INSTALLATION_TYPES = [
  { value: "NEW_SYSTEM", label: "New System" },
  { value: "UPGRADE", label: "Upgrade" },
  { value: "ADD_ON", label: "Add-On" },
  { value: "REMOVAL_NEW", label: "Removal + New" },
];

/** Exact category match only — categories/brands come from products collection in DB */
export function resolveCategoryFilter(category?: string): string[] | null {
  if (!category?.trim()) return null;
  const key = category.trim().toUpperCase();
  return [key];
}

/** Mongo filter for exact category — avoids $regex "SOLAR" matching SOLAR_PANEL */
export function categoryQueryFilter(category?: string): string | { $in: string[] } | undefined {
  const cats = resolveCategoryFilter(category);
  if (!cats?.length) return undefined;
  return cats.length === 1 ? cats[0] : { $in: cats };
}
