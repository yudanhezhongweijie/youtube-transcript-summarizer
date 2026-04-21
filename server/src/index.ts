import { createApp } from "./app";
import { log } from "./utils/logger";
import { resolveGeminiModel } from "./utils/geminiConfig";

const PORT = Number(process.env.PORT) || 9993;
const MODEL = resolveGeminiModel();

const app = createApp();

app.listen(PORT, () => {
  const envModel = process.env.GEMINI_MODEL?.trim();
  log(`listening`, {
    port: PORT,
    model: MODEL,
    geminiModelEnv: envModel || "(unset)",
    gemini2FlashRemappedToLatest: envModel === "gemini-2.0-flash",
    geminiApiKeyFromEnv: Boolean(process.env.GEMINI_API_KEY?.trim()),
  });
});
