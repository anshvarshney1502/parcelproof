import { handle, json, sameOrigin, HttpError } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { limits, ConfigError } from "@/lib/env";
import { detectFile, FileRejected } from "@/lib/files/validate";
import { scribeClient } from "@/lib/voice/stt";
import { readFormLimited } from "@/lib/stream";
import { VoiceError } from "@/lib/voice/tts";
import { consume, refund } from "@/lib/repo/usage";

export const maxDuration = 120;
const MAX_BYTES = 5 * 1024 * 1024;

/** Dictation: transcribes a short recording with ElevenLabs Scribe and returns the text. Nothing is stored. */
export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const form = await readFormLimited(req, MAX_BYTES + 64 * 1024, "Recordings for dictation must be under 5 MB.");
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "No recording was attached.", "invalid");
    if (file.size > MAX_BYTES) throw new HttpError(413, "Recordings for dictation must be under 5 MB.", "too_large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let mime: string;
    try {
      const d = detectFile(bytes, file.name);
      if (d.kind !== "audio") throw new FileRejected("Expected an audio recording.");
      mime = d.mime;
    } catch (e) {
      if (e instanceof FileRejected) throw new HttpError(415, e.message, "unsupported");
      throw e;
    }
    const transcriber = scribeClient();
    await consume(userId, "stt", limits.sttDailyLimit);
    try {
      const t = await transcriber.transcribe(bytes, file.name, mime, { diarize: false });
      if (!t.text) throw new HttpError(422, "No speech was recognised. Try again a little closer to the microphone.", "empty");
      return json({ text: t.text, languageCode: t.languageCode });
    } catch (e) {
      if (e instanceof VoiceError || e instanceof ConfigError) {
        await refund(userId, "stt");
        throw new HttpError(e instanceof VoiceError ? e.status : 503, e.message, "voice_failed");
      }
      throw e;
    }
  });
}
