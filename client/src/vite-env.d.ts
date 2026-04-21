/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full origin of the API (e.g. `https://youtube-transcript-api.onrender.com`). No trailing slash. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
