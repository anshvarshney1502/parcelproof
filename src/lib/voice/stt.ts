import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config } from "../env";
import { toVoiceError } from "./tts";

export type Word = { text: string; start?: number; end?: number; type: string; speakerId?: string };
export type Transcript = { text: string; languageCode?: string; durationSec?: number; speakers: number };

export interface Transcriber {
  transcribe(bytes: Uint8Array, filename: string, mime: string, opts?: { diarize?: boolean }): Promise<Transcript>;
}

const mmss = (s = 0) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Turns Scribe's word list into a readable, quotable transcript: one line per speaker turn,
 * prefixed with the time it starts, e.g. "[00:12] Speaker 2: The box was empty."
 */
export function formatTranscript(words: Word[]): { text: string; speakers: number } {
  const ids = new Map<string, number>();
  const lines: string[] = [];
  let cur: { speaker?: string; start?: number; text: string } | null = null;
  const flush = () => {
    if (!cur || !cur.text.trim()) return;
    const label = cur.speaker !== undefined ? `Speaker ${ids.get(cur.speaker)}: ` : "";
    lines.push(`[${mmss(cur.start)}] ${label}${cur.text.replace(/\s+/g, " ").trim()}`);
  };
  for (const w of words) {
    if (w.type === "audio_event") continue;
    if (w.speakerId !== undefined && !ids.has(w.speakerId)) ids.set(w.speakerId, ids.size + 1);
    if (!cur || (w.type === "word" && w.speakerId !== cur.speaker)) {
      flush();
      cur = { speaker: w.speakerId, start: w.start, text: "" };
    }
    cur.text += w.text;
  }
  flush();
  return { text: lines.join("\n"), speakers: ids.size };
}

/** ElevenLabs Scribe speech-to-text. Hindi, English and mixed speech are detected automatically. */
export function scribeClient(): Transcriber {
  const client = new ElevenLabsClient({ apiKey: config.elevenlabsKey(), timeoutInSeconds: 180, maxRetries: 0 });
  return {
    async transcribe(bytes, filename, mime, opts = {}) {
      try {
        const res = (await client.speechToText.convert({
          modelId: "scribe_v2",
          file: { data: Buffer.from(bytes), filename, contentType: mime },
          diarize: opts.diarize ?? true,
          tagAudioEvents: false,
          timestampsGranularity: "word",
        })) as unknown as { text?: string; words?: Word[]; languageCode?: string };
        const words = res.words ?? [];
        const formatted = words.length ? formatTranscript(words) : { text: res.text ?? "", speakers: 0 };
        return {
          text: opts.diarize === false ? (res.text ?? "").trim() : formatted.text,
          languageCode: res.languageCode,
          durationSec: words.reduce((m, w) => Math.max(m, w.end ?? 0), 0) || undefined,
          speakers: formatted.speakers,
        };
      } catch (e) {
        throw toVoiceError(e);
      }
    },
  };
}
