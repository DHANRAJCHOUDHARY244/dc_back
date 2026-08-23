import { connectDatabase, disconnectDatabase } from "@config/database";
import {
  calculatorBrandRepository,
  calculatorCategoryRepository,
  calculatorExtraRepository,
  calculatorProductRepository,
} from "@repositories";
import fs from "fs";
import path from "path";
import slugify from "slugify";
import { statePriceAll } from "@constants/auStatePrice.constants";

type SourceVariant = {
  id?: string;
  phase?: string;
  price?: number;
  rebate?: number;
  capacity?: string;
  additional?: {
    stack?: string;
    inverter?: string;
  };
};

type SourceProduct = {
  id: number;
  name: string;
  slug?: string;
  category?: string;
  brand?: string;
  description?: string;
  tags?: string[];
  specifications?: Array<{ key?: string; value?: string }>;
  variants?: SourceVariant[];
  status?: string;
};

type CategorySeed = {
  name: string;
  rebate_options: string[];
  size_fields: string[];
  sort_order: number;
};

const SOURCE_FILE = path.resolve(process.cwd(), "soms.products.json");
const PRODUCTS_ONLY = process.argv.includes("--products-only");

const CATEGORY_CONFIG: Record<string, CategorySeed> = {
  solar: { name: "Solar", rebate_options: ["solar_vic", "interest_free_loan", "stc"], size_fields: ["size_kw"], sort_order: 0 },
  battery: { name: "Battery", rebate_options: ["bstc"], size_fields: ["battery_kwh", "inverter_kw"], sort_order: 1 },
  inverter: { name: "Inverter", rebate_options: ["stc"], size_fields: ["inverter_kw"], sort_order: 2 },
  combo: { name: "Combo", rebate_options: ["stc", "bstc", "solar_vic"], size_fields: ["size_kw", "battery_kwh"], sort_order: 3 },
  "heat-pump": { name: "Heat pump", rebate_options: ["solar_vic", "stc", "veec"], size_fields: ["capacity"], sort_order: 4 },
  aircon: { name: "Aircon", rebate_options: ["veec"], size_fields: ["capacity"], sort_order: 5 },
  split: { name: "Split", rebate_options: ["veec"], size_fields: ["capacity"], sort_order: 6 },
  vrf: { name: "VRF", rebate_options: ["veec"], size_fields: ["capacity"], sort_order: 7 },
  ducted: { name: "Ducted", rebate_options: ["veec"], size_fields: ["capacity"], sort_order: 8 },
  "ev-charger": { name: "EV Charger", rebate_options: [], size_fields: ["capacity"], sort_order: 9 },
};

function slug(value: string) {
  return slugify(value, { lower: true, strict: true });
}

function normalizePhase(phase?: string): "single" | "three" | "both" {
  const value = (phase || "").trim().toLowerCase();
  if (!value) return "both";
  if (value.includes("three") || value.includes("3")) return "three";
  if (value.includes("single") || value.includes("1")) return "single";
  return "both";
}

