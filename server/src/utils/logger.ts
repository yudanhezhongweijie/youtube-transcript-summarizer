/** Terminal-only logging (Node process stdout). */
export function log(msg: string, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[server] ${msg}`, extra);
  } else {
    console.log(`[server] ${msg}`);
  }
}
