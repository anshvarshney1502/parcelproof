"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const extFor = (mime: string) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm");

/**
 * Microphone recorder built on MediaRecorder. Shows a live level meter so the seller can see it is
 * actually hearing them; returns a File when stopped. Nothing leaves the browser until the caller uploads it.
 */
export function useRecorder(maxSeconds: number, onDone: (file: File) => void) {
  const [state, setState] = useState<"idle" | "recording" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string>();
  const rec = useRef<MediaRecorder | null>(null);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  const start = async () => {
    setError(undefined);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState("error");
      setError("Microphone access was blocked. Allow it in the browser's site settings and try again.");
      return;
    }
    const mime = PREFERRED.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(peak / 128);
      raf = requestAnimationFrame(tick);
    };
    tick();
    const t0 = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSeconds(s);
      if (s >= maxSeconds && r.state === "recording") r.stop();
    }, 250);

    cleanup.current = () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
    };
    r.onstop = () => {
      cleanup.current();
      setState("idle");
      setLevel(0);
      const type = r.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size > 0) onDone(new File([blob], `voice-note-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extFor(type)}`, { type }));
    };
    rec.current = r;
    r.start(250);
    setSeconds(0);
    setState("recording");
  };

  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  return { state, seconds, level, error, start, stop };
}

export function RecordButton({ label, maxSeconds, onDone, busy, disabled, compact }: { label: string; maxSeconds: number; onDone: (f: File) => void; busy?: boolean; disabled?: boolean; compact?: boolean }) {
  const r = useRecorder(maxSeconds, onDone);
  const recording = r.state === "recording";
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={recording ? r.stop : r.start}
        disabled={disabled || busy}
        aria-pressed={recording}
        className={`relative inline-flex items-center gap-2 overflow-hidden rounded-[var(--radius-mark)] border transition-colors disabled:opacity-50 ${compact ? "h-9 px-3 text-[0.8125rem]" : "h-10 px-3.5 text-sm"} ${recording ? "border-rust-ink bg-rust-ink text-white" : "border-rule-strong bg-paper text-ink hover:border-ink-2"}`}
      >
        {recording && <span aria-hidden className="absolute inset-y-0 left-0 bg-white/15 transition-[width] duration-75" style={{ width: `${Math.min(100, r.level * 180)}%` }} />}
        <span className="relative flex items-center gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : recording ? <Square className="size-3.5 fill-current" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          {busy ? "Transcribing…" : recording ? `Stop · ${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, "0")}` : label}
        </span>
      </button>
      {r.error && <p role="alert" className="text-[0.8125rem] text-err">{r.error}</p>}
    </div>
  );
}
