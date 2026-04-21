/** Gemini-only adapter: streaming JSON completion → {@link parseDialogueSummaryPayload}. */
import type {
  GenerativeModel,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import {
  parseDialogueSummaryPayload,
  stripJsonFence,
  type ChatMessage,
  type DialogueSummaryPayload,
  type SummarizeDialogueOptions,
} from "../../dialogueSummary";
import { GEMINI_API_REQUEST_OPTIONS } from "../../../utils/geminiConfig";
import { log } from "../../../utils/logger";

const PREVIEW_CHARS = 2_000;

function preview(s: string, max = PREVIEW_CHARS): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}… [truncated, total ${t.length} chars]`;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sdkErrorMeta(
  err: unknown,
): { status?: number; statusText?: string } | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as { status?: number; statusText?: string };
  if (o.status == null && o.statusText == null) return undefined;
  return { status: o.status, statusText: o.statusText };
}

/** Prompt for JSON dialogue summary tuned for Gemini `responseMimeType: application/json`. */
function buildGeminiDialogueSummaryPrompt(transcriptText: string): string {
  return `
You are given a raw long YouTube caption for the whole video. 
Infer distinct speakers from context. Merge short consecutive fragments from the same speaker into one turn where appropriate. Then summarize what each speakers said or asked. add section title and break if topic has changed.

Return ONLY valid JSON:
{"messages":[{"speaker":"string","text":"string"}]}

Rules:
- speaker: use names if clearly stated, otherwise neutral labels (Host, Guest 1, Interviewer, etc.).
- text: what that speaker said in that turn.
- translate the text content in chinese
- section break should following the format of {"messages":[{"speaker":"BREAK","text":"new title"]}
- the first section break should be the video title or the summary of the video, make it concise and clear.

Caption:
${JSON.stringify(transcriptText)}`;
}

async function generateDialogueSummaryViaGeminiStream(
  model: GenerativeModel,
  prompt: string,
  onTextChunk?: (delta: string) => void,
): Promise<DialogueSummaryPayload> {
  log("Gemini generateContentStream (summarize-json)", {
    promptChars: prompt.length,
    promptPreview: preview(prompt, 600),
  });

  let streamResult;
  try {
    streamResult = await model.generateContentStream(prompt);
  } catch (e) {
    log("Gemini error (summarize-json) — before stream", {
      ...sdkErrorMeta(e),
      messagePreview: preview(errMsg(e), 1_500),
    });
    throw e;
  }

  let accumulated = "";
  let chunkIndex = 0;

  try {
    for await (const chunk of streamResult.stream) {
      let delta = "";
      try {
        delta = chunk.text();
      } catch (e) {
        log("Gemini stream chunk error (summarize-json)", {
          ...sdkErrorMeta(e),
          messagePreview: preview(errMsg(e), 1_500),
        });
        throw e;
      }
      if (delta) {
        accumulated += delta;
        onTextChunk?.(delta);
      }
      log("Gemini stream chunk returned", {
        chunkIndex: chunkIndex++,
        deltaChars: delta.length,
        deltaPreview: delta ? preview(delta, 200) : "(empty)",
        accumulatedChars: accumulated.length,
      });
    }
  } catch (e) {
    log("Gemini error (summarize-json) — during stream", {
      ...sdkErrorMeta(e),
      messagePreview: preview(errMsg(e), 1_500),
    });
    throw e;
  }

  let text = accumulated.trim();
  if (!text) {
    try {
      text = (await streamResult.response).text();
      log(
        "Gemini: empty stream deltas; fell back to aggregated response text",
        {
          rawChars: text.length,
        },
      );
    } catch (e) {
      log(
        "Gemini error (summarize-json) — no accumulated text and aggregated response failed",
        {
          ...sdkErrorMeta(e),
          messagePreview: preview(errMsg(e), 1_500),
        },
      );
      throw e;
    }
  }

  log("Gemini: stream complete (summarize-json)", {
    rawChars: text.length,
    rawPreview: preview(text),
  });

  const raw = JSON.parse(stripJsonFence(text)) as unknown;
  return parseDialogueSummaryPayload(raw);
}

export async function summarizeDialogueWithGemini(
  genAI: GoogleGenerativeAI,
  modelName: string,
  transcriptText: string,
  options?: SummarizeDialogueOptions,
): Promise<ChatMessage[]> {
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    },
    GEMINI_API_REQUEST_OPTIONS,
  );

  log("Gemini summarizeDialogue: embedding transcript in prompt", {
    model: modelName,
    transcriptChars: transcriptText.length,
  });

  return (
    await generateDialogueSummaryViaGeminiStream(
      model,
      buildGeminiDialogueSummaryPrompt(transcriptText),
      options?.onTextChunk,
    )
  ).messages;
}
