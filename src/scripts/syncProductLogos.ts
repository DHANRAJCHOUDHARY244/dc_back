import { connectDatabase, disconnectDatabase } from "@config/database";
import { productRepository } from "@repositories";
import { resolveBrandLogoUrl, resolveProductDisplayImage } from "@utils/brandLogoUrl";

/** Backfill logo_url (and img when empty) for all products in the catalog. */
async function main() {
  await connectDatabase();

  const products = await productRepository.find({}, { lean: true }).exec();
  let updated = 0;

  for (const product of products as any[]) {
    const logo =
      product.logo_url?.trim() ||
      resolveBrandLogoUrl(product.brand) ||
      null;
    if (!logo && product.img?.trim()) continue;

    const display = resolveProductDisplayImage({
      img: product.img,
      logo_url: logo,
      brand: product.brand,
    });

    const changed =
      display.logo_url !== (product.logo_url || null) ||
      (display.img && display.img !== (product.img || null));

    if (!changed) continue;

    await productRepository.updateById(product.id, {
      $set: {
        logo_url: display.logo_url,
        ...(display.img && display.img !== product.img ? { img: display.img } : {}),
      },
    });
    updated += 1;
    console.log(`✓ #${product.id} ${product.name} → ${display.logo_url}`);
  }

  console.log(`Done. Updated ${updated} / ${products.length} products.`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