function parseNumeric(value?: string): number | undefined {
  if (!value) return undefined;
  const match = String(value).match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

function deriveCategoryKey(product: SourceProduct): keyof typeof CATEGORY_CONFIG | null {
  const category = (product.category || "").toUpperCase();
  const haystack = `${product.name} ${(product.tags || []).join(" ")} ${(product.description || "")}`.toLowerCase();

  if (category === "SOLAR" || category === "SOLAR_PANEL") return "solar";
  if (category === "BATTERY") return "battery";
  if (category === "INVERTER") return "inverter";
  if (category === "HEAT_PUMP") return "heat-pump";
  if (category === "EV_CHARGER") return "ev-charger";
  if (category === "AIRCON") {
    if (haystack.includes("vrf")) return "vrf";
    if (haystack.includes("ducted")) return "ducted";
    if (haystack.includes("split")) return "split";
    return "aircon";
  }
  return null;
}

function buildVariantLabel(variant: SourceVariant, index: number) {
  const parts = [variant.capacity, variant.phase].filter(Boolean);
  return parts.length ? parts.join(" · ") : `Variant ${index + 1}`;
}

function buildProductVariants(product: SourceProduct) {
  const variants = product.variants || [];
  const modelSpec = product.specifications?.find((s) => (s.key || "").toLowerCase() === "model")?.value;

  return variants.map((variant, index) => {
    const capacity = variant.capacity || modelSpec || product.name;
    const statePrice = Number(variant.price || 0);
    const batteryKwh =
      product.category === "BATTERY"
        ? parseNumeric(variant.capacity) || parseNumeric(variant.additional?.stack)
        : undefined;
    const inverterKw =
      product.category === "INVERTER" || product.category === "BATTERY"
        ? parseNumeric(variant.additional?.inverter) || parseNumeric(variant.capacity)
        : undefined;
    const sizeKw =
      product.category === "SOLAR" || product.category === "SOLAR_PANEL"
        ? parseNumeric(variant.capacity)
        : undefined;

    return {
      label: buildVariantLabel(variant, index),
      size_kw: sizeKw,
      battery_kwh: batteryKwh,
      inverter_kw: inverterKw,
      capacity,
      prices: statePriceAll(statePrice),
      installation_prices: statePriceAll(0),
    };
  });
}

async function upsertCategory(config: CategorySeed) {
  const existing: any = await calculatorCategoryRepository.findOne({ slug: slug(config.name) }, { lean: true });
  if (existing) {
    await calculatorCategoryRepository.updateOne(
      { id: existing.id },
      {
        $set: {
          name: config.name,
          rebate_options: config.rebate_options,
          size_fields: config.size_fields,
          sort_order: config.sort_order,
          active: true,
          deleted_at: null,
        },
      },
    );
    return { ...existing, ...config };
  }

  return calculatorCategoryRepository.create({
    name: config.name,
    slug: slug(config.name),
    rebate_options: config.rebate_options,
    size_fields: config.size_fields,
    sort_order: config.sort_order,
    active: true,
  });
}

async function upsertBrand(categoryId: number, brandName: string) {
  const existing: any = await calculatorBrandRepository.findOne(
    { category_id: categoryId, name: brandName },
    { lean: true },
  );
  if (existing) {
    await calculatorBrandRepository.updateOne(
      { id: existing.id },
      { $set: { active: true, deleted_at: null } },
    );
    return existing;
  }

  return calculatorBrandRepository.create({
    category_id: categoryId,
    name: brandName,
    active: true,
    sort_order: 0,
  });
}

async function findExistingBrand(categoryId: number, brandName: string) {
  return calculatorBrandRepository.findOne(
    { category_id: categoryId, name: brandName },
    { lean: true },
  );
}

async function upsertProduct(categoryId: number, brandId: number, product: SourceProduct) {
  const variants = buildProductVariants(product);
  if (!variants.length) return false;

  const phaseValues = new Set((product.variants || []).map((v) => normalizePhase(v.phase)));
  const phase = phaseValues.size === 1 ? [...phaseValues][0] : "both";
  const existing: any = await calculatorProductRepository.findOne(
    { category_id: categoryId, brand_id: brandId, name: product.name },
    { lean: true },
  );

  const payload = {
    category_id: categoryId,
    brand_id: brandId,
    name: product.name,
    phase,
    variants,
    active: product.status !== "INACTIVE",
    sort_order: 0,
  };

  if (existing) {
    await calculatorProductRepository.updateOne(
      { id: existing.id },
      { $set: { ...payload, deleted_at: null } },
    );
    return false;
  }

  await calculatorProductRepository.create(payload);
  return true;
}

async function upsertExtra(product: SourceProduct) {
  const key = slug(product.name);
  const basePrice = Number(product.variants?.[0]?.price || 0);
  const existing: any = await calculatorExtraRepository.findOne({ key }, { lean: true });

  const payload = {
    key,
    label: product.name,
    category: product.category || "EXTRAS",
    prices: { vic: basePrice, nsw: basePrice, act: basePrice },
    active: product.status !== "INACTIVE",
    sort_order: 0,
  };

  if (existing) {
    await calculatorExtraRepository.updateOne(
      { id: existing.id },
      { $set: { ...payload, deleted_at: null } },
    );
    return false;
  }

  await calculatorExtraRepository.create(payload);
  return true;
}

async function main() {
  await connectDatabase();
  const raw = fs.readFileSync(SOURCE_FILE, "utf8");
  const source = JSON.parse(raw) as SourceProduct[];

  const categoryDocs = new Map<string, any>();
  if (PRODUCTS_ONLY) {
    const existingCategories: any[] = await calculatorCategoryRepository.find({}, { lean: true });
    for (const config of Object.values(CATEGORY_CONFIG)) {
      const doc = existingCategories.find((c) => c.slug === slug(config.name));
      if (doc) categoryDocs.set(slug(config.name), doc);
    }
  } else {
    for (const config of Object.values(CATEGORY_CONFIG)) {
      const doc = await upsertCategory(config);
      categoryDocs.set(slug(config.name), doc);
    }
  }

  let createdProducts = 0;
  let updatedProducts = 0;
  let createdExtras = 0;
  let updatedExtras = 0;
  let skippedProducts = 0;

  for (const product of source) {
    const sourceCategory = (product.category || "").toUpperCase();
    if (sourceCategory === "EXTRAS" || sourceCategory === "OTHERS") {
      if (PRODUCTS_ONLY) continue;
      const created = await upsertExtra(product);
      if (created) createdExtras += 1;
      else updatedExtras += 1;
      continue;
    }

    const categoryKey = deriveCategoryKey(product);
    if (!categoryKey) continue;

    const category = categoryDocs.get(categoryKey);
    if (!category) continue;

    const brandName = product.brand?.trim() || "Generic";
    const brand: any = PRODUCTS_ONLY
      ? await findExistingBrand(category.id, brandName)
      : await upsertBrand(category.id, brandName);
    if (!brand) {
      skippedProducts += 1;
      continue;
    }
    const created = await upsertProduct(category.id, brand.id, product);
    if (created) createdProducts += 1;
    else updatedProducts += 1;
  }

  console.log(
    JSON.stringify(
      {
        sourceCount: source.length,
        mode: PRODUCTS_ONLY ? "products-only" : "full-catalog",
        categoriesSeeded: [...categoryDocs.keys()].length,
        createdProducts,
        updatedProducts,
        createdExtras,
        updatedExtras,
        skippedProducts,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Failed to import calculator catalog from products JSON", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
