# youtube-transcript-stream

Stream a YouTube video’s captions through the server, summarize them with Google Gemini as structured dialogue (with optional mock mode), and show results in a small React app with **Server-Sent Events (SSE)** so summary lines appear as they are produced.

## Prerequisites

- **Node.js** 18+ (the repo uses current LTS-friendly tooling)
- A **Google AI (Gemini) API key** when not using mock mode — [API key docs](https://ai.google.dev/gemini-api/docs/api-key)

## Install

From the repository root (npm workspaces install `server` and `client` together):

```bash
npm install
```

## Configuration

For **local dev**, the server loads a **`.env` file at the repository root** (`npm run dev:server` and `npm run start:local` use `node --env-file=../.env`). For **`npm start`** (including hosted deploys), set variables in the host’s environment (e.g. Render **Environment**); there is no `.env` file on the server.

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`:

   | Variable | Purpose |
   |----------|---------|
   | `GEMINI_API_KEY` | Your Gemini API key. Required for live summarization unless you rely on the key field in the web UI (see below). |
   | `GEMINI_MODEL` | Model id (default in `.env.example` is `gemini-flash-latest`). Empty/unset falls back to `gemini-flash-latest`. |
   | `USE_MOCK` | Set to `1` (or any non-empty value) to use the built-in mock summarizer **without** calling Gemini — useful for UI and SSE testing. |

**API key resolution:** If `GEMINI_API_KEY` is set in `.env`, it **wins** over the key typed in the browser. To test with a key from the UI only, leave `GEMINI_API_KEY` unset in `.env`.

## Run the app

You need **two terminals**: API on **9993**, Vite dev server on **9990** (Vite proxies `/api` to the API).

**Terminal 1 — API**

```bash
npm run dev:server
```

**Terminal 2 — web UI**

```bash
npm run dev:client
```

Open **http://localhost:9990**, paste a YouTube URL (or video id), add your Gemini API key if required, and submit. The page streams summary lines as SSE `message` events.

### Production-style run

Build server + client from the repo root, then start the API (reads `process.env` only):

```bash
npm run build
npm start
```

To run the compiled server **locally** with a root `.env` file, use `npm run start:local --workspace=server` instead of `npm start`.

The server listens on **`PORT`** when set (e.g. Render), otherwise **9993**.

Build the client and serve the static output with any static host, or `npm run preview --workspace=client` after `npm run build --workspace=client`. For local preview, configure the same `/api` proxy or point requests at `http://127.0.0.1:9993`.

### Deploy both frontend and backend on Render

You use **two services** in one Render project, both from the **same Git repo**: a **Web Service** (Node API) and a **Static Site** (Vite build). The API and the static HTML are on **different URLs**, so the client build must include your API’s public URL via **`VITE_API_BASE_URL`** (see step 11).

**Before you start**

1. Push this repo to **GitHub** (or GitLab / Bitbucket — whatever Render supports for your account).
2. Sign up or log in at [dashboard.render.com](https://dashboard.render.com).

---

**Part 1 — Deploy the API (do this first)**

1. Click **New +** → **Web Service**.
2. Connect the repository and select this project.
3. **Name:** e.g. `youtube-transcript-api` (any name; it becomes part of the URL).
4. **Region:** choose one close to you.
5. **Branch:** usually `main` (or your default branch).
6. **Runtime:** **Node**.
7. **Build command:**  
   `npm ci && npm run build`  
   (Uses the committed `package-lock.json`. If you prefer, `npm install && npm run build` also works.)
8. **Start command:**  
   `npm start`
9. **Instance type:** Free is fine to try (service may sleep when idle).
10. Open **Environment** and add:

    | Key | Notes |
    |-----|--------|
    | `GEMINI_API_KEY` | Your Gemini key, unless users rely only on the in-app key field |
    | `GEMINI_MODEL` | e.g. `gemini-flash-latest` |
    | `USE_MOCK` | Omit for real Gemini; set to `1` if you only want the mock summarizer |

    Do **not** set `PORT` yourself — Render injects it.

11. Click **Create Web Service** and wait until the first deploy **succeeds**.
12. Copy the service URL from the dashboard, e.g. `https://youtube-transcript-api.onrender.com` (you will need the **https** origin in Part 2).

13. **Smoke test the API:** open in a browser or run:
    ```bash
    curl -sS "https://<your-api-host>/api/health"
    ```
    You should see JSON like `{"ok":true,"model":"..."}`.

---

**Part 2 — Deploy the frontend (Static Site)**

14. In the same Render dashboard, click **New +** → **Static Site**.
15. Connect the **same** repository.
16. **Name:** e.g. `youtube-transcript-web`.
17. **Branch:** same as the API.
18. **Build command:**  
    `npm ci && npm run build --workspace=client`
19. **Publish directory:**  
    `client/dist`
20. Open **Environment** for this Static Site and add:

    | Key | Value |
    |-----|--------|
    | `VITE_API_BASE_URL` | Exactly your API’s origin, e.g. `https://youtube-transcript-api.onrender.com` — **no path, no trailing slash** |

    Vite reads this **when the client is built**. It is not read at runtime from the browser.

21. Click **Create Static Site** and wait for the build to finish.
22. Open the **Static Site URL** Render shows you; that is your app. Submit a video URL and confirm summaries stream.

---

**If something fails**

- **`npm error Exit handler never called` during build:** (1) Ensure **`package-lock.json` was generated against the public registry**, not a private mirror (e.g. corporate Artifactory). This repo includes **`.npmrc`** with `registry=https://registry.npmjs.org/` so `npm install` stays portable; if your lockfile pointed at an internal host, regenerate it (`rm package-lock.json && npm install`) and commit. (2) Very new **Node** (e.g. 25.x) can also trigger npm bugs — this repo pins **Node 22** via `.nvmrc` and `engines`. Optional: set **`NODE_VERSION`**=`22` on the service ([Render Node versions](https://render.com/docs/node-version)).
- **Web Service root directory:** use the **repository root** (leave “Root Directory” empty) so `npm install` runs the **workspace** and `npm run build` builds both `client` and `server`. If you only pointed Render at `server/`, use `server/.nvmrc` and a build that matches that layout.
- **First request after idle is very slow:** on the free Web Service tier the API **sleeps**; wait ~30–60s and retry, or upgrade the instance.
- **UI loads but API errors / network errors:** confirm `VITE_API_BASE_URL` matches the **Web Service** URL (scheme `https`, no trailing slash) and **redeploy** the Static Site after changing env vars (the value is baked into the JS bundle at build time).
- **CORS:** the server uses `cors({ origin: true })`, so browser calls from your static site’s origin to the API are allowed.

**Local dev is unchanged:** leave `VITE_API_BASE_URL` unset so the app keeps using `/api` and the Vite dev proxy.

## HTTP API (for integrations)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | JSON: `{ ok, model }` |
| `POST` | `/api/process/stream` | Body: `{ "videoUrl": "<youtube url or id>" , "geminiApiKey": "<optional>" }`. Returns **SSE**: `init`, `message` (summary rows), `done`, or `error`. Send header `X-Request-Id` to correlate with stop. |
| `POST` | `/api/process/stop` | Body: `{ "requestId": "<same as X-Request-Id>" }` — stops the stream server-side when the client disconnects or user clicks Stop. |

## Download a transcript (CLI)

Helper script to pull captions with [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript) and write a `.txt` file:

```bash
cd server
npm run download:transcript -- -u "https://www.youtube.com/watch?v=VIDEO_ID" -o ./out.txt
```

Use `-l <lang>` for a language code if needed; run with `-h` for options (see `server/test/download-transcript.ts`).

## Project layout

- `server/` — Express app, YouTube transcript fetch, Gemini (or mock) summarization, SSE.
- `client/` — Vite + React UI consuming `/api/process/stream`.
