import type { CrmKnowledgeSeed } from "@assistant/config/crmKnowledge.seeds";
import {
  ASSISTANT_CONFIG_ID,
  DEFAULT_ASSISTANT_CONFIG,
  DEFAULT_KNOWLEDGE_SEEDS,
  DEFAULT_ROLE_ACCESS,
  DEFAULT_RULES_REGULATIONS,
  SEED_CATALOG_VERSION,
} from "@assistant/config/assistant.defaults";
import { assistantConfigRepository } from "@assistant/repositories/assistantConfig.repository";
import { assistantKnowledgeSourceRepository } from "@assistant/repositories/assistantKnowledgeSource.repository";
import type { AssistantConfigDTO, AssistantToolName } from "../types/assistant.types";
import {
  createTextSource,
  ingestSourceById,
  ingestSourceContent,
} from "@assistant/services/rag/ingestion.service";

const LEGACY_EMBEDDING_MODELS = new Set(["text-embedding-004", "embedding-001"]);

function normalizeToolsEnabled(
  tools: string[] | undefined,
  mcpEnabled: boolean,
): AssistantToolName[] {
  const set = new Set<string>(
    tools?.length ? tools : DEFAULT_ASSISTANT_CONFIG.tools_enabled,
  );
  set.add("search_knowledge");
  if (mcpEnabled !== false) set.add("query_live_data");
  return [...set] as AssistantToolName[];
}

function mapConfigRow(row: any): AssistantConfigDTO {
  const mcpEnabled = row.mcp_enabled !== false;
  return {
    enabled: row.enabled !== false,
    model: row.model || process.env.GEMINI_MODEL || DEFAULT_ASSISTANT_CONFIG.model,
    embedding_model: row.embedding_model || DEFAULT_ASSISTANT_CONFIG.embedding_model,
    temperature: Number(row.temperature ?? DEFAULT_ASSISTANT_CONFIG.temperature),
    top_k: Number(row.top_k ?? DEFAULT_ASSISTANT_CONFIG.top_k),
    chunk_size: Number(row.chunk_size ?? DEFAULT_ASSISTANT_CONFIG.chunk_size),
    chunk_overlap: Number(row.chunk_overlap ?? DEFAULT_ASSISTANT_CONFIG.chunk_overlap),
    max_output_tokens: Number(row.max_output_tokens ?? DEFAULT_ASSISTANT_CONFIG.max_output_tokens),
    similarity_threshold: Number(
      row.similarity_threshold ?? DEFAULT_ASSISTANT_CONFIG.similarity_threshold,
    ),
    system_prompt: row.system_prompt || DEFAULT_ASSISTANT_CONFIG.system_prompt,
    welcome_message: row.welcome_message || DEFAULT_ASSISTANT_CONFIG.welcome_message,
    rules_regulations: row.rules_regulations || DEFAULT_RULES_REGULATIONS,
    tools_enabled: normalizeToolsEnabled(row.tools_enabled, mcpEnabled),
    allowed_roles: row.allowed_roles || [],
    role_access:
      row.role_access && Object.keys(row.role_access).length
        ? row.role_access
        : DEFAULT_ROLE_ACCESS,
    blocked_user_ids: row.blocked_user_ids || [],
    rag_enabled: row.rag_enabled !== false,
    store_conversations: row.store_conversations !== false,
    use_company_branding: row.use_company_branding !== false,
    super_admin_unrestricted: row.super_admin_unrestricted !== false,
    mcp_enabled: row.mcp_enabled !== false,
    response_style_version: Number(row.response_style_version ?? 0),
  };
}

async function loadConfigRow(): Promise<{ row: any; migratedEmbeddingModel: boolean }> {
  let row: any = await assistantConfigRepository.findById(ASSISTANT_CONFIG_ID, { lean: true });
  let migratedEmbeddingModel = false;

  if (!row) {
    row = await assistantConfigRepository.create({
      id: ASSISTANT_CONFIG_ID,
      ...DEFAULT_ASSISTANT_CONFIG,
    });
  } else if (LEGACY_EMBEDDING_MODELS.has(row.embedding_model)) {
    await assistantConfigRepository.updateById(ASSISTANT_CONFIG_ID, {
      $set: { embedding_model: DEFAULT_ASSISTANT_CONFIG.embedding_model },
    });
    row.embedding_model = DEFAULT_ASSISTANT_CONFIG.embedding_model;
    migratedEmbeddingModel = true;
  }

  return { row, migratedEmbeddingModel };
}

export async function getAssistantConfig(): Promise<AssistantConfigDTO> {
  const { row } = await loadConfigRow();
  return mapConfigRow(row);
}

