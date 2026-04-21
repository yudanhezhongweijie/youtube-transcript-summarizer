/**
 * Fetch captions with `youtube-transcript` (run via `npm run download:transcript` in `server/`).
 *
 *   npm run download:transcript -- -u "<url-or-id>" [-o path] [-l lang]
 */

import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

import type { TranscriptResponse } from "youtube-transcript";

/** CJS entry — Node ESM often lacks named exports for this package. */
const require = createRequire(import.meta.url);
const { fetchTranscript } =
  require("youtube-transcript") as typeof import("youtube-transcript");

function render(segments: TranscriptResponse[]): { body: string; ext: string } {
  return {
    body: `${segments.map((s) => s.text).join(" ")}\n`,
    ext: "txt",
  };
}

async function main(): Promise<void> {
  let values: {
    url?: string;
    out?: string;
    lang?: string;
    help?: boolean;
  };
  try {
    ({ values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        url: { type: "string", short: "u" },
        out: { type: "string", short: "o" },
        lang: { type: "string", short: "l" },
        help: { type: "boolean", short: "h", default: false },
      },
    }));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  if (values.help || !values.url?.trim()) {
    console.error(
      "Usage: npm run download:transcript -- -u <youtube-url-or-id> [-o file] [-l lang]",
    );
    process.exit(values.help ? 0 : 1);
  }

  const segments = await fetchTranscript(values.url.trim(), {
    ...(values.lang?.trim() ? { lang: values.lang.trim() } : {}),
  });

  const { body } = render(segments);

  const outPath = values.out?.trim();
  if (outPath) {
    await writeFile(outPath, body, "utf8");
    console.error(`Wrote ${segments.length} segments → ${outPath}`);
  } else {
    process.stdout.write(body);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
