import { connectDatabase, disconnectDatabase } from "@config/database";
import Product from "@models/product.model";

/**
 * Remove garbage from earlier solar panel import attempts:
 * 1) Hard-delete products we created (Eging / Qcells / … ids ≥ 972, sketch dumps)
 * 2) Strip auto-imported `panel_library_id` variants from original company products
 *    (keeps manually entered variants like Risen)
 *
 * Run: npm run cleanup:solar-import-garbage
 */
async function main() {
  await connectDatabase();
  const col = Product.collection;

  const ORIGINAL_IDS = [3, 4, 5, 7, 8, 10, 11, 12, 13, 30];

  const created = await col
    .find({
      id: { $gte: 972 },
      category: "SOLAR_PANEL",
    })
    .project({ id: 1, name: 1 })
    .toArray();

  if (created.length) {
    const res = await col.deleteMany({ id: { $in: created.map((p: any) => p.id) } });
    console.log(`Deleted ${res.deletedCount} created products:`);
    for (const p of created as any[]) console.log(`  − #${p.id} ${p.name}`);
  } else {
    console.log("No created products (id ≥ 972) to delete.");
  }

  const leftovers = await col
    .find({
      $or: [
        { tags: "solar-sketch" },
        { name: /Solar Panels$/i, category: { $in: ["SOLAR", "SOLAR_PANEL", "PANEL"] } },
      ],
    })
    .project({ id: 1, name: 1 })
    .toArray();

  if (leftovers.length) {
    const res = await col.deleteMany({ id: { $in: leftovers.map((p: any) => p.id) } });
    console.log(`Deleted ${res.deletedCount} leftover sketch dump products.`);
  }

  for (const id of ORIGINAL_IDS) {
    const p = await col.findOne({ id });
    if (!p) continue;
    const before = (p.variants || []).length;
    const kept = (p.variants || []).filter((v: any) => !v?.panel_library_id);
    await col.updateOne({ id }, { $set: { variants: kept } });
    console.log(`#${id} ${p.name}: variants ${before} → ${kept.length}`);
  }

  const remaining = await col
    .find({
      category: { $in: ["SOLAR", "SOLAR_PANEL", "PANEL"] },
      $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
    })
    .project({ id: 1, name: 1, brand: 1, variants: 1 })
    .sort({ id: 1 })
    .toArray();

  console.log("Remaining solar products:");
  for (const p of remaining as any[]) {
    console.log(`  #${p.id} ${p.name} | variants=${(p.variants || []).length}`);
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
