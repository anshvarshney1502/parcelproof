"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Volume2, Sparkles, PenLine, RotateCcw } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Tag } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { SyncedBriefing } from "./synced-transcript";

type Briefing = { id: string; status: string; language: string; characters: number; createdAt: string | Date; alignment?: { characters: string[]; starts: number[] } };
type Origin = "template" | "gemma" | "seller";

const ORIGIN: Record<Origin, { label: string; tone: "plain" | "archive" | "moss" }> = {
  template: { label: "Plain template", tone: "plain" },
  gemma: { label: "Written by Gemma · checked", tone: "archive" },
  seller: { label: "Edited by you", tone: "moss" },
};

export function BriefingPanel({
  caseId, language, text, scriptOrigin, scriptStale, characters, pending, reviewed, cached, lastError, voiceConfigured, gemmaConfigured, usage, stale,
}: {
  caseId: string; language: "en" | "hinglish"; text: string; scriptOrigin: Origin; scriptStale: boolean; characters: number; pending: number; reviewed: number;
  cached: Briefing | null; lastError?: string; voiceConfigured: boolean; gemmaConfigured: boolean; usage: { used: number; limit: number }; stale: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const blocked = pending > 0 ? `Review all findings first — ${pending} still pending.` : reviewed === 0 ? "Confirm or correct at least one finding first." : undefined;
  const quotaLeft = usage.limit - usage.used;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setError(undefined);
    try {
      await fn();
      toast("ok", ok);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const generate = () =>
    run("audio", async () => {
      const res = await api<{ reused: boolean }>(`/api/cases/${caseId}/briefing`, { method: "POST", json: { language } });
      setConfirm(false);
      if (res.reused) toast("ok", "Matching audio already existed — reused it");
    }, "Briefing audio is ready").finally(() => setConfirm(false));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Briefing language" className="inline-flex rounded-[var(--radius-mark)] border border-rule-strong bg-raised p-0.5">
            {(["en", "hinglish"] as const).map((l) => (
              <button key={l} role="radio" aria-checked={language === l} onClick={() => router.replace(`?language=${l}`, { scroll: false })} className={`h-9 rounded-[3px] px-4 text-sm transition-colors ${language === l ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"}`}>
                {l === "en" ? "English" : "Hinglish"}
              </button>
            ))}
          </div>
          {blocked && <p className="text-sm text-rust-ink">{blocked}</p>}
        </div>

        {stale && <Alert tone="warn" title="Based on an out-of-date analysis">The evidence changed. Re-analyse and review before generating audio.</Alert>}
        {(error || lastError) && <Alert tone="error" title="That didn’t work">{error ?? lastError}</Alert>}

        {/* Step 2 — listen. Shown first when audio exists: it is the payoff. */}
        <section aria-labelledby="listen-h" className="rounded-[var(--radius-obj)] border border-rule bg-raised p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="listen-h" className="flex items-center gap-2 font-serif text-2xl"><Headphones className="size-5 text-rust-ink" aria-hidden />Listen to my case</h2>
            {!cached && (
              <Button variant="accent" disabled={Boolean(blocked) || !voiceConfigured || quotaLeft <= 0 || editing} onClick={() => setConfirm(true)} icon={<Volume2 className="size-4" aria-hidden />}>
                Generate voice
              </Button>
            )}
          </div>
          {cached ? (
            <SyncedBriefing src={`/api/briefings/${cached.id}/audio`} text={text} alignment={cached.alignment} />
          ) : (
            <p className="max-w-prose text-sm text-ink-2">
              {!voiceConfigured ? "Voice is not configured on this server. The script below is still yours to read." : "ElevenLabs reads the script below in a calm voice, and the transcript highlights as it plays. Audio is saved, so replays are free."}
            </p>
          )}
        </section>

        {/* Step 1 — the script. */}
        <section aria-labelledby="script-h">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-2">
            <div className="flex items-center gap-2">
              <h2 id="script-h" className="label">Script</h2>
              <Tag tone={ORIGIN[scriptOrigin].tone}>{ORIGIN[scriptOrigin].label}</Tag>
            </div>
            <span className="font-mono text-micro text-ink-2">{characters} characters · ~{Math.max(10, Math.round(text.split(/\s+/).length / 2.5))} s</span>
          </div>
          {scriptStale && <p className="mt-3 text-[0.8125rem] text-warn">Your findings changed since the saved script was written, so the plain template is shown. Write or edit it again.</p>}

          {editing ? (
            <div className="mt-4 space-y-3">
              <label htmlFor="script" className="sr-only">Edit script</label>
              <Textarea id="script" rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} className="bg-white font-serif text-[1.05rem] leading-relaxed" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" loading={busy === "save"} onClick={() => run("save", () => api(`/api/cases/${caseId}/briefing/script`, { method: "PUT", json: { language, text: draft } }), "Script saved")}>Save script</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(text); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            !cached && <p className="mt-4 max-w-prose font-serif text-[1.15rem] leading-[1.75] text-ink">{text}</p>
          )}

          {!editing && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={busy === "draft"} disabled={Boolean(blocked) || !gemmaConfigured} onClick={() => run("draft", () => api(`/api/cases/${caseId}/briefing/script`, { method: "POST", json: { language } }), "Gemma wrote a new script")} icon={<Sparkles className="size-3.5" aria-hidden />}>
                {scriptOrigin === "gemma" ? "Rewrite with Gemma" : `Write ${language === "hinglish" ? "Hinglish" : "natural"} script with Gemma`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDraft(text); setEditing(true); }} icon={<PenLine className="size-3.5" aria-hidden />}>Edit</Button>
              {scriptOrigin !== "template" && (
                <Button size="sm" variant="ghost" loading={busy === "reset"} onClick={() => run("reset", () => api(`/api/cases/${caseId}/briefing/script?language=${language}`, { method: "DELETE" }), "Back to the plain template")} icon={<RotateCcw className="size-3.5" aria-hidden />}>Use template</Button>
              )}
            </div>
          )}
          <p className="mt-3 text-[0.75rem] text-ink-2">Scripts use only findings you confirmed or corrected. Gemma drafts are rejected if they mention a number that isn’t in those findings. Changing the script creates new audio next time.</p>
        </section>
      </div>

      <aside className="space-y-4 text-sm text-ink-2 lg:border-l lg:border-rule lg:pl-6">
        <div>
          <p className="label">Voice generations today</p>
          <p className="mt-1 font-serif text-2xl tabular-nums text-ink">{usage.used}<span className="text-ink-2">/{usage.limit}</span></p>
        </div>
        <p>Same script, voice and settings reuse saved audio and don’t count again.</p>
        <p>Generating sends only the script text — not your files — to ElevenLabs.</p>
        <p className="font-mono text-micro">{language === "hinglish" ? "Hinglish voice" : "English voice"} · eleven_multilingual_v2</p>
      </aside>

      <Dialog
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="Generate the voice briefing?"
        footer={<><Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={Boolean(busy)}>Cancel</Button><Button size="sm" variant="primary" loading={busy === "audio"} onClick={generate}>Generate</Button></>}
      >
        <ul className="list-disc space-y-1 pl-5">
          <li>The {characters}-character script is sent to ElevenLabs.</li>
          <li>Uses 1 of your {quotaLeft} remaining voice generations today, and about {characters} characters of ElevenLabs credit.</li>
          <li>Audio is saved privately with this case for replay.</li>
        </ul>
      </Dialog>
    </div>
  );
}
