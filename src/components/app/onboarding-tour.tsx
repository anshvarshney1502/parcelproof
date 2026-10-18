"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import DURATIONS from "./tour-durations.json";
import { X, Pause, Play, ChevronLeft, ChevronRight, Mic, Sparkles, CheckCheck, Headphones, FileDown, FolderPlus, ShieldCheck, Quote } from "lucide-react";
import { Mark } from "@/components/brand";

/**
 * First-run walkthrough, played like a short video. Every scene uses one clearly labelled
 * example case; nothing here is saved to the account.
 */

const EXAMPLE = {
  title: "Empty box — Bluetooth speaker",
  order: "MEESHO-48213",
  voice: [
    { t: "00:00", who: "Customer", text: "Hello ji, maine order receive kiya…" },
    { t: "00:04", who: "Customer", text: "lekin box khola toh andar kuch nahi tha, bilkul khaali." },
    { t: "00:09", who: "Customer", text: "Mujhe full refund chahiye." },
  ],
};

type Scene = { id: string; kicker: string; title: string; body: string; seconds: number; visual: (p: { reduce: boolean }) => ReactNode };

const ease = [0.22, 1, 0.36, 1] as const;
const fade = (delay = 0, y = 10) => ({ initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease } });

function Window({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="w-full overflow-hidden rounded-[8px] border border-rule-strong bg-paper shadow-[0_30px_80px_-40px_rgba(36,41,35,0.55)]">
      <div className="flex items-center gap-1.5 border-b border-rule bg-raised px-3 py-2">
        <span className="size-2 rounded-full bg-[#e3c0b2]" /><span className="size-2 rounded-full bg-[#e6d1a6]" /><span className="size-2 rounded-full bg-[#c4d6c1]" />
        <span className="ml-2 truncate font-mono text-[0.625rem] text-ink-2">{label}</span>
        <span className="ml-auto rounded-[2px] border border-rule px-1 font-mono text-[0.5625rem] uppercase tracking-wider text-ink-2">Example</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

const Badge = ({ tone, children }: { tone: "ok" | "rust" | "warn" | "info"; children: ReactNode }) => {
  const c = { ok: "text-ok bg-ok-bg border-[#c4d6c1]", rust: "text-rust-ink bg-[#f6e4dc] border-[#e3c0b2]", warn: "text-warn bg-warn-bg border-[#e6d1a6]", info: "text-archive-ink bg-info-bg border-[#c5d2dc]" }[tone];
  return <span className={`inline-flex rounded-[2px] border px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.06em] ${c}`}>{children}</span>;
};

const SCENES: Scene[] = [
  {
    id: "welcome",
    kicker: "Welcome to ParcelProof",
    title: "Win back the disputes you should never have lost.",
    body: "A customer says the box was empty. You have days to respond, and the proof is scattered across screenshots, PDFs and voice notes. ParcelProof turns it into one clear, sourced case — in about five minutes.",
    seconds: 7,
    visual: () => (
      <div className="relative grid place-items-center py-6">
        <motion.div {...fade(0.1, 0)} className="relative grid size-40 place-items-center rounded-full border border-rule bg-raised sm:size-48">
          <Mark className="size-16 text-ink sm:size-20" />
        </motion.div>
        {["Invoice.pdf", "Tracking.png", "Voice note", "Chat.txt"].map((f, i) => {
          const pos = [[-150, -60], [150, -70], [-140, 70], [150, 60]][i];
          return (
            <motion.div key={f} initial={{ opacity: 0, x: pos[0] * 1.4, y: pos[1] * 1.4 }} animate={{ opacity: 1, x: pos[0], y: pos[1] }} transition={{ delay: 0.4 + i * 0.15, duration: 0.8, ease }} className="absolute rounded-[4px] border border-rule-strong bg-paper px-2.5 py-1.5 font-mono text-[0.625rem] text-ink shadow-sm">
              {f}
            </motion.div>
          );
        })}
      </div>
    ),
  },
  {
    id: "case",
    kicker: "Step 1 · Open a case",
    title: "Describe the dispute — type it or just say it.",
    body: "Add the order reference, the deadline and what happened. Tap Dictate and speak in Hindi, English or Hinglish; ElevenLabs Scribe writes it down. Only the title and dispute type are required.",
    seconds: 8,
    visual: ({ reduce }) => (
      <Window label="New case">
        <div className="space-y-3 text-[0.8125rem]">
          <div><p className="text-ink-2">Case title</p><motion.p {...fade(0.2)} className="mt-1 rounded-[2px] border border-rule-strong bg-raised px-2 py-1.5 text-ink">{EXAMPLE.title}</motion.p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-ink-2">Order</p><motion.p {...fade(0.4)} className="mt-1 rounded-[2px] border border-rule-strong bg-raised px-2 py-1.5 font-mono text-ink">{EXAMPLE.order}</motion.p></div>
            <div><p className="text-ink-2">Deadline</p><motion.p {...fade(0.55)} className="mt-1 rounded-[2px] border border-rust-ink/40 bg-raised px-2 py-1.5 text-rust-ink">21 Oct</motion.p></div>
          </div>
          <div>
            <p className="text-ink-2">What happened</p>
            <div className="mt-1 min-h-14 rounded-[2px] border border-rule-strong bg-raised px-2 py-1.5 text-ink">
              <Typewriter text="Maine speaker khud pack kiya tha, branded tape ke saath. Customer keh raha hai box khaali tha." delay={1.6} reduce={reduce} />
            </div>
            <motion.span {...fade(0.8)} className="mt-2 inline-flex items-center gap-2 rounded-[2px] bg-rust-ink px-2.5 py-1.5 text-[0.75rem] text-white">
              <Mic className="size-3.5" /> Recording… <Bars live={!reduce} />
            </motion.span>
          </div>
        </div>
      </Window>
    ),
  },
  {
    id: "voice",
    kicker: "Step 2 · Add evidence",
    title: "Drop in the customer’s WhatsApp voice note.",
    body: "Upload PDFs, screenshots, CSVs — and audio. ElevenLabs Scribe transcribes voice notes with speakers and timestamps, so what the customer said becomes evidence you can quote. Every file gets a permanent id like S1.",
    seconds: 9,
    visual: () => (
      <Window label="Evidence · S1 customer-voice-note.opus">
        <div className="flex items-center gap-3 rounded-[4px] bg-ink px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-paper text-ink"><Play className="ml-0.5 size-3.5" /></span>
          <Bars live count={30} light />
          <span className="font-mono text-[0.625rem] text-[#b8bcb3]">0:12</span>
        </div>
        <motion.p {...fade(0.6)} className="mt-3 flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-wider text-ok"><span className="size-1.5 rounded-full bg-ok" />Transcribed by ElevenLabs Scribe · hin · 1 speaker</motion.p>
        <div className="mt-2 space-y-1.5 font-mono text-[0.75rem] leading-relaxed">
          {EXAMPLE.voice.map((l, i) => (
            <motion.p key={l.t} {...fade(1 + i * 0.7)} className="text-ink">
              <span className="text-archive-ink">[{l.t}]</span> {l.who}: <span className={i === 1 ? "bg-[#f1dccf]" : ""}>{l.text}</span>
            </motion.p>
          ))}
        </div>
      </Window>
    ),
  },
  {
    id: "analyse",
    kicker: "Step 3 · Analyse",
    title: "Open-weight Gemma reads everything. Code checks every quote.",
    body: "A Mastra workflow runs Gemma over your evidence in seven steps. Every finding must quote your files word for word, and ParcelProof checks that the words really exist. Anything that can’t be proven is marked unverified — never presented as fact.",
    seconds: 10,
    visual: () => (
      <Window label="Review · analysis v1">
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <ol className="space-y-1.5 font-mono text-[0.625rem] text-ink-2">
            {["Verify case", "Load evidence", "Label sources", "Gemma: events", "Check quotes", "Gemma: compare", "Verify & save"].map((s, i) => (
              <motion.li key={s} {...fade(0.2 + i * 0.25, 0)} className="flex items-center gap-1.5">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.35 + i * 0.25 }} className="grid size-3.5 place-items-center rounded-full bg-ok text-[0.5rem] text-white">✓</motion.span>{s}
              </motion.li>
            ))}
          </ol>
          <div className="space-y-2.5">
            {[
              { b: <Badge tone="ok">Supported</Badge>, t: "Courier recorded delivery, signed by R. Kumar.", q: "S2 · “Delivered - signed by R. Kumar”" },
              { b: <Badge tone="rust">Conflicting</Badge>, t: "Customer says the box was empty; pickup weight was 1.2 kg.", q: "S1 · S2" },
              { b: <Badge tone="info">Missing</Badge>, t: "No packing photo before dispatch.", q: "add one to strengthen the case" },
            ].map((f, i) => (
              <motion.div key={i} {...fade(2.2 + i * 0.6)} className="border-l-2 border-rule-strong pl-2.5">
                {f.b}
                <p className="mt-1 font-serif text-[0.9375rem] leading-snug text-ink">{f.t}</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-[0.625rem] text-archive-ink"><Quote className="size-2.5" />{f.q}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Window>
    ),
  },
  {
    id: "review",
    kicker: "Step 4 · You decide",
    title: "Confirm, correct or dismiss. You stay in control.",
    body: "Nothing goes into your report until you approve it. Confirm all cleanly supported findings in one click, rewrite anything in your own words, and dismiss what doesn’t belong. ParcelProof never decides who is lying.",
    seconds: 8,
    visual: () => (
      <Window label="Review · 3 of 6 reviewed">
        <motion.div {...fade(0.2)} className="flex items-center gap-2">
          <motion.span animate={{ scale: [1, 0.96, 1] }} transition={{ delay: 1.2, duration: 0.35 }} className="inline-flex items-center gap-1.5 rounded-[2px] border border-ink bg-ink px-2.5 py-1.5 text-[0.75rem] text-paper"><CheckCheck className="size-3.5" />Confirm 3 supported</motion.span>
        </motion.div>
        <div className="mt-3 space-y-2">
          {["Delivered, signed by R. Kumar", "Pickup weight 1.2 kg", "Customer asked for a full refund"].map((t, i) => (
            <motion.div key={t} {...fade(0.4 + i * 0.2)} className="flex items-center justify-between gap-3 rounded-[4px] border border-rule bg-raised px-3 py-2 text-[0.8125rem]">
              <span className="text-ink">{t}</span>
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6 + i * 0.15 }} className="rounded-[2px] border border-[#cfd2c2] px-1.5 font-mono text-[0.5625rem] uppercase text-moss-ink">Confirmed</motion.span>
            </motion.div>
          ))}
          <motion.div {...fade(2.4)} className="rounded-[4px] border border-dashed border-archive px-3 py-2 text-[0.8125rem]">
            <span className="font-mono text-[0.5625rem] uppercase text-archive-ink">Corrected by you</span>
            <p className="mt-0.5 font-serif text-ink">The customer says the box was empty; no photos have been shared yet.</p>
          </motion.div>
        </div>
      </Window>
    ),
  },
  {
    id: "listen",
    kicker: "Step 5 · Listen to my case",
    title: "Hear where you stand — in English or Hinglish.",
    body: "Gemma writes a 45-second briefing from only what you confirmed, and is rejected if it invents a number. ElevenLabs reads it aloud in a calm voice. The transcript lights up as it speaks — tap any line to jump there.",
    seconds: 11,
    visual: ({ reduce }) => <ListenScene reduce={reduce} />,
  },
  {
    id: "report",
    kicker: "Step 6 · Export",
    title: "Send a report the marketplace can actually check.",
    body: "One click builds a PDF from your reviewed case: timeline, findings with exact quotations and source ids, your corrections, missing evidence, a draft reply you can edit, and a source index — Hindi included.",
    seconds: 8,
    visual: () => (
      <div className="relative mx-auto h-64 w-52 sm:h-72 sm:w-60">
        {[2, 1, 0].map((i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 30, rotate: 0 }} animate={{ opacity: 1, y: i * -6, rotate: (i - 1) * 3 }} transition={{ delay: 0.2 + (2 - i) * 0.2, duration: 0.6, ease }} className="absolute inset-0 rounded-[4px] border border-rule-strong bg-[#fffefb] p-4 shadow-[0_20px_40px_-24px_rgba(36,41,35,0.5)]">
            {i === 0 && (
              <div className="space-y-2">
                <p className="font-mono text-[0.5rem] uppercase tracking-wider text-ink-2">ParcelProof · evidence report</p>
                <p className="font-serif text-[0.95rem] leading-tight text-ink">{EXAMPLE.title}</p>
                <p className="text-[0.5625rem] text-rust-ink">AI-assisted · seller-reviewed</p>
                {[85, 70, 92, 60, 78, 50, 88].map((w, k) => <motion.div key={k} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ delay: 1 + k * 0.12 }} className={`h-1 rounded-full ${k === 2 ? "bg-archive" : "bg-rule-strong"}`} />)}
                <p className="pt-1 font-mono text-[0.5rem] text-archive-ink">S1 · S2 · S3</p>
              </div>
            )}
          </motion.div>
        ))}
        <motion.span {...fade(1.8)} className="absolute -bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-[2px] bg-ink px-3 py-1.5 text-[0.75rem] text-paper"><FileDown className="size-3.5" />Download PDF</motion.span>
      </div>
    ),
  },
  {
    id: "trust",
    kicker: "Built to be trusted",
    title: "Your evidence, your decision.",
    body: "Files are private to your account. Evidence text goes to Gemma only when you choose Analyse; only the briefing script goes to ElevenLabs. Nothing is invented: if something can’t be proven, ParcelProof says so.",
    seconds: 7,
    visual: () => (
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { I: ShieldCheck, t: "Every quote verified", d: "Word-for-word against your files" },
          { I: Sparkles, t: "Open-weight Gemma", d: "Orchestrated with Mastra" },
          { I: Headphones, t: "Voice by ElevenLabs", d: "Scribe in, natural speech out" },
        ].map(({ I, t, d }, i) => (
          <motion.div key={t} {...fade(0.2 + i * 0.25)} className="rounded-[6px] border border-rule bg-raised p-4">
            <I className="size-5 text-rust-ink" />
            <p className="mt-3 font-serif text-lg leading-tight text-ink">{t}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-2">{d}</p>
          </motion.div>
        ))}
      </div>
    ),
  },
];

