import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";

import { log } from "./logger";

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
export function transcriptFetchErrorMessage(err: unknown): string {
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
