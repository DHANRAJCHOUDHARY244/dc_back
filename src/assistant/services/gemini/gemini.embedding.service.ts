import { getGeminiClient } from "./gemini.client";

const EMBEDDING_FALLBACKS = [
  process.env.GEMINI_EMBEDDING_MODEL,
  "gemini-embedding-001",
  "gemini-embedding-2",
  "text-embedding-004",
].filter(Boolean) as string[];

let resolvedEmbeddingModel: string | null = null;

async function embedWithModel(text: string, model: string): Promise<number[]> {
  const genAI = await getGeminiClient();
  const embeddingModel = genAI.getGenerativeModel({ model });
  const result = await embeddingModel.embedContent(text);
  const values = result.embedding?.values;
  if (!values?.length) {
    throw new Error("Gemini returned empty embedding");
  }
  return values;
}

export function getResolvedEmbeddingModel(): string | null {
  return resolvedEmbeddingModel;
}

export async function embedText(text: string, model?: string): Promise<number[]> {
  const candidates = model ? [model, ...EMBEDDING_FALLBACKS] : EMBEDDING_FALLBACKS;
  const tried = new Set<string>();
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    if (!candidate || tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      const values = await embedWithModel(text, candidate);
      resolvedEmbeddingModel = candidate;
      return values;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("No embedding model available");
}

export async function embedTexts(texts: string[], model?: string): Promise<number[][]> {
  const out: number[][] = [];
  for (const text of texts) {
    out.push(await embedText(text, model));
  }
  return out;
}
