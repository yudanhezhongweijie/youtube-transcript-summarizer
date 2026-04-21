import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, ErrorBody, ProcessResponse } from "./types";
import { consumeProcessSseStream } from "./processStream";
import "./app.css";

const STREAM_URL = "/api/process/stream";

// identifiers for section breaks
const TOPIC_SPEAKER = "BREAK";

function LoadingEllipsis() {
  return (
    <span className="yt-ts-e" aria-label="Loading" style={{ letterSpacing: 1, fontWeight: 600 }}>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

export default function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  /** Shown after the transcript when the user clicked Stop (not on navigate-away abort). */
  const [generationStopped, setGenerationStopped] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamRequestIdRef = useRef<string | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => streamAbortRef.current?.abort();
  }, []);

  /** Pin the scroll pane to the latest line / loading indicator as chunks arrive. */
  useEffect(() => {
    const pane = transcriptScrollRef.current;
    if (!pane) return;
    requestAnimationFrame(() => {
      pane.scrollTop = pane.scrollHeight;
    });
  }, [result?.messages?.length, loading, generationStopped]);

  /**
   * POST `/api/process/stop` first so the server can clear this stream by `requestId` while the SSE
   * connection is still registered; then abort the fetch. (SendBeacon has no ordering guarantee.)
   */
  function stopStream(): void {
    const rid = streamRequestIdRef.current;
    const ac = streamAbortRef.current;
    if (!ac) return;

    setGenerationStopped(true);

    if (rid) {
      void fetch("/api/process/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: rid }),
      })
        .catch(() => undefined)
        .finally(() => {
          ac.abort();
        });
    } else {
      ac.abort();
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    streamAbortRef.current?.abort();
    const ac = new AbortController();
    streamAbortRef.current = ac;
    const signal = ac.signal;

    const requestId = globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`;
    streamRequestIdRef.current = requestId;
    setGenerationStopped(false);

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(STREAM_URL, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          geminiApiKey: geminiApiKey.trim(),
        }),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const err = data as ErrorBody;
        throw new Error(err.error || err.detail || res.statusText || "Request failed");
      }

      let videoId: string | undefined;
      let messages: ChatMessage[] = [];

      await consumeProcessSseStream(
        res,
        {
          onInit: (d) => {
            videoId = d.videoId;
            setResult({
              videoId: d.videoId,
              messageCount: 0,
              messages: [],
            });
          },
          onMessage: (m) => {
            messages = [...messages, m];
            setResult({
              videoId,
              messageCount: messages.length,
              messages,
            });
          },
          onDone: (d) => {
            setResult({
              videoId: d.videoId ?? videoId,
              messageCount: d.messageCount ?? messages.length,
              messages,
            });
          },
          onError: (ev) => {
            throw new Error(ev.message);
          },
        },
        { signal },
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      if (streamAbortRef.current === ac) streamAbortRef.current = null;
      streamRequestIdRef.current = null;
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "1rem auto", padding: "0 0.75rem" }}>
      <h1 style={{ fontSize: "1.25rem" }}>YouTube transcript stream</h1>
      <p style={{ fontSize: "0.9rem", opacity: 0.85 }}>
        <strong>Live:</strong> with a URL and API key, the server streams raw captions as one &quot;Transcript&quot; message.
        <br />
        <strong> Mock:</strong> if the URL and key are missing (or the id cannot be parsed), the server streams a{" "}
        <em>sample Gemini-style summary</em>.
      </p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <label>
          YouTube URL or video id
          <input
            style={{ width: "100%", boxSizing: "border-box" }}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </label>
        <label>
          Gemini API key
          <input
            style={{ width: "100%", boxSizing: "border-box" }}
            type="password"
            autoComplete="off"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="API key"
          />
        </label>
        {loading ? (
          <button type="button" onClick={stopStream}>
            Stop
          </button>
        ) : (
          <button type="submit">Process video</button>
        )}
      </form>

      {error && (
        <pre style={{ color: "crimson", whiteSpace: "pre-wrap", marginTop: 12 }}>{error}</pre>
      )}

      {(loading || result != null || generationStopped) && (
        <section style={{ marginTop: 24 }} aria-busy={loading}>
          <h2 style={{ fontSize: "1.05rem" }}>Output</h2>
          <div
            ref={transcriptScrollRef}
            style={{
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: "12px 14px",
              maxHeight: "60vh",
              overflow: "auto",
            }}
          >
            {(() => {
              const messages = result?.messages ?? [];
              const statusRows = messages.filter((m) => m.speaker === "Status");
              const summaryRows = messages.filter((m) => m.speaker !== "Status");

              return (
                <>
                  {statusRows.map((m, i) => (
                    <div key={`status-${i}`} style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6, color: "#222" }}>{m.speaker}</div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#333" }}>{m.text}</div>
                    </div>
                  ))}

                  {summaryRows.length > 0 ? (
                    <div
                      style={{
                        marginTop: statusRows.length ? 8 : 0,
                        paddingTop: statusRows.length ? 12 : 0,
                        borderTop: statusRows.length ? "1px solid #e8e8e8" : undefined,
                      }}
                    >
                      {summaryRows.map((m, i) => {
                        if (m.speaker === TOPIC_SPEAKER) {
                          return (
                            <h3
                              key={`sum-${i}`}
                              style={{
                                fontSize: "1.02rem",
                                fontWeight: 650,
                                marginTop: i === 0 ? 0 : 22,
                                marginBottom: 12,
                                paddingBottom: 8,
                                borderBottom: "1px solid #e0e0e0",
                                color: "#111",
                              }}
                            >
                              {m.text}
                            </h3>
                          );
                        }
                        return (
                          <div key={`sum-${i}`} style={{ marginBottom: 14 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6, color: "#222" }}>{m.speaker}</div>
                            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#333" }}>{m.text}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              );
            })()}
            {(loading || generationStopped) && (
              <div
                style={{
                  marginTop: result?.messages?.length ? 10 : 0,
                  paddingTop: 8,
                  fontSize: "1.1rem",
                  color: loading ? "#444" : "#666",
                  fontStyle: loading ? "normal" : "italic",
                }}
                role="status"
              >
                {loading ? <LoadingEllipsis /> : "Transcript generation was stopped."}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