export async function updateAssistantConfig(patch: Partial<AssistantConfigDTO>) {
  const current = await getAssistantConfig();
  const merged = { ...current, ...patch };
  await assistantConfigRepository.updateById(ASSISTANT_CONFIG_ID, { $set: merged });
  return getAssistantConfig();
}

export async function seedAssistantKnowledge() {
  const seeds = DEFAULT_KNOWLEDGE_SEEDS as CrmKnowledgeSeed[];
  const currentKeys = new Set(seeds.map((s) => s.seed_key));
  let created = 0;
  let updated = 0;

  for (const seed of seeds) {
    const seedKey = seed.seed_key;

    let exists: any = await assistantKnowledgeSourceRepository.findOne(
      { "metadata.seed_key": seedKey, source_type: "seed" },
      { lean: true },
    );

    if (!exists) {
      exists = await assistantKnowledgeSourceRepository.findOne(
        { title: seed.title, source_type: "seed" },
        { lean: true },
      );
    }

    if (!exists) {
      await createTextSource({
        title: seed.title,
        content: seed.content,
        category: seed.category,
        source_type: "seed",
        metadata: { seed_key: seedKey, catalog_version: SEED_CATALOG_VERSION },
      });
      created += 1;
      continue;
    }

    const needsUpdate =
      exists.content !== seed.content ||
      exists.category !== seed.category ||
      exists.title !== seed.title ||
      exists.metadata?.seed_key !== seedKey ||
      exists.metadata?.catalog_version !== SEED_CATALOG_VERSION;

    if (needsUpdate) {
      await assistantKnowledgeSourceRepository.updateById(exists.id, {
        $set: {
          title: seed.title,
          category: seed.category,
          content: seed.content,
          status: "pending",
          metadata: { seed_key: seedKey, catalog_version: SEED_CATALOG_VERSION },
        },
      });
      await ingestSourceContent(exists.id, seed.content, {
        title: seed.title,
        category: seed.category,
      });
      updated += 1;
    }
  }

  const staleSeeds: any[] = await assistantKnowledgeSourceRepository.find(
    { source_type: "seed" },
    { lean: true },
  );
  for (const row of staleSeeds) {
    const key = row.metadata?.seed_key;
    if (!key || !currentKeys.has(key)) {
      await assistantKnowledgeSourceRepository.softDeleteById(row.id);
    }
  }

  if (created || updated) {
    console.log(
      `Assistant knowledge seeds: ${created} created, ${updated} updated (catalog ${SEED_CATALOG_VERSION})`,
    );
  }
}

export async function reindexAllKnowledgeSources() {
  const sources: any[] = await assistantKnowledgeSourceRepository.find({}, { lean: true });
  let count = 0;
  for (const source of sources) {
    try {
      await ingestSourceById(source.id);
      count += 1;
    } catch (err) {
      console.warn(`Assistant reindex skipped source ${source.id}:`, (err as Error).message);
    }
  }
  return count;
}

export async function bootstrapAssistant() {
  const { row, migratedEmbeddingModel } = await loadConfigRow();

  const targetStyleVersion = DEFAULT_ASSISTANT_CONFIG.response_style_version ?? 0;
  const normalizedTools = normalizeToolsEnabled(row.tools_enabled, row.mcp_enabled !== false);
  const needsStyleUpdate = Number(row.response_style_version ?? 0) < targetStyleVersion;
  const needsToolsUpdate =
    JSON.stringify(normalizedTools) !== JSON.stringify(row.tools_enabled || []);

  if (needsStyleUpdate || needsToolsUpdate) {
    await assistantConfigRepository.updateById(ASSISTANT_CONFIG_ID, {
      $set: {
        ...(needsStyleUpdate
          ? {
              system_prompt: DEFAULT_ASSISTANT_CONFIG.system_prompt,
              welcome_message: DEFAULT_ASSISTANT_CONFIG.welcome_message,
              response_style_version: targetStyleVersion,
            }
          : {}),
        tools_enabled: normalizedTools,
      },
    });
    if (needsStyleUpdate) {
      console.log(`Assistant response style updated to version ${targetStyleVersion}`);
    }
    if (needsToolsUpdate) {
      console.log("Assistant tools_enabled updated (query_live_data enabled for MCP)");
    }
  }

  await seedAssistantKnowledge();

  const sources: any[] = await assistantKnowledgeSourceRepository.find({}, { lean: true });
  const needsReindex =
    migratedEmbeddingModel ||
    sources.some((s) => s.status !== "indexed" || !s.chunk_count);

  if (needsReindex && sources.length) {
    const n = await reindexAllKnowledgeSources();
    console.log(
      `Assistant knowledge reindexed: ${n}/${sources.length} sources (embedding: ${row.embedding_model})`,
    );
  }
}
