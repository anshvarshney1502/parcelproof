import Link from "next/link";
import { Check, Circle, ArrowRight } from "lucide-react";
import { loadCase } from "@/lib/load-case";
import { analysisState } from "@/lib/repo/analysis";
import { collections } from "@/lib/db";
import { fmtDate, fmtRelative } from "@/lib/format";
import { CaseForm } from "@/components/app/case-form";
import { SectionLabel, Alert } from "@/components/ui/feedback";
import { EvidenceBadge } from "@/components/ui/status";
import { EVIDENCE_STATUSES, type CaseInput } from "@/lib/schemas";

export default async function CaseOverview({ params, searchParams }: PageProps<"/app/cases/[caseId]">) {
  const { caseId } = await params;
  const { edit } = await searchParams;
  const { user, kase } = await loadCase(caseId);

  if (edit === "1") {
    const { _id, ownerId, status, archivedAt, resolvedAt, sourceCounter, pendingReview, createdAt, updatedAt, appealDraft, ...fields } = kase;
    void [_id, ownerId, status, archivedAt, resolvedAt, sourceCounter, pendingReview, createdAt, updatedAt, appealDraft];
    return (
      <div className="max-w-3xl">
        <h2 className="mb-6 font-serif text-2xl">Edit case details</h2>
        <CaseForm caseId={kase._id} initial={fields as Partial<CaseInput>} />
      </div>
    );
  }

  const { current, stale, evidence } = await analysisState(user.id, caseId);
  const { briefings } = await collections();
  const hasAudio = (await briefings.countDocuments({ caseId, ownerId: user.id, status: "ready" })) > 0;
  const extracted = evidence.filter((e) => e.status === "extracted").length;
  const reviewedAll = current && current.findings.length > 0 && current.findings.every((f) => f.review !== "pending");
  const base = `/app/cases/${caseId}`;

  const steps = [
    { done: evidence.length > 0, label: "Add evidence", detail: evidence.length ? `${evidence.length} file(s), ${extracted} readable` : "No files yet", href: `${base}/evidence` },
    { done: Boolean(current) && !stale, label: "Analyse evidence", detail: current ? (stale ? "Evidence changed since the last analysis" : `Version ${current.version}, ${fmtRelative(current.completedAt ?? current.createdAt)}`) : "Not run yet", href: `${base}/review` },
    { done: Boolean(reviewedAll), label: "Review findings", detail: current ? `${current.findings.filter((f) => f.review !== "pending").length} of ${current.findings.length} reviewed` : "Waiting for analysis", href: `${base}/review` },
    { done: hasAudio, label: "Listen to the briefing", detail: hasAudio ? "Audio ready" : "Optional", href: `${base}/briefing` },
    { done: false, label: "Export the report", detail: "PDF from your reviewed findings", href: `${base}/report` },
  ];
  const nextStep = steps.find((s) => !s.done);

  const rows: [string, string | undefined][] = [
    ["Order reference", kase.orderRef],
    ["Order value", kase.orderValue !== undefined ? `${kase.orderValue.toLocaleString("en-IN")} ${kase.currency}` : undefined],
    ["Sales channel", kase.channel],
    ["Customer reference", kase.customerRef],
    ["Ordered", kase.orderDate && fmtDate(kase.orderDate)],
    ["Dispatched", kase.dispatchDate && fmtDate(kase.dispatchDate)],
    ["Expected delivery", kase.expectedDeliveryDate && fmtDate(kase.expectedDeliveryDate)],
    ["Dispute opened", kase.disputeDate && fmtDate(kase.disputeDate)],
    ["Response deadline", kase.deadline && fmtDate(kase.deadline)],
  ];

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-10">
        {stale && <Alert tone="warn" title="The analysis is out of date">Evidence or case details changed after the last analysis. Re-run it on the <Link href={`${base}/review`}>Review</Link> tab before relying on the findings.</Alert>}

        <section>
          <SectionLabel>Where this case stands</SectionLabel>
          {current ? (
            <>
              <p className="max-w-prose font-serif text-[1.25rem] leading-relaxed text-ink">{current.summary}</p>
              <p className="mt-2 font-mono text-micro text-ink-2">AI-generated summary · analysis v{current.version} · {current.modelId} · review findings before relying on it</p>
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                {EVIDENCE_STATUSES.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <dt><EvidenceBadge status={s} /></dt>
                    <dd className="font-serif text-xl tabular-nums">{current.findings.filter((f) => f.status === s && f.review !== "dismissed").length}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="max-w-prose text-ink-2">No analysis yet. Once you add evidence and run an analysis, a neutral summary of what the records show will appear here.</p>
          )}
        </section>

        <section>
          <SectionLabel>Seller’s account</SectionLabel>
          {kase.description ? <p className="max-w-prose whitespace-pre-line text-ink">{kase.description}</p> : <p className="text-ink-2">No description. <Link className="underline" href={`${base}?edit=1`}>Add one</Link>.</p>}
          <p className="mt-2 text-[0.8125rem] text-ink-2">Your description is a claim, not evidence. Analysis treats it that way.</p>
        </section>

        <section>
          <SectionLabel aside={<Link href={`${base}?edit=1`} className="text-[0.8125rem] text-ink-2 underline-offset-2 hover:underline">Edit</Link>}>Order details</SectionLabel>
          <dl className="grid gap-x-8 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dotted border-rule py-2.5">
                <dt className="text-[0.8125rem] text-ink-2">{k}</dt>
                <dd className={`text-right ${v ? "text-ink" : "text-ink-3"} ${k.includes("reference") ? "font-mono text-[0.8125rem]" : ""}`}>{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 font-mono text-micro text-ink-2">Created {fmtDate(kase.createdAt)} · updated {fmtRelative(kase.updatedAt)}</p>
        </section>
      </div>

      <aside className="lg:border-l lg:border-rule lg:pl-8">
        <p className="label mb-4">Case progress</p>
        <ol className="relative space-y-1">
          {steps.map((s, i) => {
            const isNext = s === nextStep;
            return (
              <li key={s.label}>
                <Link href={s.href} className={`group flex gap-3 rounded-[var(--radius-mark)] px-2 py-2.5 transition-colors hover:bg-raised ${isNext ? "bg-raised" : ""}`}>
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${s.done ? "border-ok bg-ok text-white" : isNext ? "border-rust-ink text-rust-ink" : "border-rule-strong text-ink-3"}`}>
                    {s.done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <Circle className="size-1.5 fill-current" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm text-ink">
                      <span className="font-mono text-micro text-ink-2">{String(i + 1).padStart(2, "0")}</span> {s.label}
                      {isNext && <ArrowRight className="ml-auto size-3.5 text-rust-ink transition-transform group-hover:translate-x-0.5" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-ink-2">{s.done ? <span className="sr-only">Done. </span> : null}{s.detail}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
