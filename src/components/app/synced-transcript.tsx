"use client";

import { useCallback, useMemo, useState } from "react";
import { AudioPlayer } from "./audio-player";

type Alignment = { characters: string[]; starts: number[] };

/** Splits text into sentences with character offsets. */
export function sentenceSpans(text: string) {
  const spans: { start: number; end: number; text: string }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!".!?।".includes(text[i])) continue;
    const next = text[i + 1];
    // A boundary needs whitespace (or the end) after it; "1.2" and initials like "R. Kumar" are not boundaries.
    if (next !== undefined && !/\s/.test(next)) continue;
    if (text[i] === "." && /(?:^|\s)[A-Z]$/.test(text.slice(Math.max(0, i - 2), i))) continue;
    let end = i + 1;
    while (end < text.length && /\s/.test(text[end])) end++;
    if (text.slice(start, end).trim()) spans.push({ start, end, text: text.slice(start, end).trim() });
    start = end;
  }
  if (text.slice(start).trim()) spans.push({ start, end: text.length, text: text.slice(start).trim() });
  return spans;
}

/** Start time of character i, using ElevenLabs' per-character timings (falls back to proportional when lengths differ). */
function timeAt(i: number, text: string, al?: Alignment, duration?: number) {
  if (al && al.starts.length) {
    const idx = al.characters.length === text.length ? i : Math.round((i / Math.max(1, text.length)) * (al.starts.length - 1));
    return al.starts[Math.min(idx, al.starts.length - 1)] ?? 0;
  }
  return duration ? (i / text.length) * duration : 0;
}

/**
 * The briefing transcript follows the voice: the sentence being spoken is highlighted, and
 * clicking or pressing Enter on any sentence jumps the audio there.
 */
export function SyncedBriefing({ src, text, alignment }: { src: string; text: string; alignment?: Alignment }) {
  const spans = useMemo(() => sentenceSpans(text), [text]);
  const starts = useMemo(() => spans.map((s) => timeAt(s.start, text, alignment)), [spans, text, alignment]);
  const [now, setNow] = useState(-1);
  const [seek, setSeek] = useState<{ t: number; n: number }>();
  const onTime = useCallback((t: number) => setNow(t), []);
  let active = -1;
  if (now >= 0) for (let i = 0; i < starts.length; i++) if (starts[i] <= now + 0.05) active = i;

  return (
    <div className="space-y-5">
      <AudioPlayer src={src} label="case briefing" onTime={onTime} seekTo={seek} />
      <div className="max-w-prose font-serif text-[1.2rem] leading-[1.8]" aria-label="Transcript, follows the audio">
        {spans.map((s, i) => (
          <span
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setSeek({ t: starts[i], n: Date.now() })}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSeek({ t: starts[i], n: Date.now() }))}
            aria-current={i === active ? "true" : undefined}
            className={`cursor-pointer rounded-[2px] px-0.5 transition-colors duration-200 ${i === active ? "bg-[#f1dccf] text-ink" : active > i ? "text-ink-2" : "text-ink hover:bg-sunk"}`}
          >
            {s.text}{" "}
          </span>
        ))}
      </div>
      <p className="text-[0.75rem] text-ink-2">{alignment ? "Synced to the voice with ElevenLabs character timestamps. Tap any sentence to jump to it." : "Tap any sentence to jump to it."}</p>
    </div>
  );
}
