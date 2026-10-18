"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PenLine, EyeOff, Undo2, Info } from "lucide-react";
import type { CaseFinding } from "@/lib/types";
import type { EvidenceStatus } from "@/lib/schemas";
import { EVIDENCE_STATUSES } from "@/lib/schemas";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { EvidenceBadge, Tag, STATUS_HELP } from "@/components/ui/status";
import { Textarea, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { Citation } from "./citation";

export function FindingCard({ caseId, f, index }: { caseId: string; f: Omit<CaseFinding, "reviewedAt">; index: number }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(f.correction ?? f.statement);
  const [status, setStatus] = useState<EvidenceStatus>(f.status);
  const [busy, setBusy] = useState<string>();

  const save = async (decision: "confirmed" | "corrected" | "dismissed" | "pending", extra: object = {}) => {
    setBusy(decision);
    try {
      await api(`/api/cases/${caseId}/analysis/review`, { method: "PATCH", json: { findingId: f.id, decision, ...extra } });
      toast("ok", { confirmed: "Finding confirmed", corrected: "Correction saved", dismissed: "Finding dismissed", pending: "Review undone" }[decision]);
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const dismissed = f.review === "dismissed";
  return (
    <article className={`grid gap-4 border-t border-rule py-6 sm:grid-cols-[3rem_minmax(0,1fr)] ${dismissed ? "opacity-60" : ""}`} aria-labelledby={`f-${f.id}`}>
      <span className="font-mono text-micro text-ink-2">F{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge status={f.status} />
          <span className="font-mono text-micro uppercase tracking-[0.06em] text-ink-2">{f.category}</span>
          {f.review === "confirmed" && <Tag tone="moss">Confirmed by you</Tag>}
          {f.review === "corrected" && <Tag tone="archive">Corrected by you</Tag>}
          {dismissed && <Tag>Dismissed · excluded from report</Tag>}
          {f.status !== f.modelStatus && <Tag tone="rust">Model said {f.modelStatus}</Tag>}
        </div>

        {editing ? (
          <div className="mt-3 space-y-3">
            <label htmlFor={`corr-${f.id}`} className="sr-only">Corrected statement</label>
            <Textarea id={`corr-${f.id}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="font-serif text-[1.05rem]" />
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={`st-${f.id}`} className="text-[0.8125rem] text-ink-2">Evidence status</label>
              <Select id={`st-${f.id}`} value={status} onChange={(e) => setStatus(e.target.value as EvidenceStatus)} className="h-9 w-auto text-sm">
                {EVIDENCE_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" loading={busy === "corrected"} disabled={!text.trim()} onClick={() => save("corrected", { correction: text.trim(), status })}>Save correction</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <h3 id={`f-${f.id}`} className="mt-2 font-serif text-[1.25rem] leading-snug text-ink">{f.review === "corrected" && f.correction ? f.correction : f.statement}</h3>
            {f.review === "corrected" && <p className="mt-1 text-[0.8125rem] text-ink-2"><span className="label">AI wording </span>{f.statement}</p>}
          </>
        )}

        {f.validationNotes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {f.validationNotes.map((n) => <li key={n} className="flex gap-2 text-[0.8125rem] text-warn"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />{n}</li>)}
          </ul>
        )}

        {(f.supporting.length > 0 || f.conflicting.length > 0) && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {f.supporting.map((r, i) => <Citation key={`s${i}`} caseId={caseId} cite={r} />)}
            {f.conflicting.map((r, i) => <Citation key={`c${i}`} caseId={caseId} cite={r} tone="conflict" />)}
          </div>
        )}
        {f.supporting.length === 0 && f.conflicting.length === 0 && f.status !== "missing" && (
          <p className="mt-3 text-[0.8125rem] text-ink-2">No verified quotation supports this statement.</p>
        )}

        <dl className="mt-4 grid gap-3 text-[0.8125rem] sm:grid-cols-2">
          {f.limitation && <div><dt className="label">What this cannot show</dt><dd className="mt-0.5 text-ink-2">{f.limitation}</dd></div>}
          {f.nextAction && <div><dt className="label">Suggested next step</dt><dd className="mt-0.5 text-ink-2">{f.nextAction}</dd></div>}
        </dl>

        {!editing && (
          <div className="mt-4 flex flex-wrap gap-2">
            {f.review === "pending" ? (
              <>
                <Button size="sm" variant="secondary" loading={busy === "confirmed"} onClick={() => save("confirmed")} icon={<Check className="size-3.5" aria-hidden />}>Confirm</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} icon={<PenLine className="size-3.5" aria-hidden />}>Correct</Button>
                <Button size="sm" variant="ghost" loading={busy === "dismissed"} onClick={() => save("dismissed")} icon={<EyeOff className="size-3.5" aria-hidden />}>Dismiss</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} icon={<PenLine className="size-3.5" aria-hidden />}>Edit</Button>
                <Button size="sm" variant="ghost" loading={busy === "pending"} onClick={() => save("pending")} icon={<Undo2 className="size-3.5" aria-hidden />}>Undo review</Button>
              </>
            )}
            <span className="ml-auto hidden self-center text-[0.75rem] text-ink-2 md:inline">{STATUS_HELP[f.status]}</span>
          </div>
        )}
      </div>
    </article>
  );
}
