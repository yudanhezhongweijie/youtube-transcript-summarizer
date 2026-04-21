import type { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatMessage, SummarizeDialogueOptions } from "../dialogueSummary";
import { summarizeDialogueWithGemini } from "./gemini/geminiSummarizer";
import { mockDialogueSummary } from "./mock/mockSummarizer";
import { log } from "src/utils/logger";

export type { SummarizeDialogueOptions };

function useMockDialogueSummary(): boolean {
  return Boolean(process.env.USE_MOCK);
}

export async function summarizeDialogue(
  genAI: GoogleGenerativeAI,
  modelName: string,
  transcriptText: string,
  options?: SummarizeDialogueOptions,
): Promise<ChatMessage[]> {
  log("useMock", { useMock: useMockDialogueSummary() });
  if (useMockDialogueSummary()) {
    return mockDialogueSummary(options);
  }
  return summarizeDialogueWithGemini(genAI, modelName, transcriptText, options);
}
