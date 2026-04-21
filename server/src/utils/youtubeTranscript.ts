import { log } from "./logger";

/**
 * The package sets `"type": "module"` but `main` points at a CJS bundle; `require()` then fails at
 * runtime ("exports is not defined in ES module scope"). Load the ESM build explicitly.
 * @see https://github.com/Kakulukian/youtube-transcript
 */
const YT_ESM = "youtube-transcript/dist/youtube-transcript.esm.js" as const;

type YtModule = typeof import("youtube-transcript");

/** `tsc` with `module: CommonJS` rewrites `import()` to `require()` — breaks this ESM-only file. */
function dynamicImport<T>(specifier: string): Promise<T> {
  return new Function("s", "return import(s)")(specifier) as Promise<T>;
}

let ytCache: YtModule | null = null;

async function getYoutubeTranscript(): Promise<YtModule> {
  if (!ytCache) {
    ytCache = await dynamicImport<YtModule>(YT_ESM);
  }
  return ytCache;
}

/** Result of one caption fetch (plain text stays server-side until Gemini). */
export type YoutubeTranscriptFetchResult = {
  segmentCount: number;
  totalCueChars: number;
  /** Space-joined cue text for Gemini. */
  plainText: string;
};

/**
 * Fetches captions once; returns stats plus full text for `summarizeDialogue` (not sent raw to the browser).
 */
export async function fetchYoutubeTranscriptPlain(
  videoUrlOrId: string,
): Promise<YoutubeTranscriptFetchResult> {
  const { fetchTranscript } = await getYoutubeTranscript();
  const segments = await fetchTranscript(videoUrlOrId);
  const plainText = segments.map((s) => s.text).join(" ");
  const totalCueChars = segments.reduce((n, s) => n + s.text.length, 0);

  log("YouTube transcript fetched", {
    videoHint: String(videoUrlOrId).slice(0, 96),
    segmentCount: segments.length,
    totalCueChars,
  });

  return {
    segmentCount: segments.length,
    totalCueChars,
    plainText: plainText.trim(),
  };
}

/** Map `youtube-transcript` errors to a short client-facing message. */
export async function transcriptFetchErrorMessage(
  err: unknown,
): Promise<string> {
  const {
    YoutubeTranscriptTooManyRequestError,
    YoutubeTranscriptVideoUnavailableError,
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptNotAvailableLanguageError,
    YoutubeTranscriptError,
  } = await getYoutubeTranscript();

  if (err instanceof YoutubeTranscriptTooManyRequestError) {
    return "YouTube is rate-limiting transcript requests. Try again shortly.";
  }
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return "That video is unavailable or the id is invalid.";
  }
  if (err instanceof YoutubeTranscriptDisabledError) {
    return "Captions are disabled for this video.";
  }
  if (err instanceof YoutubeTranscriptNotAvailableError) {
    return "No transcript is available for this video.";
  }
  if (err instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return `No transcript in the requested language (try another track).`;
  }
  if (err instanceof YoutubeTranscriptError) {
    return err.message || "Could not fetch the transcript.";
  }
  return err instanceof Error ? err.message : String(err);
}
