export const PLACEHOLDER_VIDEO_ID = "___________";

/** YouTube video ids are 11 chars from this alphabet. */
export const STANDALONE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export function extractVideoId(url: string): string | null {
  const t = url.trim();
  if (STANDALONE_VIDEO_ID.test(t)) return t;
  const m = t.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  );
  return m?.[1] ?? null;
}

export function watchUrlForVideoId(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
