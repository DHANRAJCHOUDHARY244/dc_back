/**
 * Sync full permissions catalogue (src/data/permissions.ts) with MongoDB.
 * Merges dc_crm.permissions.json + catalogue additions before sync.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seedPermissionsFromCatalog.ts
 */
import "dotenv/config";
import { connectDatabase } from "@config/database";
import { syncPermissionCatalogFromFile } from "@services/permissionCatalogSync.service";
import { execSync } from "child_process";
import path from "path";

async function main() {
  // Regenerate permissions.ts from DB export + catalogue additions
  execSync("npx ts-node -r tsconfig-paths/register src/scripts/mergePermissionsCatalog.ts", {
    cwd: path.join(__dirname, "..", ".."),
    stdio: "inherit",
  });

  await connectDatabase();
  const result = await syncPermissionCatalogFromFile();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
