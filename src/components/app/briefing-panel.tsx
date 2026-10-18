"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Volume2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { AudioPlayer } from "./audio-player";

type Briefing = { id: string; status: string; language: string; characters: number; createdAt: string | Date };

export function BriefingPanel({
  caseId, language, text, characters, pending, reviewed, cached, lastError, voiceConfigured, usage, stale,
}: {
  caseId: string; language: "en" | "hinglish"; text: string; characters: number; pending: number; reviewed: number;
  cached: Briefing | null; lastError?: string; voiceConfigured: boolean; usage: { used: number; limit: number }; stale: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const blocked = pending > 0 ? `Review all findings first — ${pending} still pending.` : reviewed === 0 ? "Confirm or correct at least one finding first." : undefined;
  const quotaLeft = usage.limit - usage.used;

  const generate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ reused: boolean }>(`/api/cases/${caseId}/briefing`, { method: "POST", json: { language } });
      toast("ok", res.reused ? "Matching audio already existed — reused it" : "Briefing audio generated");
      setConfirm(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setConfirm(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <div role="radiogroup" aria-label="Briefing language" className="inline-flex rounded-[var(--radius-mark)] border border-rule-strong bg-raised p-0.5">
          {(["en", "hinglish"] as const).map((l) => (
            <button key={l} role="radio" aria-checked={language === l} onClick={() => router.replace(`?language=${l}`, { scroll: false })} className={`h-9 rounded-[3px] px-4 text-sm transition-colors ${language === l ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"}`}>
              {l === "en" ? "English" : "Hinglish"}
            </button>
          ))}
        </div>

        {stale && <Alert tone="warn" title="Based on an out-of-date analysis">The evidence changed. Re-analyse and review before generating audio.</Alert>}

        {cached ? (
          <AudioPlayer src={`/api/briefings/${cached.id}/audio`} label="case briefing" />
        ) : (
          <div className="flex flex-col gap-4 rounded-[var(--radius-obj)] border border-rule bg-raised p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-serif text-xl"><Headphones className="size-5 text-rust-ink" aria-hidden />Listen to my case</p>
              <p className="mt-1 text-sm text-ink-2">{blocked ?? (voiceConfigured ? "Audio is generated once from the transcript below and saved for replay." : "Voice is not configured on this server. The written briefing is below.")}</p>
            </div>
            <Button variant="accent" disabled={Boolean(blocked) || !voiceConfigured || quotaLeft <= 0} onClick={() => setConfirm(true)} icon={<Volume2 className="size-4" aria-hidden />}>Generate audio</Button>
          </div>
        )}
        {(error || lastError) && <Alert tone="error" title="Audio was not generated" action={!blocked && voiceConfigured ? <Button size="sm" onClick={() => setConfirm(true)}>Retry</Button> : undefined}>{error ?? lastError}</Alert>}

        <section aria-labelledby="tr-h">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2 id="tr-h" className="label">Transcript</h2>
            <span className="font-mono text-micro text-ink-2">{characters} characters · ~{Math.max(10, Math.round(text.split(/\s+/).length / 2.5))} s</span>
          </div>
          <div className="mt-4 max-w-prose font-serif text-[1.15rem] leading-[1.75] text-ink">
            {text.split(/(?<=[.?!])\s+(?=[A-Z])/).reduce<string[][]>((acc, s, i) => { if (i % 3 === 0) acc.push([]); acc[acc.length - 1].push(s); return acc; }, []).map((p, i) => <p key={i} className="mb-4">{p.join(" ")}</p>)}
          </div>
          <p className="text-[0.8125rem] text-ink-2">Written from findings you confirmed or corrected. Dismissed and unreviewed findings are left out.</p>
        </section>
      </div>

      <aside className="space-y-4 text-sm text-ink-2 lg:border-l lg:border-rule lg:pl-6">
        <div>
          <p className="label">Voice usage today</p>
          <p className="mt-1 font-serif text-2xl tabular-nums text-ink">{usage.used}<span className="text-ink-2">/{usage.limit}</span></p>
        </div>
        <p>Identical transcripts, voice and settings reuse saved audio and don’t count again.</p>
        <p>Generating sends the transcript text — not your files — to ElevenLabs.</p>
      </aside>

      <Dialog
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="Generate the audio briefing?"
        footer={<><Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>Cancel</Button><Button size="sm" variant="primary" loading={busy} onClick={generate}>Generate</Button></>}
      >
        <ul className="list-disc space-y-1 pl-5">
          <li>The {characters}-character transcript is sent to ElevenLabs.</li>
          <li>Uses 1 of your {quotaLeft} remaining voice generations today, and the equivalent characters from the ElevenLabs account credits.</li>
          <li>Audio is saved privately with this case for replay.</li>
        </ul>
      </Dialog>
    </div>
  );
}
