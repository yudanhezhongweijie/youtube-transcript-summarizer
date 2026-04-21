/**
 * Dialogue summarization contract: JSON shape and parsing (provider-agnostic).
 * Prompts live with each adapter (e.g. Gemini).
 */

export interface ChatMessage {
  speaker: string;
  text: string;
}

/** Parsed model output before expanding to a flat `ChatMessage[]`. */
export type DialogueSummaryPayload = {
  messages: ChatMessage[];
};

/** Optional observers while the model streams JSON (before parse). */
export type SummarizeDialogueOptions = {
  onTextChunk?: (delta: string) => void;
};

export function stripJsonFence(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isChatMessageRow(x: unknown): x is ChatMessage {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.speaker === "string" && typeof o.text === "string";
}

export function parsePartialDialogueSummaryJson(input: string): ChatMessage[] {
  const m = /"messages"\s*:\s*\[/u.exec(input);
  if (!m) return [];

  let i = m.index + m[0].length;
  const out: ChatMessage[] = [];

  outer: while (i < input.length) {
    while (i < input.length && /[\s,\n\r\t]/.test(input[i])) i++;
    if (i >= input.length) break;
    if (input[i] === "]") break;
    if (input[i] !== "{") break;

    const objStart = i;
    let depth = 0;
    let inStr = false;
    let esc = false;

    for (let j = objStart; j < input.length; j++) {
      const c = input[j];
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === "\\") {
          esc = true;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === "{") {
        depth++;
        continue;
      }
      if (c === "}") {
        depth--;
        if (depth === 0) {
          const slice = input.slice(objStart, j + 1);
          try {
            const o = JSON.parse(slice) as Record<string, unknown>;
            if (typeof o.speaker === "string" && typeof o.text === "string") {
              out.push({ speaker: o.speaker, text: o.text });
            }
          } catch {
            /* skip */
          }
          i = j + 1;
          continue outer;
        }
      }
    }
    break;
  }

  return out;
}

export function parseDialogueSummaryPayload(
  raw: unknown,
): DialogueSummaryPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Dialogue summary JSON: expected top-level object");
  }
  const messages = (raw as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) {
    throw new Error("Dialogue summary JSON: missing `messages` array");
  }
  const out: ChatMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const row = messages[i];
    if (!isChatMessageRow(row)) {
      throw new Error(
        `Dialogue summary JSON: invalid message at index ${i} (need { speaker, text } strings)`,
      );
    }
    out.push({ speaker: row.speaker, text: row.text });
  }
  return { messages: out };
}
