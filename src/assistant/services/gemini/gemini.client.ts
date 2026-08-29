import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGoogleApiKeyFromSettings } from "@services/crmSettings.service";

let client: GoogleGenerativeAI | null = null;
let cachedApiKey: string | null = null;

export async function getGeminiClient(): Promise<GoogleGenerativeAI> {
  const apiKey = await getGoogleApiKeyFromSettings();
  if (!apiKey) {
    throw new Error("Google AI API key is not configured in CRM settings");
  }
  if (!client || cachedApiKey !== apiKey) {
    client = new GoogleGenerativeAI(apiKey);
    cachedApiKey = apiKey;
  }
  return client;
}

export async function isGeminiConfigured(): Promise<boolean> {
  const apiKey = await getGoogleApiKeyFromSettings();
  return Boolean(apiKey);
}