function Typewriter({ text, delay, reduce }: { text: string; delay: number; reduce: boolean }) {
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { timer = setInterval(() => { i += 2; setN(Math.min(i, text.length)); if (i >= text.length) clearInterval(timer); }, 35); }, delay * 1000);
    return () => { clearTimeout(t); if (timer) clearInterval(timer); };
  }, [text, delay, reduce]);
  return <>{text.slice(0, n)}<span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-ink" /></>;
}

function Bars({ live, count = 12, light }: { live?: boolean; count?: number; light?: boolean }) {
  return (
    <span className="flex h-4 flex-1 items-center gap-[2px]" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <motion.span key={i} className={`w-[2px] flex-1 rounded-full ${light ? "bg-[#e3a58f]" : "bg-white/80"}`} animate={live ? { height: ["30%", `${40 + ((i * 37) % 60)}%`, "30%"] } : { height: "50%" }} transition={{ duration: 0.9, repeat: Infinity, delay: (i % 7) * 0.08 }} style={{ height: "40%" }} />
      ))}
    </span>
  );
}

function ListenScene({ reduce }: { reduce: boolean }) {
  const lines = [
    "Yeh dispute missing contents ke baare mein hai.",
    "Records dikhate hain ki parcel deliver hua aur R. Kumar ne sign kiya.",
    "Customer kehta hai box khaali tha — yeh abhi verify nahi hua hai.",
    "Packing photo missing hai. Reply se pehle customer se unboxing photos maangiye.",
  ];
  const [active, setActive] = useState(reduce ? lines.length - 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setActive((a) => Math.min(a + 1, lines.length - 1)), 2400);
    return () => clearInterval(t);
  }, [reduce, lines.length]);
  return (
    <Window label="Briefing · Hinglish · 0:46">
      <div className="flex items-center gap-3 rounded-[4px] bg-ink px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-paper text-ink"><Pause className="size-3.5" /></span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/20">
          <motion.div className="absolute inset-y-0 left-0 bg-[#e3a58f]" initial={{ width: "0%" }} animate={{ width: reduce ? "100%" : "100%" }} transition={{ duration: reduce ? 0 : 10, ease: "linear" }} />
        </div>
        <span className="font-mono text-[0.625rem] text-[#b8bcb3]">0:46</span>
      </div>
      <div className="mt-3 space-y-1 font-serif text-[0.95rem] leading-relaxed">
        {lines.map((l, i) => (
          <p key={i} className={`rounded-[2px] px-1 transition-colors duration-300 ${i === active ? "bg-[#f1dccf] text-ink" : i < active ? "text-ink-2" : "text-ink"}`}>{l}</p>
        ))}
      </div>
      <p className="mt-2 font-mono text-[0.5625rem] uppercase tracking-wider text-ink-2">Synced with ElevenLabs character timestamps</p>
    </Window>
  );
}

