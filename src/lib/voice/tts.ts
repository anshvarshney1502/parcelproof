import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { config } from "../env";

export class VoiceError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface TtsClient {
  voiceId: string;
  modelId: string;
  /** Returns MP3 audio plus, when available, the start time of each character (for word-synced transcripts). */
  synthesize(text: string, style: "calm" | "balanced"): Promise<{ audio: Uint8Array; alignment?: Alignment }>;
}

export type Alignment = { characters: string[]; starts: number[] };

export const VOICE_SETTINGS = {
  calm: { stability: 0.7, similarityBoost: 0.75, style: 0, speed: 0.95 },
  balanced: { stability: 0.5, similarityBoost: 0.75, style: 0.15, speed: 1 },
} as const;

export function elevenLabsClient(language: "en" | "hinglish" = "en"): TtsClient {
  const { apiKey, voiceId, modelId } = config.elevenlabs(language);
  const client = new ElevenLabsClient({ apiKey, timeoutInSeconds: 90, maxRetries: 0 });
  return {
    voiceId,
    modelId,
    async synthesize(text, style) {
      try {
        const res = await client.textToSpeech.convertWithTimestamps(voiceId, {
          text,
          modelId,
          outputFormat: "mp3_44100_128",
          voiceSettings: VOICE_SETTINGS[style],
        });
        const audio = Buffer.from(res.audioBase64 ?? "", "base64");
        if (!audio.byteLength) throw new VoiceError("ElevenLabs returned no audio.", 502);
        const al = res.alignment ?? res.normalizedAlignment;
        return { audio, alignment: al ? { characters: al.characters, starts: al.characterStartTimesSeconds } : undefined };
      } catch (e) {
        throw toVoiceError(e);
      }
    },
  };
}

export function toVoiceError(e: unknown): VoiceError {
  if (e instanceof VoiceError) return e;
  if (e instanceof ElevenLabsError) {
    const s = e.statusCode ?? 502;
    if (s === 401) return new VoiceError("ElevenLabs rejected the API key.", 502);
    if (s === 402 || s === 429) return new VoiceError("ElevenLabs credits or rate limit are exhausted for this account. The text briefing is still available.", 429);
    if (s === 404 || s === 400 || s === 422) return new VoiceError("ElevenLabs rejected the request. Check that the configured voice ID (ELEVENLABS_VOICE_ID / ELEVENLABS_VOICE_ID_HINGLISH) is a voice available to this account.", 502);
    return new VoiceError(`ElevenLabs had an error (HTTP ${s}).`, 502);
  }
  return new VoiceError("Could not reach ElevenLabs. Try again shortly.", 502);
}
