/**
 * Manually seed / refresh AI Assistant config and CRM knowledge articles.
 * Does NOT start the HTTP server.
 *
 * Run:
 *   npm run seed:assistant          # full bootstrap (config + seeds + reindex if needed)
 *   npm run seed:assistant -- --knowledge-only
 *   npm run seed:assistant -- --reindex
 *
 * Skip auto-seeding on server start: set ASSISTANT_BOOTSTRAP_ON_STARTUP=false in .env
 */
import "dotenv/config";
import { connectDatabase } from "@config/database";
import {
  bootstrapAssistant,
  reindexAllKnowledgeSources,
  seedAssistantKnowledge,
} from "@assistant/services/assistant.config.service";
import "@assistant/models/index";

async function main() {
  const args = new Set(process.argv.slice(2));
  const knowledgeOnly = args.has("--knowledge-only");
  const reindexOnly = args.has("--reindex");

  await connectDatabase();

  if (reindexOnly) {
    console.log("Re-indexing all assistant knowledge sources...");
    const n = await reindexAllKnowledgeSources();
    console.log(`Done: ${n} source(s) re-indexed.`);
    process.exit(0);
  }

  if (knowledgeOnly) {
    console.log("Seeding assistant knowledge articles only...");
    await seedAssistantKnowledge();
    console.log("Knowledge seed complete.");
    process.exit(0);
  }

  console.log("Running full assistant bootstrap...");
  await bootstrapAssistant();
  console.log("Assistant bootstrap complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
