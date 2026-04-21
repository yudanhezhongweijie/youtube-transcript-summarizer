/**
 * API origin for production when the UI and API are on different hosts (e.g. two Render services).
 * Set at **build time**: `VITE_API_BASE_URL=https://your-api.onrender.com` (no trailing slash).
 * Leave unset for local dev — Vite proxies `/api` to the backend (see `vite.config.ts`).
 */
function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (raw == null || raw === "") return "";
  return String(raw).replace(/\/+$/, "");
}

/** Absolute or same-origin path for `fetch` (e.g. `/api/process/stream`). */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = apiBase();
  if (!base) return p;
  return `${base}${p}`;
}
