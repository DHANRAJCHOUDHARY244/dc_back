import { getGeminiClient } from "./gemini.client";
import type { ChatMessageDTO } from "../../types/assistant.types";

export type GeminiChatOptions = {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  history?: ChatMessageDTO[];
  userMessage: string;
  contextBlock?: string;
  hasLiveCrmData?: boolean;
};

export async function generateAssistantReply(options: GeminiChatOptions): Promise<string> {
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: options.model,
    systemInstruction: options.systemPrompt,
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    },
  });

  const parts: { role: string; parts: { text: string }[] }[] = [];

  if (options.contextBlock) {
    const liveHint = options.hasLiveCrmData
      ? "IMPORTANT: LIVE CRM DATA below has real current numbers — use them exactly. Format your reply with markdown: **bold** headings, a table for role counts (| Role | Count |), and a numbered list for user names (one line per item). Do NOT say you lack access. Do NOT share passwords or secrets.\n\n"
      : "";
    parts.push({
      role: "user",
      parts: [
        {
          text: `${liveHint}Below is internal reference material for you only. Use it to answer in simple everyday language. Do not mention files, code, databases, or article titles.\n\n${options.contextBlock}`,
        },
      ],
    });
    parts.push({
      role: "model",
      parts: [
        {
          text: options.hasLiveCrmData
            ? "Understood. I will use the live CRM numbers provided and answer clearly without mentioning technical systems."
            : "Understood. I will help in plain, friendly language without technical jargon.",
        },
      ],
    });
  }

  for (const msg of options.history || []) {
    if (msg.role === "system") continue;
    parts.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  parts.push({ role: "user", parts: [{ text: options.userMessage }] });

  const chat = model.startChat({ history: parts.slice(0, -1) });
  const last = parts[parts.length - 1];
  const result = await chat.sendMessage(last.parts[0].text);
  const text = result.response.text();
  return text?.trim() || "I couldn't generate a response. Please try again.";
}
