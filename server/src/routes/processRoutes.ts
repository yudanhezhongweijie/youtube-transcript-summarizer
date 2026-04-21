import type { Express } from "express";
import { log } from "../utils/logger";
import { extractVideoId, watchUrlForVideoId } from "../utils/videoId";
import { initSse, safeResEnd, sseWrite } from "../utils/sse";
import { pipeLiveTranscriptToSse, pipeMockDialogueToSse } from "../transcriptSse";
import {
  invalidGeminiApiKeyHint,
  isGeminiApiKeyInvalidError,
  MOCK_SESSION_API_KEY,
  normalizeGeminiApiKey,
  resolveGeminiApiKeyWithSource,
  resolveGeminiModel,
} from "../utils/geminiConfig";
const MODEL = resolveGeminiModel();

function maskApiKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return `(len=${t.length})`;
  return `(len=${t.length}, suffix=…${t.slice(-4)})`;
}

/** `X-Request-Id` → cancel fn for active `/api/process/stream`. */
const activeStreamCancelByRequestId = new Map<string, () => void>();

export function registerProcessRoutes(app: Express): void {
  app.post("/api/process/stream", async (req, res) => {
    const rid = (req.get("x-request-id") || "").trim() || "—";
    const videoUrl = req.body?.videoUrl as string | undefined;
    const geminiApiKey = req.body?.geminiApiKey as string | undefined;

    let clientDisconnected = false;
    const markDisconnected = (): void => {
      clientDisconnected = true;
    };
    res.once("close", markDisconnected);
    req.on("aborted", markDisconnected);
    req.socket?.once("close", markDisconnected);
    const shouldContinue = (): boolean =>
      !clientDisconnected && !res.writableEnded;

    const trimmedUrl = (videoUrl ?? "").trim();
    const bodyKeyNorm = normalizeGeminiApiKey(geminiApiKey ?? "");
    const isMockSession =
      trimmedUrl === "" && bodyKeyNorm === MOCK_SESSION_API_KEY;

    if (isMockSession) {
      activeStreamCancelByRequestId.set(rid, markDisconnected);
      initSse(res);
      try {
        log(`POST /api/process/stream`, {
          requestId: rid,
          mockSession: true,
          videoId: "mock",
        });
        await pipeMockDialogueToSse(res, { requestId: rid, shouldContinue });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`POST /api/process/stream FAILED`, { requestId: rid, error: msg });
        try {
          if (!res.writableEnded) sseWrite(res, "error", { message: msg });
        } catch {
          /* headers may be closed */
        }
      } finally {
        activeStreamCancelByRequestId.delete(rid);
        safeResEnd(res);
      }
      return;
    }

    const videoIdFromUrl = trimmedUrl ? extractVideoId(trimmedUrl) : null;
    const { key: normalizedGeminiKey, source: geminiKeySource } =
      resolveGeminiApiKeyWithSource(geminiApiKey);
    const hasKey = geminiKeySource !== "none";

    if (!videoIdFromUrl) {
      res
        .status(400)
        .json({ error: "Could not parse a YouTube video id from videoUrl" });
      return;
    }
    if (!hasKey) {
      res.status(400).json({
        error:
          "Missing API key for live processing: set GEMINI_API_KEY in server .env",
      });
      return;
    }

    const videoId = videoIdFromUrl;
    const watchUrl = watchUrlForVideoId(videoId);

    activeStreamCancelByRequestId.set(rid, markDisconnected);

    initSse(res);
    try {
      log(`POST /api/process/stream`, {
        requestId: rid,
        videoId: videoIdFromUrl,
        geminiKey: maskApiKey(normalizedGeminiKey),
        geminiKeySource,
      });

      await pipeLiveTranscriptToSse(res, {
        requestId: rid,
        videoId,
        watchUrl,
        model: MODEL,
        geminiApiKey: normalizedGeminiKey,
        shouldContinue,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const payload = isGeminiApiKeyInvalidError(msg)
        ? `${msg} — ${invalidGeminiApiKeyHint()}`
        : msg;
      log(`POST /api/process/stream FAILED`, { requestId: rid, error: msg });
      try {
        if (!res.writableEnded) sseWrite(res, "error", { message: payload });
      } catch {
        /* headers may be closed */
      }
    } finally {
      activeStreamCancelByRequestId.delete(rid);
      safeResEnd(res);
    }
  });

  /** Marks the client disconnected so `shouldContinue()` stops the SSE writer (Gemini stream drains on its own). */
  app.post("/api/process/stop", (req, res) => {
    const rid =
      (req.body?.requestId as string | undefined)?.trim?.() ||
      (req.get("x-request-id") || "").trim() ||
      "—";
    const cancel = activeStreamCancelByRequestId.get(rid);
    cancel?.();
    log(`POST /api/process/stop`, {
      requestId: rid,
      cancelled: Boolean(cancel),
    });
    res.status(204).end();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, model: MODEL });
  });
}
