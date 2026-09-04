import { connectDatabase, disconnectDatabase } from "@config/database";
import { productRepository } from "@repositories";
import { resolveBrandLogoUrl, resolveProductDisplayImage } from "@utils/brandLogoUrl";
import fs from "fs";
import path from "path";

type ExportBrand = { id: string; name: string; domain: string; logoUrl: string };
type ExportModel = {
  id: string;
  brandId: string;
  brand: string;
  model: string;
  wattage: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  tech?: string;
};
type ExportPayload = { brands: ExportBrand[]; models: ExportModel[] };

const DATA_FILE = path.resolve(__dirname, "../data/panelLibraryExport.json");
const SYSTEM_USER_ID = 1;
const SKETCH_TAG = "solar-sketch";
const PANEL_CATEGORY = "SOLAR_PANEL";

function loadExport(): ExportPayload {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(
      `Missing ${DATA_FILE}. Run: cd soms_front && npx tsx scripts/exportPanelLibrary.ts`,
    );
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as ExportPayload;
}

/** Match existing catalog brand labels to sketch brand ids. */
function brandKey(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function brandsMatch(a?: string | null, b?: string | null): boolean {
  const ka = brandKey(a);
  const kb = brandKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const a0 = ka.split(" ")[0];
  const b0 = kb.split(" ")[0];
  return a0 === b0 || ka.includes(kb) || kb.includes(ka);
}

/**
 * Variant shape matching Products admin / existing SOLAR_PANEL rows
 * (see product.model.ts variants jsonArray + CreateEditProductModal).
 */
function toProductVariant(mod: ExportModel) {
  const size = `${mod.heightMm} * ${mod.widthMm} * ${mod.thicknessMm}`;
  return {
    id: mod.id,
    model: mod.model,
    capacity: `${mod.wattage}W`,
    size,
    size_kw: Number((mod.wattage / 1000).toFixed(3)),
    module_wattage: mod.wattage,
    width_mm: mod.widthMm,
    height_mm: mod.heightMm,
    thickness_mm: mod.thicknessMm,
    panel_library_id: mod.id,
    phase: "Single",
    roof_type: "",
    story_type: "",
    rebate: 0,
    stc_rebate: 0,
    bstc_rebate: 0,
    price: 0,
    sku: "",
    stock_quantity: 0,
    stock_status: "IN_STOCK",
    additional: mod.tech ? { tech: mod.tech } : {},
  };
}

async function main() {
  const { brands, models } = loadExport();
  await connectDatabase();

  // 1) Remove wrongly created sketch products (one product per brand dump)
  const stale = await productRepository
    .find(
      { tags: SKETCH_TAG },
      { lean: true, select: "id name tags category" },
    )
    .exec();

  let removed = 0;
  for (const row of stale as any[]) {
    await productRepository.deleteById(row.id);
    removed += 1;
    console.log(`− removed #${row.id} ${row.name}`);
  }
  console.log(`Cleared ${removed} incorrect sketch product(s).`);

  // 2) Existing company products (real catalog)
  const existingPanels = await productRepository
    .find(
      { category: { $in: [PANEL_CATEGORY, "SOLAR", "PANEL"] }, tags: { $nin: [SKETCH_TAG] } },
      { lean: true },
    )
    .exec();

  const byBrandId = new Map<string, ExportModel[]>();
  for (const mod of models) {
    const list = byBrandId.get(mod.brandId) || [];
    list.push(mod);
    byBrandId.set(mod.brandId, list);
  }

  let updated = 0;
  const usedBrandIds = new Set<string>();

  for (const brand of brands) {
    const brandModels = (byBrandId.get(brand.id) || []).slice().sort(
      (a, b) => a.wattage - b.wattage || a.model.localeCompare(b.model),
    );
    if (!brandModels.length) continue;

    const variants = brandModels.map(toProductVariant);
    const logoUrl = brand.logoUrl || resolveBrandLogoUrl(brand.name);

    // Update ALL existing company products that match this brand (e.g. two Risen rows)
    const matches = (existingPanels as any[]).filter(
      (p) => brandsMatch(p.brand, brand.name) || brandsMatch(p.name, brand.name),
    );

    if (matches.length) {
      usedBrandIds.add(brand.id);
      for (const existing of matches) {
        const display = resolveProductDisplayImage({
          img: existing.img,
          logo_url: logoUrl || existing.logo_url,
          brand: existing.brand || brand.name,
        });
        const manual = (existing.variants || []).filter((v: any) => !v?.panel_library_id);
        // Only the first match gets full library variants; others keep manual + logo
        const nextVariants = existing === matches[0] ? [...manual, ...variants] : manual;

        await productRepository.updateById(existing.id, {
          $set: {
            brand: (existing.brand || brand.name).trim(),
            category: PANEL_CATEGORY,
            logo_url: display.logo_url,
            ...(existing.img ? {} : { img: display.img }),
            variants: nextVariants,
            updated_by: SYSTEM_USER_ID,
          },
        });
        updated += 1;
        console.log(
          `✓ #${existing.id} ${existing.name} → logo + ${nextVariants.length} variants`,
        );
      }
      continue;
    }

    console.log(`⊘ skip ${brand.name} — no existing SOLAR_PANEL product`);
  }

  console.log(
    `Done. Updated ${updated} products with logos + variants. Skipped brands without an existing product.`,
  );
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
