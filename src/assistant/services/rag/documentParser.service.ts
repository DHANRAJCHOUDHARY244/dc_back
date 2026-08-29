import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
// pdf-parse v1 — simple buffer API
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text?: string }>;
import WordExtractor from "word-extractor";

const SUPPORTED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".pdf",
  ".doc",
  ".docx",
]);

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);

export function isSupportedKnowledgeFile(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(String(fileName || "")).toLowerCase());
}

export function getSupportedKnowledgeExtensions(): string[] {
  return Array.from(SUPPORTED_EXTENSIONS);
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parsePdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return normalizeExtractedText(data.text || "");
}

async function parseDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return normalizeExtractedText(result.value || "");
}

async function parseDoc(filePath: string): Promise<string> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(filePath);
  return normalizeExtractedText(doc.getBody() || "");
}

async function parsePlainText(filePath: string): Promise<string> {
  const text = await fs.readFile(filePath, "utf8");
  return normalizeExtractedText(text);
}

/**
 * Extract plain text from uploaded knowledge files (PDF, DOC, DOCX, MD, TXT).
 */
export async function extractTextFromKnowledgeFile(
  filePath: string,
  fileName?: string,
): Promise<{ text: string; format: string }> {
  const ext = path.extname(fileName || filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file type "${ext || "unknown"}". Supported: ${getSupportedKnowledgeExtensions().join(", ")}`,
    );
  }

  let text = "";
  if (ext === ".pdf") {
    text = await parsePdf(filePath);
  } else if (ext === ".docx") {
    text = await parseDocx(filePath);
  } else if (ext === ".doc") {
    text = await parseDoc(filePath);
  } else if (TEXT_EXTENSIONS.has(ext)) {
    text = await parsePlainText(filePath);
  }

  if (!text) {
    throw new Error("No readable text found in file. Try a text-based PDF or DOCX.");
  }

  return { text, format: ext.replace(".", "") };
}
