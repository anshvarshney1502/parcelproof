"use client";

import { useState } from "react";
import { RecordButton } from "./recorder";

/** Speak instead of typing. The recording is transcribed by ElevenLabs Scribe and appended to the field. */
export function DictateButton({ onText }: { onText: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RecordButton
        compact
        label="Dictate"
        maxSeconds={120}
        busy={busy}
        onDone={async (file) => {
          setBusy(true);
          setError(undefined);
          try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/transcribe", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? `Transcription failed (${res.status}).`);
            onText(data.text);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <span className="text-[0.75rem] text-ink-2">{error ? <span className="text-err">{error}</span> : "Hindi, English or Hinglish · up to 2 min"}</span>
    </div>
  );
}
