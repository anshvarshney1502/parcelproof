"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, EyeOff, Undo2 } from "lucide-react";
import type { EvidenceEvent } from "@/lib/types";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { Citation } from "./citation";

const fmtWhen = (e: EvidenceEvent) => {
  if (!e.date) return "Date unknown";
  const [d, t] = e.date.split("T");
  const label = new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return t ? `${label}, ${t.slice(0, 5)}` : label;
};

export function Timeline({ caseId, events }: { caseId: string; events: EvidenceEvent[] }) {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const dated = events.filter((e) => e.date && e.dateCertainty !== "unknown");
  const undated = events.filter((e) => !(e.date && e.dateCertainty !== "unknown"));
  const [selected, setSelected] = useState<string | undefined>(events[0]?.id);
  const [busy, setBusy] = useState<string>();
  const sel = events.find((e) => e.id === selected);

  const review = async (e: EvidenceEvent, decision: "confirmed" | "dismissed" | "pending") => {
    setBusy(decision);
    try {
      await api(`/api/cases/${caseId}/analysis/review`, { method: "PATCH", json: { eventId: e.id, decision } });
      toast("ok", decision === "confirmed" ? "Event confirmed" : decision === "dismissed" ? "Event dismissed" : "Review undone");
      router.refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  // A render helper, not a nested component: a component declared here would remount every row on each render.
  const row = (e: EvidenceEvent) => {
    const active = e.id === selected;
    return (
      <li key={e.id} className="relative pl-8">
        <span aria-hidden className={`absolute left-[7px] top-[1.15rem] size-[9px] rounded-full border-2 transition-colors ${active ? "border-rust bg-rust" : e.dateCertainty === "exact" ? "border-ink bg-paper" : "border-ink-3 border-dashed bg-paper"}`} />
        <button onClick={() => setSelected(e.id)} aria-pressed={active} className={`w-full rounded-[var(--radius-mark)] px-3 py-2.5 text-left transition-colors ${active ? "bg-raised shadow-[inset_2px_0_0_var(--rust)]" : "hover:bg-raised/60"} ${e.review === "dismissed" ? "opacity-50" : ""}`}>
          <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-micro text-ink-2">
            <span className={e.dateCertainty === "exact" ? "text-ink" : ""}>{fmtWhen(e)}</span>
            {e.dateCertainty === "approximate" && <span className="text-warn">approx.</span>}
            <span className="uppercase tracking-[0.06em]">{e.type}</span>
          </span>
          <span className="mt-0.5 block text-sm text-ink">{e.description}</span>
          <span className="mt-0.5 block text-[0.8125rem] text-ink-2">{e.attributedTo} · {e.refs.map((r) => r.sourceId).join(", ")}</span>
        </button>
      </li>
    );
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="min-w-0">
        <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-rule-strong" aria-label="Dated events">
          {dated.map(row)}
        </ol>
        {dated.length === 0 && <p className="text-sm text-ink-2">No event had a date the evidence could support.</p>}
        {undated.length > 0 && (
          <section className="mt-10" aria-labelledby="undated-h">
            <h2 id="undated-h" className="label border-b border-rule pb-2">Undated or uncertain — not placed on the timeline</h2>
            <ol className="relative mt-3 space-y-1">{undated.map(row)}</ol>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-10 lg:self-start" aria-live="polite">
        {sel && (
          <motion.div key={sel.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="rounded-[var(--radius-obj)] border border-rule bg-raised p-5">
            <p className="font-mono text-micro text-ink-2">{fmtWhen(sel)} · {sel.dateCertainty}{sel.originalDateText ? ` · written as “${sel.originalDateText}”` : ""}</p>
            <h2 className="mt-2 font-serif text-xl leading-snug">{sel.description}</h2>
            <dl className="mt-3 grid grid-cols-[6.5rem_1fr] gap-y-1 text-[0.8125rem]">
              <dt className="text-ink-2">Attributed to</dt><dd className="text-ink">{sel.attributedTo}</dd>
              <dt className="text-ink-2">Type</dt><dd className="text-ink">{sel.type}</dd>
              <dt className="text-ink-2">Your review</dt><dd>{sel.review === "pending" ? <span className="text-ink-2">Not reviewed</span> : <Tag tone={sel.review === "confirmed" ? "moss" : "plain"}>{sel.review}</Tag>}</dd>
            </dl>
            <div className="mt-4 space-y-3">{sel.refs.map((r, i) => <Citation key={i} caseId={caseId} cite={r} />)}</div>
            <p className="mt-3 text-[0.75rem] text-ink-2">An event records what a document says happened. Attribution matters: a customer’s message is their account, a courier scan is the courier’s record.</p>
            <div className="mt-4 flex gap-2">
              {sel.review === "pending" ? (
                <>
                  <Button size="sm" loading={busy === "confirmed"} onClick={() => review(sel, "confirmed")} icon={<Check className="size-3.5" aria-hidden />}>Confirm</Button>
                  <Button size="sm" variant="ghost" loading={busy === "dismissed"} onClick={() => review(sel, "dismissed")} icon={<EyeOff className="size-3.5" aria-hidden />}>Dismiss</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" loading={busy === "pending"} onClick={() => review(sel, "pending")} icon={<Undo2 className="size-3.5" aria-hidden />}>Undo review</Button>
              )}
            </div>
          </motion.div>
        )}
      </aside>
    </div>
  );
}
