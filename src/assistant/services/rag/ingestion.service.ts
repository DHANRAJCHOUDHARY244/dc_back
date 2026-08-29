import fs from "fs/promises";
import path from "path";
import { assistantKnowledgeChunkRepository } from "../../repositories/assistantKnowledgeChunk.repository";
import { assistantKnowledgeSourceRepository } from "../../repositories/assistantKnowledgeSource.repository";
import { embedTexts } from "../gemini/gemini.embedding.service";
import { splitTextIntoChunks } from "./chunking.service";
import { getAssistantConfig } from "../assistant.config.service";
import { extractTextFromKnowledgeFile } from "./documentParser.service";

export async function ingestSourceContent(
  sourceId: number,
  rawText: string,
  meta: { title: string; category?: string },
): Promise<{ chunk_count: number }> {
  const config = await getAssistantConfig();
  const source: any = await assistantKnowledgeSourceRepository.findById(sourceId);
  if (!source) throw new Error("Knowledge source not found");

  await assistantKnowledgeChunkRepository.deleteMany({ source_id: sourceId });

  const chunks = splitTextIntoChunks(rawText, config.chunk_size, config.chunk_overlap);
  if (!chunks.length) {
    await assistantKnowledgeSourceRepository.updateById(sourceId, {
      $set: { status: "failed", error_message: "No content to index", chunk_count: 0 },
    });
    throw new Error("No content to index");
  }

  const embeddings = await embedTexts(chunks, config.embedding_model);
  const docs = chunks.map((content, index) => ({
    source_id: sourceId,
    chunk_index: index,
    title: meta.title,
    category: meta.category || source.category || "general",
    content,
    embedding: embeddings[index],
    token_estimate: Math.ceil(content.length / 4),
  }));

  await assistantKnowledgeChunkRepository.createMany(docs);

  await assistantKnowledgeSourceRepository.updateById(sourceId, {
    $set: {
      status: "indexed",
      chunk_count: chunks.length,
      error_message: null,
      content: rawText.slice(0, 50000),
    },
  });

  return { chunk_count: chunks.length };
}

export async function ingestSourceById(sourceId: number): Promise<{ chunk_count: number }> {
  const source: any = await assistantKnowledgeSourceRepository.findById(sourceId);
  if (!source) throw new Error("Knowledge source not found");

  let text = source.content || "";
  if (!text?.trim() && source.file_path) {
    const abs = path.isAbsolute(source.file_path)
      ? source.file_path
      : path.join(process.cwd(), source.file_path);
    const parsed = await extractTextFromKnowledgeFile(abs, source.file_name || source.title);
    text = parsed.text;
  }

  if (!text?.trim()) {
    await assistantKnowledgeSourceRepository.updateById(sourceId, {
      $set: { status: "failed", error_message: "Empty source content" },
    });
    throw new Error("Empty source content");
  }

  return ingestSourceContent(sourceId, text, {
    title: source.title,
    category: source.category,
  });
}

export async function createTextSource(input: {
  title: string;
  content: string;
  category?: string;
  created_by?: number;
  source_type?: string;
  metadata?: Record<string, unknown>;
}) {
  const source: any = await assistantKnowledgeSourceRepository.create({
    title: input.title,
    content: input.content,
    category: input.category || "general",
    source_type: input.source_type || "text",
    status: "pending",
    created_by: input.created_by,
    metadata: input.metadata,
  });

  const result = await ingestSourceContent(source.id, input.content, {
    title: input.title,
    category: input.category,
  });

  return { source, ...result };
}

export async function ingestUploadedFile(input: {
  filePath: string;
  fileName: string;
  mimeType?: string;
  title: string;
  category?: string;
  created_by?: number;
}) {
  const { text, format } = await extractTextFromKnowledgeFile(input.filePath, input.fileName);

  const source: any = await assistantKnowledgeSourceRepository.create({
    title: input.title,
    content: text.slice(0, 50000),
    category: input.category || "general",
    source_type: "file",
    status: "pending",
    created_by: input.created_by,
    file_path: input.filePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    metadata: { format, char_count: text.length },
  });

  const result = await ingestSourceContent(source.id, text, {
    title: input.title,
    category: input.category,
  });

  return {
    source,
    format,
    ...result,
  };
}