export function OnboardingTour({ open, onClose }: { open: boolean; onClose: (completed: boolean) => void }) {
  const reduce = Boolean(useReducedMotion());
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const scene = SCENES[i];
  const last = i === SCENES.length - 1;
  // Narration (pre-generated with ElevenLabs) is opt-in: browsers block autoplay with sound.
  // On by default. If the browser blocks autoplay with sound, it starts on the first tap or key press.
  const [sound, setSound] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const voice = useRef<HTMLAudioElement>(null);
  const narration = (DURATIONS as Record<string, number>)[scene.id];
  const duration = sound && narration ? narration + 0.8 : scene.seconds;

  const go = useCallback((n: number) => { setI(Math.max(0, Math.min(SCENES.length - 1, n))); setElapsed(0); elapsedRef.current = 0; }, []);

  useEffect(() => {
    if (!open) return;
    root.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto-advance like a video; the final scene waits for the viewer.
  const elapsedRef = useRef(0);
  useEffect(() => {
    if (!open || paused || last) return;
    const tick = setInterval(() => setElapsed((e) => (elapsedRef.current = e + 100)), 100);
    const next = setTimeout(() => go(i + 1), Math.max(0, duration * 1000 - elapsedRef.current));
    return () => { clearInterval(tick); clearTimeout(next); };
  }, [open, paused, last, i, duration, go]);

  useEffect(() => {
    const a = voice.current;
    if (!a) return;
    if (open && sound && !paused) void a.play().then(() => setBlocked(false), () => setBlocked(true));
    else a.pause();
  }, [open, sound, paused, i]);

  useEffect(() => {
    if (!open || !blocked || !sound) return;
    const unlock = () => {
      const a = voice.current;
      if (a) { a.currentTime = Math.min(elapsedRef.current / 1000, a.duration || 0); void a.play().then(() => setBlocked(false), () => {}); }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [open, blocked, sound]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose(false);
    else if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={root}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="ParcelProof walkthrough"
          onKeyDown={onKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className="fixed inset-0 z-[60] flex flex-col bg-paper outline-none"
        >
          <div aria-hidden className="grain pointer-events-none absolute inset-0" />
          <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(185,86,60,0.10),transparent_65%)]" />

          {/* Story-style progress */}
          <div className="relative flex gap-1.5 px-4 pt-4 sm:px-8 sm:pt-6" aria-hidden>
            {SCENES.map((s, k) => (
              <button key={s.id} tabIndex={-1} onClick={() => go(k)} className="h-1 flex-1 overflow-hidden rounded-full bg-rule">
                <span className="block h-full bg-ink transition-[width] duration-100 ease-linear" style={{ width: k < i ? "100%" : k > i ? "0%" : last ? "100%" : `${Math.min(100, (elapsed / (duration * 1000)) * 100)}%` }} />
              </button>
            ))}
          </div>

          <header className="relative flex items-center justify-between px-4 pt-4 sm:px-8">
            <span className="flex items-center gap-2 font-serif text-lg"><Mark className="size-5" /><span className="hidden sm:inline">Parcel<span className="italic text-rust-ink">Proof</span></span></span>
            <div className="flex items-center gap-1">
              <audio ref={voice} key={scene.id} src={`/tour/${scene.id}.mp3`} preload="auto" />
              <button
                onClick={(e) => { e.stopPropagation(); if (blocked) { setBlocked(false); setSound(true); } else setSound((s) => !s); setPaused(false); if (voice.current) voice.current.currentTime = Math.min(elapsed / 1000, voice.current.duration || 0); }}
                aria-pressed={sound}
                className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${sound && !blocked ? "text-ink-2 hover:bg-sunk hover:text-ink" : "bg-rust-ink text-white shadow-sm hover:bg-[#87392a]"}`}
              >
                {sound && !blocked ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
                <span className={sound && !blocked ? "sr-only" : ""}>
                  {sound && !blocked ? "Mute narration" : blocked ? <><span className="sm:hidden">Tap for sound</span><span className="hidden sm:inline">Tap anywhere to hear narration</span></> : <><span className="sm:hidden">Narration</span><span className="hidden sm:inline">Turn on narration</span></>}
                </span>
              </button>
              {!last && (
                <button onClick={() => setPaused((p) => !p)} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-sunk hover:text-ink" aria-label={paused ? "Play walkthrough" : "Pause walkthrough"}>
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </button>
              )}
              <button onClick={() => onClose(false)} className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-rule-strong bg-raised/80 px-4 text-sm text-ink backdrop-blur hover:border-ink-2">
                Skip<span className="hidden sm:inline"> tour</span> <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </header>

          <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 overflow-y-auto px-5 py-6 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            <AnimatePresence mode="wait">
              <motion.div key={scene.id + "-text"} initial={{ opacity: 0, y: reduce ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -10, transition: { duration: 0.2 } }} transition={{ duration: 0.55, ease }} aria-live="polite">
                <p className="font-mono text-micro uppercase tracking-[0.12em] text-rust-ink">{scene.kicker}</p>
                <h2 className="mt-3 font-serif text-[2rem] leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl">{scene.title}</h2>
                <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-ink-2">{scene.body}</p>
                {last && (
                  <div className="mt-8 flex flex-wrap gap-3">
                    <button onClick={() => onClose(true)} className="inline-flex h-12 items-center gap-2 rounded-[2px] bg-ink px-5 text-paper shadow-[0_1px_0_rgba(0,0,0,0.25)] hover:bg-[#363c35]">
                      <FolderPlus className="size-4" aria-hidden /> Open my first case
                    </button>
                    <button onClick={() => go(0)} className="h-12 rounded-[2px] px-4 text-ink-2 hover:text-ink">Watch again</button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.div key={scene.id + "-visual"} initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.6, ease }} className="min-w-0" aria-hidden>
                {scene.visual({ reduce })}
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="relative flex items-center justify-between gap-3 border-t border-rule px-4 py-3 sm:px-8">
            <button onClick={() => go(i - 1)} disabled={i === 0} className="inline-flex h-10 items-center gap-1 rounded-[2px] px-3 text-sm text-ink-2 hover:text-ink disabled:opacity-30">
              <ChevronLeft className="size-4" aria-hidden /> Back
            </button>
            <span className="font-mono text-micro text-ink-2">{i + 1} / {SCENES.length}<span className="hidden sm:inline"> · ← → to navigate · space to pause · esc to skip</span></span>
            {last ? (
              <button onClick={() => onClose(true)} className="inline-flex h-10 items-center gap-1 rounded-[2px] bg-ink px-4 text-sm text-paper">Start <ChevronRight className="size-4" aria-hidden /></button>
            ) : (
              <button onClick={() => go(i + 1)} className="inline-flex h-10 items-center gap-1 rounded-[2px] border border-rule-strong bg-raised px-4 text-sm text-ink hover:border-ink-2">
                Next <ChevronRight className="size-4" aria-hidden />
              </button>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
