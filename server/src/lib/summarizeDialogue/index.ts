import type { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatMessage, SummarizeDialogueOptions } from "../dialogueSummary";
import { summarizeDialogueWithGemini } from "./gemini/geminiSummarizer";

export type { SummarizeDialogueOptions };

export async function summarizeDialogue(
  genAI: GoogleGenerativeAI,
  modelName: string,
  transcriptText: string,
  options?: SummarizeDialogueOptions,
): Promise<ChatMessage[]> {
  return summarizeDialogueWithGemini(genAI, modelName, transcriptText, options);
}
