/** Server-only configuration. Values are read lazily so builds never require secrets. */
function num(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const limits = {
  get maxUploadBytes() { return num("MAX_UPLOAD_MB", 10) * 1024 * 1024; },
  get maxEvidencePerCase() { return num("MAX_EVIDENCE_PER_CASE", 10); },
  get maxUserStorageBytes() { return num("MAX_USER_STORAGE_MB", 100) * 1024 * 1024; },
  get aiDailyLimit() { return num("AI_DAILY_LIMIT", 8); },
  get ttsDailyLimit() { return num("TTS_DAILY_LIMIT", 3); },
  get sttDailyLimit() { return num("STT_DAILY_LIMIT", 15); },
  get aiMaxInputChars() { return num("AI_MAX_INPUT_CHARS", 60000); },
};

export class ConfigError extends Error {
  constructor(public missing: string[], public service: string) {
    super(`${service} is not configured. Set ${missing.join(", ")} on the server.`);
  }
}

function need(service: string, names: string[]) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) throw new ConfigError(missing, service);
  return names.map((n) => process.env[n] as string);
}

/** English uses ELEVENLABS_VOICE_ID; Hinglish uses ELEVENLABS_VOICE_ID_HINGLISH when set. */
export function voiceFor(language: "en" | "hinglish") {
  return (language === "hinglish" && process.env.ELEVENLABS_VOICE_ID_HINGLISH) || process.env.ELEVENLABS_VOICE_ID || "";
}

export const config = {
  mongo() {
    const [uri] = need("MongoDB", ["MONGODB_URI"]);
    return { uri, dbName: process.env.MONGODB_DB_NAME || "parcelproof" };
  },
  gemma() {
    const [apiKey] = need("Gemma (Gemini API)", ["GEMMA_API_KEY"]);
    return { apiKey, modelId: process.env.GEMMA_MODEL_ID || "gemma-4-26b-a4b-it" };
  },
  elevenlabs(language: "en" | "hinglish" = "en") {
    const [apiKey] = need("ElevenLabs", ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]);
    return { apiKey, voiceId: voiceFor(language), modelId: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2" };
  },
  elevenlabsKey() {
    const [apiKey] = need("ElevenLabs", ["ELEVENLABS_API_KEY"]);
    return apiKey;
  },
  /** Non-throwing status for the settings page. Never exposes values. */
  status() {
    const has = (n: string) => Boolean(process.env[n]);
    return {
      auth: has("AUTH_SECRET") && has("AUTH_GOOGLE_ID") && has("AUTH_GOOGLE_SECRET"),
      mongo: has("MONGODB_URI"),
      gemma: has("GEMMA_API_KEY"),
      gemmaModel: process.env.GEMMA_MODEL_ID || "gemma-4-26b-a4b-it",
      voice: has("ELEVENLABS_API_KEY") && has("ELEVENLABS_VOICE_ID"),
    };
  },
};
