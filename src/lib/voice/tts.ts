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
  synthesize(text: string, style: "calm" | "balanced"): Promise<Uint8Array>;
}

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
        const stream = await client.textToSpeech.convert(voiceId, {
          text,
          modelId,
          outputFormat: "mp3_44100_128",
          voiceSettings: VOICE_SETTINGS[style],
        });
        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const audio = Buffer.concat(chunks);
        if (!audio.byteLength) throw new VoiceError("ElevenLabs returned no audio.", 502);
        return audio;
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
