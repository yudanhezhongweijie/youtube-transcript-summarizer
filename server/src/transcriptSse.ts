import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Response } from "express";
import {
  parsePartialDialogueSummaryJson,
  type ChatMessage,
} from "./lib/dialogueSummary";
import { mockDialogueSummary } from "./lib/summarizeDialogue/mock/mockSummarizer";
import { summarizeDialogue } from "./lib/summarizeDialogue";
import { sseWrite } from "./utils/sse";
import {
  fetchYoutubeTranscriptPlain,
  transcriptFetchErrorMessage,
} from "./utils/youtubeTranscript";
import { log } from "./utils/logger";

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Space out `message` events so the client can render one bubble per tick (avoids React batching one huge update). */
const SSE_MESSAGE_GAP_MS = 28;

export type LiveTranscriptSseContext = {
  requestId: string;
  videoId: string;
  watchUrl: string;
  model: string;
  geminiApiKey: string;
  shouldContinue: () => boolean;
};

/**
 * Downloads transcript → status line → `summarizeDialogue` → SSE `message` rows
 * (summary lines stream as each JSON object completes; same shape as final messages).
 */
export async function writeLiveTranscriptSse(
  res: Response,
  youtubeWatchUrl: string,
  videoId: string,
  model: string,
  geminiApiKey: string,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  if (!shouldContinue()) return;

  let fetched;
  try {
    fetched = await fetchYoutubeTranscriptPlain(youtubeWatchUrl);
  } catch (e) {
    throw new Error(await transcriptFetchErrorMessage(e));
  }
  if (!fetched.plainText || fetched.segmentCount === 0) {
    throw new Error("No transcript returned for this video.");
  }
  if (!shouldContinue()) return;

  sseWrite(res, "init", { videoId });
  if (!shouldContinue()) return;

  const downloaded: ChatMessage = {
    speaker: "Status",
    text: `Transcript downloaded (${fetched.segmentCount.toLocaleString()} cues). Sending to Gemini…`,
  };
  sseWrite(res, "message", downloaded);
  if (!shouldContinue()) return;

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  let streamJsonBuffer = "";
  let emittedSummaryCount = 0;

  const emitNewMessagesFromStreamBuffer = (): void => {
    const parsed = parsePartialDialogueSummaryJson(streamJsonBuffer);
    while (emittedSummaryCount < parsed.length && shouldContinue()) {
      sseWrite(res, "message", parsed[emittedSummaryCount]);
      emittedSummaryCount++;
    }
  };

  let summaryMessages: ChatMessage[];
  try {
    summaryMessages = await summarizeDialogue(genAI, model, fetched.plainText, {
      onTextChunk: (delta) => {
        if (!delta || !shouldContinue()) return;
        streamJsonBuffer += delta;
        emitNewMessagesFromStreamBuffer();
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("summarizeDialogue failed", { videoId, error: msg });
    throw e;
  }

  if (!shouldContinue()) return;

  log("SSE live: streaming summary messages", {
    videoId,
    messageCount: summaryMessages.length,
    streamedDuringGeneration: emittedSummaryCount,
  });

  for (let i = emittedSummaryCount; i < summaryMessages.length; i++) {
    if (!shouldContinue()) return;
    sseWrite(res, "message", summaryMessages[i]);
    if (i < summaryMessages.length - 1) {
      await delayMs(SSE_MESSAGE_GAP_MS);
    }
  }

  if (!shouldContinue()) return;
  sseWrite(res, "done", {
    videoId,
    messageCount: 1 + summaryMessages.length,
  });
}

/** Route handler glue: log context, then run the live transcript + summary pipeline. */
export async function pipeLiveTranscriptToSse(
  res: Response,
  ctx: LiveTranscriptSseContext,
): Promise<void> {
  log("live transcript SSE", {
    requestId: ctx.requestId,
    videoId: ctx.videoId,
    model: ctx.model,
  });
  await writeLiveTranscriptSse(
    res,
    ctx.watchUrl,
    ctx.videoId,
    ctx.model,
    ctx.geminiApiKey,
    ctx.shouldContinue,
  );
}

const MOCK_SSE_VIDEO_ID = "mock";

/**
 * Demo SSE: no YouTube fetch, no Gemini — streams chunked sample dialogue JSON (trigger: empty URL + body key 54321).
 */
export async function writeMockDialogueSse(
  res: Response,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  if (!shouldContinue()) return;

  sseWrite(res, "init", { videoId: MOCK_SSE_VIDEO_ID });
  if (!shouldContinue()) return;

  const status: ChatMessage = {
    speaker: "Status",
    text: "Mock session (empty URL + key 54321). Streaming sample dialogue…",
  };
  sseWrite(res, "message", status);
  if (!shouldContinue()) return;

  let streamJsonBuffer = "";
  let emittedSummaryCount = 0;

  const emitNewMessagesFromStreamBuffer = (): void => {
    const parsed = parsePartialDialogueSummaryJson(streamJsonBuffer);
    while (emittedSummaryCount < parsed.length && shouldContinue()) {
      sseWrite(res, "message", parsed[emittedSummaryCount]);
      emittedSummaryCount++;
    }
  };

  let summaryMessages: ChatMessage[];
  try {
    summaryMessages = await mockDialogueSummary({
      onTextChunk: (delta) => {
        if (!delta || !shouldContinue()) return;
        streamJsonBuffer += delta;
        emitNewMessagesFromStreamBuffer();
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("mockDialogueSummary failed", { error: msg });
    throw e;
  }

  if (!shouldContinue()) return;

  log("SSE mock: streaming summary messages", {
    videoId: MOCK_SSE_VIDEO_ID,
    messageCount: summaryMessages.length,
    streamedDuringGeneration: emittedSummaryCount,
  });

  for (let i = emittedSummaryCount; i < summaryMessages.length; i++) {
    if (!shouldContinue()) return;
    sseWrite(res, "message", summaryMessages[i]);
    if (i < summaryMessages.length - 1) {
      await delayMs(SSE_MESSAGE_GAP_MS);
    }
  }

  if (!shouldContinue()) return;
  sseWrite(res, "done", {
    videoId: MOCK_SSE_VIDEO_ID,
    messageCount: 2 + summaryMessages.length,
  });
}

export async function pipeMockDialogueToSse(
  res: Response,
  ctx: { requestId: string; shouldContinue: () => boolean },
): Promise<void> {
  log("mock dialogue SSE", { requestId: ctx.requestId, videoId: MOCK_SSE_VIDEO_ID });
  await writeMockDialogueSse(res, ctx.shouldContinue);
}
