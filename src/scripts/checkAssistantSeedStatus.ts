/**
 * Check whether AI Assistant config + knowledge seeds are already in MongoDB.
 *
 * Run: npm run seed:assistant:check
 */
import "dotenv/config";
import { connectDatabase } from "@config/database";
import { SEED_CATALOG_VERSION } from "@assistant/config/assistant.defaults";
import { CRM_KNOWLEDGE_SEEDS } from "@assistant/config/crmKnowledge.seeds";
import { assistantConfigRepository } from "@assistant/repositories/assistantConfig.repository";
import { assistantKnowledgeSourceRepository } from "@assistant/repositories/assistantKnowledgeSource.repository";
import "@assistant/models/index";

async function main() {
  await connectDatabase();

  const config: any = await assistantConfigRepository.findById(1, { lean: true });
  const seeds: any[] = await assistantKnowledgeSourceRepository.find(
    { source_type: "seed" },
    { lean: true },
  );

  const expectedKeys = new Set([
    ...CRM_KNOWLEDGE_SEEDS.map((s) => s.seed_key),
    "rules-regulations",
  ]);

  const indexed = seeds.filter((s) => s.status === "indexed" && s.chunk_count > 0);
  const pending = seeds.filter((s) => s.status !== "indexed" || !s.chunk_count);
  const currentCatalog = seeds.filter(
    (s) => s.metadata?.catalog_version === SEED_CATALOG_VERSION,
  );
  const missingKeys = [...expectedKeys].filter(
    (key) => !seeds.some((s) => s.metadata?.seed_key === key),
  );
  const staleKeys = seeds
    .filter((s) => s.metadata?.seed_key && !expectedKeys.has(s.metadata.seed_key))
    .map((s) => s.metadata.seed_key);

  const allSources: any[] = await assistantKnowledgeSourceRepository.find({}, { lean: true });
  const uploaded = allSources.filter((s) => s.source_type !== "seed");

  const done =
    !!config &&
    missingKeys.length === 0 &&
    pending.length === 0 &&
    currentCatalog.length >= expectedKeys.size;

  console.log("\n=== DC CRM Assistant seed status ===\n");
  console.log(`Config loaded:        ${config ? "yes" : "no"}`);
  console.log(`Response style ver:   ${config?.response_style_version ?? 0}`);
  console.log(`Catalog version:      ${SEED_CATALOG_VERSION}`);
  console.log(`Built-in seed articles: ${seeds.length} (expected ~${expectedKeys.size})`);
  console.log(`  indexed:            ${indexed.length}`);
  console.log(`  pending/failed:     ${pending.length}`);
  console.log(`  on latest catalog:  ${currentCatalog.length}`);
  console.log(`Uploaded documents:   ${uploaded.length}`);
  console.log(`Missing seed keys:    ${missingKeys.length ? missingKeys.join(", ") : "none"}`);
  console.log(`Stale seed keys:      ${staleKeys.length ? staleKeys.join(", ") : "none"}`);
  console.log(`\nSeeding complete:     ${done ? "YES" : "NO — run npm run seed:assistant"}\n`);

  if (pending.length) {
    console.log("Pending/failed seeds:");
    for (const s of pending) {
      console.log(`  - [${s.id}] ${s.title} (${s.status}) ${s.error_message || ""}`);
    }
    console.log("");
  }

  process.exit(done ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
