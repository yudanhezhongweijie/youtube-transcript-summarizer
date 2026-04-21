import type { Response } from "express";

export function initSse(res: Response): void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  const flush = (res as Response & { flushHeaders?: () => void }).flushHeaders;
  flush?.call(res);
}

export function sseWrite(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Idempotent `res.end()` for stream handlers (avoids double-end if the client already closed). */
export function safeResEnd(res: Response): void {
  if (res.writableEnded) return;
  res.end();
}
