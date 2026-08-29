import { assistantKnowledgeChunkRepository } from "../../repositories/assistantKnowledgeChunk.repository";
import { embedText } from "../gemini/gemini.embedding.service";
import { cosineSimilarity } from "./chunking.service";
import type { RAGChunkHit } from "../../types/assistant.types";

export async function retrieveRelevantChunks(
  queryEmbedding: number[],
  options: { topK: number; threshold: number; categories?: string[] },
): Promise<RAGChunkHit[]> {
  const filter: Record<string, unknown> = {};
  if (options.categories?.length) {
    filter.category = { $in: options.categories };
  }

  const chunks: any[] = await assistantKnowledgeChunkRepository.find(filter, {
    lean: true,
    limit: 500,
  });

  const scored: RAGChunkHit[] = [];
  for (const chunk of chunks) {
    const embedding = chunk.embedding as number[] | undefined;
    if (!embedding?.length) continue;
    const score = cosineSimilarity(queryEmbedding, embedding);
    if (score < options.threshold) continue;
    scored.push({
      chunk_id: chunk.id,
      source_id: chunk.source_id,
      title: chunk.title || "Knowledge",
      content: chunk.content,
      score,
      category: chunk.category,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.topK);
}

export function formatContextBlock(hits: RAGChunkHit[]): string {
  if (!hits.length) return "";
  return hits.map((h, i) => `(${i + 1}) ${h.title}\n${h.content}`).join("\n\n");
}

export async function embedQuery(text: string, embeddingModel: string): Promise<number[]> {
  return embedText(text, embeddingModel);
}
