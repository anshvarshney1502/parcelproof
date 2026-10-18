"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");
const BARS = 48;
// Fixed decorative pattern; progress across it is the real playback position.
const HEIGHTS = Array.from({ length: BARS }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.37)));

/**
 * Real <audio> element with custom controls. The waveform bars are a fixed seeded pattern
 * (decorative); progress across them reflects the element's actual currentTime.
 */
export function AudioPlayer({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const on = (ev: string, fn: () => void) => { a.addEventListener(ev, fn); return () => a.removeEventListener(ev, fn); };
    const offs = [
      on("timeupdate", () => setTime(a.currentTime)),
      on("loadedmetadata", () => { setDuration(a.duration); setState("ready"); }),
      on("canplay", () => setState("ready")),
      on("play", () => setPlaying(true)),
      on("pause", () => setPlaying(false)),
      on("ended", () => setPlaying(false)),
      on("error", () => setState("error")),
    ];
    return () => offs.forEach((f) => f());
  }, [src]);

  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) void a.play().catch(() => setState("error")); else a.pause(); };
  const seek = (t: number) => { const a = audio.current; if (a && Number.isFinite(a.duration)) a.currentTime = Math.max(0, Math.min(a.duration, t)); };
  const pct = duration ? time / duration : 0;

  return (
    <div className="rounded-[var(--radius-obj)] border border-[#3a4039] bg-ink p-4 text-paper sm:p-5">
      <audio ref={audio} src={src} preload="metadata" />
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          disabled={state === "error"}
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-paper text-ink transition-transform hover:scale-[1.04] active:scale-95 disabled:opacity-40"
        >
          {state === "loading" && !playing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : playing ? <Pause className="size-5" aria-hidden /> : <Play className="ml-0.5 size-5" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || 0)}
            aria-valuenow={Math.round(time)}
            aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") seek(time + 5);
              else if (e.key === "ArrowLeft") seek(time - 5);
              else if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
              else return;
              e.preventDefault();
            }}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * duration); }}
            className="flex h-10 cursor-pointer items-center gap-[2px] rounded focus-visible:outline-paper"
          >
            {HEIGHTS.map((h, i) => (
              <span key={i} aria-hidden className="flex-1 rounded-full transition-colors duration-150" style={{ height: `${h * 100}%`, background: i / BARS < pct ? "#e3a58f" : "rgba(245,243,237,0.22)" }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-micro text-[#b8bcb3]">
            <span>{fmt(time)}</span>
            <span>{state === "error" ? "audio unavailable" : fmt(duration)}</span>
          </div>
        </div>
        <button onClick={() => { seek(0); void audio.current?.play(); }} disabled={state === "error"} aria-label="Replay from start" className="grid size-9 shrink-0 place-items-center rounded-full text-[#b8bcb3] hover:bg-white/10 hover:text-paper disabled:opacity-40">
          <RotateCcw className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
