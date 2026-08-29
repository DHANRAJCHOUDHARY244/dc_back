import { assistantConversationRepository } from "../../repositories/assistantConversation.repository";
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantConfigDTO,
  AssistantUserAccess,
  ChatMessageDTO,
} from "../../types/assistant.types";
import { getRetrievalOptions, resolveUserAssistantAccess } from "../assistant.access.service";
import { buildAssistantContextBlock } from "../assistant.context.service";
import { getAssistantConfig } from "../assistant.config.service";
import { generateAssistantReply } from "../gemini/gemini.chat.service";
import { isGeminiConfigured } from "../gemini/gemini.client";
import {
  embedQuery,
  formatContextBlock,
  retrieveRelevantChunks,
} from "./retrieval.service";

export function assertAssistantAccess(user: any, config: AssistantConfigDTO): AssistantUserAccess {
  const access = resolveUserAssistantAccess(user, config);
  if (!access.allowed) {
    throw new Error(access.reason || "You do not have access to the assistant");
  }
  return access;
}

export async function chatWithAssistant(
  user: any,
  body: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  if (!(await isGeminiConfigured())) {
    throw new Error("Gemini API is not configured — add Google AI API key in CRM Settings");
  }

  const config = await getAssistantConfig();
  if (!config.enabled) throw new Error("Assistant is disabled");

  const access = assertAssistantAccess(user, config);

  const userId = Number(user.id);
  const message = String(body.message || "").trim();
  if (!message) throw new Error("Message is required");

  let conversation: any = null;
  let history: ChatMessageDTO[] = [];

  if (config.store_conversations) {
    if (body.conversation_id) {
      conversation = await assistantConversationRepository.findOne({
        id: body.conversation_id,
        user_id: userId,
      });
    }
    if (!conversation) {
      conversation = await assistantConversationRepository.create({
        user_id: userId,
        title: message.slice(0, 80),
        messages: [],
      });
    }
    history = (conversation.messages as ChatMessageDTO[]) || [];
  }

  let sources: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
  let ragContext = "";

  if (config.rag_enabled && config.tools_enabled.includes("search_knowledge")) {
    const retrieval = getRetrievalOptions(config, access);
    const queryCategories = retrieval.categories?.length
      ? [...new Set([...retrieval.categories, "rules"])]
      : undefined;

    const queryEmbedding = await embedQuery(message, config.embedding_model);
    sources = await retrieveRelevantChunks(queryEmbedding, {
      topK: retrieval.topK,
      threshold: retrieval.threshold,
      categories: queryCategories,
    });
    ragContext = formatContextBlock(sources);
  }

  const contextBlock = await buildAssistantContextBlock({
    config,
    access,
    ragContext,
    pageContext: body.page_context,
    user,
    userMessage: message,
  });

  const hasLiveCrmData =
    access.mcp && contextBlock.includes("LIVE CRM DATA");

  const reply = await generateAssistantReply({
    model: config.model,
    systemPrompt: config.system_prompt,
    temperature: config.temperature,
    maxOutputTokens: config.max_output_tokens,
    history: history.slice(-10),
    userMessage: message,
    contextBlock: contextBlock || undefined,
    hasLiveCrmData,
  });

  if (config.store_conversations && conversation) {
    const now = new Date().toISOString();
    const nextMessages: ChatMessageDTO[] = [
      ...history,
      { role: "user", content: message, created_at: now },
      { role: "assistant", content: reply, created_at: now },
    ];
    await assistantConversationRepository.updateById(conversation.id, {
      $set: {
        messages: nextMessages,
        last_message_at: new Date(),
        title: conversation.title === "New chat" ? message.slice(0, 80) : conversation.title,
      },
    });
  }

  return {
    conversation_id: conversation?.id,
    reply,
    sources,
    model: config.model,
  };
}

export async function listUserConversations(userId: number) {
  return assistantConversationRepository.find(
    { user_id: userId },
    { sort: { last_message_at: -1 }, limit: 30, lean: true },
  );
}

export async function getConversation(userId: number, conversationId: number) {
  return assistantConversationRepository.findOne(
    { id: conversationId, user_id: userId },
    { lean: true },
  );
}

export async function getAssistantStatusForUser(user: any, config: AssistantConfigDTO) {
  const access = resolveUserAssistantAccess(user, config);
  return {
    configured: await isGeminiConfigured(),
    enabled: config.enabled && access.allowed,
    model: config.model,
    rag_enabled: config.rag_enabled,
    welcome_message: config.welcome_message,
    access,
  };
}
