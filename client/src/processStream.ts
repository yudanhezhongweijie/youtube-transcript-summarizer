import type { ChatMessage } from "./types";

export type ProcessStreamHandlers = {
  onInit?: (data: { videoId: string }) => void;
  onMessage?: (msg: ChatMessage) => void;
  onDone?: (data: { videoId?: string; messageCount?: number }) => void;
  onError?: (data: { message: string }) => void;
};

export type ConsumeStreamOptions = {
  /** Abort closes the reader so the HTTP connection ends cleanly when navigating away or resubmitting. */
  signal?: AbortSignal;
};

/**
 * Reads Server-Sent Events from a fetch Response body (`event:` / `data:` blocks).
 * Normalizes CRLF so `\r\n\r\n` frame boundaries parse like `\n\n`.
 */
export async function consumeProcessSseStream(
  res: Response,
  handlers: ProcessStreamHandlers,
  options?: ConsumeStreamOptions,
): Promise<void> {
  const signal = options?.signal;
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const onAbort = () => {
    reader.cancel().catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
      throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", onAbort);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const processBlock = (block: string): void => {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      const L = line.replace(/\r$/, "");
      if (L.startsWith("event:")) eventName = L.slice(6).trim();
      else if (L.startsWith("data:")) dataLines.push(L.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    const payload = JSON.parse(dataLines.join("\n")) as unknown;

    switch (eventName) {
      case "init":
        handlers.onInit?.(payload as { videoId: string });
        break;
      case "message":
        handlers.onMessage?.(payload as ChatMessage);
        break;
      case "done":
        handlers.onDone?.(
          payload as { videoId?: string; messageCount?: number },
        );
        break;
      case "error":
        handlers.onError?.(payload as { message: string });
        break;
      default:
        break;
    }
  };

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (block.trim()) processBlock(block);
      }
    }

    const tail = buffer.replace(/\r\n/g, "\n").trim();
    if (tail) processBlock(tail);
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
