import { loadCase } from "@/lib/load-case";
import { analysisHistory, analysisState } from "@/lib/repo/analysis";
import { usageToday } from "@/lib/repo/usage";
import { config, limits } from "@/lib/env";
import { EVIDENCE_STATUSES } from "@/lib/schemas";
import { fmtRelative, plain } from "@/lib/format";
import { AnalyzePanel } from "@/components/app/analyze-panel";
import { FindingCard } from "@/components/app/finding-card";
import { EvidenceBadge, STATUS_HELP } from "@/components/ui/status";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Review" };

const GROUP_TITLE = { supported: "Supported by records", conflicting: "Conflicting records", unverified: "Unverified statements", missing: "Missing information" };

export default async function ReviewPage({ params }: PageProps<"/app/cases/[caseId]/review">) {
  const { caseId } = await params;
  const { user } = await loadCase(caseId);
  const [{ current, latest, stale, evidence }, usage, history] = await Promise.all([analysisState(user.id, caseId), usageToday(user.id), analysisHistory(user.id, caseId)]);
  const status = config.status();
  const processing = evidence.some((e) => e.status === "processing");
  const readable = evidence.filter((e) => e.status === "extracted").length;
  const failedFiles = evidence.filter((e) => e.status === "failed");
  const blocker = !evidence.length ? "Add evidence first." : processing ? "Some evidence is still being processed." : !readable ? "None of the evidence has readable text yet. Retry extraction or enter the text manually." : undefined;
  const latestFailed = latest && latest.status === "failed" && (!current || latest.version > current.version) ? plain({ error: latest.error, stages: latest.stages }) : undefined;
  const reviewed = current?.findings.filter((f) => f.review !== "pending").length ?? 0;

  return (
    <div className="space-y-10">
      <AnalyzePanel
        caseId={caseId}
        hasAnalysis={Boolean(current)}
        stale={stale}
        canRun={!blocker}
        blocker={blocker}
        latestFailed={latestFailed}
        configured={status.gemma}
        modelId={status.gemmaModel}
        usage={{ used: usage.ai, limit: limits.aiDailyLimit }}
      />
      {failedFiles.length > 0 && current && <Alert tone="warn" title={`${failedFiles.length} file(s) were not analysed`}>{failedFiles.map((f) => f.sourceId).join(", ")} had no readable text. Fix them on the Evidence tab and re-analyse.</Alert>}

      {!current ? (
        <EmptyState mark="No findings yet" title="Findings appear after an analysis">
          <p>ParcelProof will list what the records support, where they conflict, what is only claimed, and what is missing — each tied to a quotation from your files.</p>
        </EmptyState>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            {stale && <div className="mb-6"><Alert tone="warn" title="These findings may be out of date">The evidence changed after this analysis. Re-analyse before relying on them.</Alert></div>}
            <div className="mb-8">
              <p className="label">Summary · analysis v{current.version}</p>
              <p className="mt-2 max-w-prose font-serif text-[1.25rem] leading-relaxed">{current.summary}</p>
              <p className="mt-2 text-[0.8125rem] text-ink-2">These are evidence-review statuses, not legal decisions. ParcelProof does not decide who is right or whether anyone acted dishonestly.</p>
            </div>

            {EVIDENCE_STATUSES.map((s) => {
              const list = current.findings.map((f, i) => ({ f, i })).filter(({ f }) => f.status === s);
              if (!list.length) return null;
              return (
                <section key={s} id={s} className="mb-10 scroll-mt-24" aria-labelledby={`g-${s}`}>
                  <div className="flex flex-wrap items-baseline gap-3 pb-1">
                    <h2 id={`g-${s}`} className="font-serif text-2xl">{GROUP_TITLE[s]}</h2>
                    <span className="text-[0.8125rem] text-ink-2">{STATUS_HELP[s]}</span>
                  </div>
                  {list.map(({ f, i }) => <FindingCard key={f.id} caseId={caseId} f={plain(f)} index={i} />)}
                </section>
              );
            })}
            {current.findings.length === 0 && <p className="text-ink-2">The model returned no findings that could be shown.</p>}

            <section className="mb-10" aria-labelledby="gaps-h">
              <h2 id="gaps-h" className="font-serif text-2xl">Evidence checklist</h2>
              <p className="mt-1 text-[0.8125rem] text-ink-2">Information that could strengthen or clarify the case.</p>
              {current.gaps.length === 0 ? <p className="mt-3 text-sm text-ink-2">No gaps identified.</p> : (
                <ul className="mt-4 divide-y divide-rule border-y border-rule">
                  {current.gaps.map((g) => (
                    <li key={g.id} className="grid gap-1 py-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                      <span className={`font-mono text-micro uppercase tracking-[0.06em] ${g.importance === "required" ? "text-rust-ink" : "text-ink-2"}`}>{g.importance}</span>
                      <div>
                        <p className="text-ink">{g.description}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-ink-2">{g.whyItMatters}{g.nextStep && <> <span className="text-ink">Next:</span> {g.nextStep}</>}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(current.validation.rejected.length > 0 || current.validation.warnings.length > 0 || current.truncated) && (
              <details className="rounded-[var(--radius-obj)] border border-rule bg-raised px-4 py-3 text-sm">
                <summary className="cursor-pointer text-ink">Validation log · {current.validation.rejected.length} reference(s) rejected, {current.validation.warnings.length} warning(s)</summary>
                <div className="mt-3 space-y-3 text-[0.8125rem] text-ink-2">
                  {current.truncated && <p>Evidence exceeded the input limit; some text at the end was not sent to the model.</p>}
                  {current.validation.rejected.length > 0 && <ul className="list-disc space-y-1 pl-5">{current.validation.rejected.map((r, i) => <li key={i}><span className="text-ink">{r.what}</span> — {r.reason}</li>)}</ul>}
                  {current.validation.warnings.length > 0 && <ul className="list-disc space-y-1 pl-5">{current.validation.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
                </div>
              </details>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-10 space-y-6 border-l border-rule pl-6">
              <div>
                <p className="label">Review progress</p>
                <p className="mt-1 font-serif text-3xl tabular-nums">{reviewed}<span className="text-ink-2">/{current.findings.length}</span></p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunk" aria-hidden><div className="h-full bg-moss" style={{ width: `${current.findings.length ? (reviewed / current.findings.length) * 100 : 0}%` }} /></div>
                {reviewed === current.findings.length && current.findings.length > 0 && <ButtonLink href={`/app/cases/${caseId}/briefing`} size="sm" variant="primary" className="mt-4 w-full">Listen to my case</ButtonLink>}
              </div>
              <nav aria-label="Finding groups" className="space-y-2">
                {EVIDENCE_STATUSES.map((s) => {
                  const n = current.findings.filter((f) => f.status === s).length;
                  return n ? <a key={s} href={`#${s}`} className="flex items-center justify-between gap-2 hover:opacity-80"><EvidenceBadge status={s} /><span className="font-mono text-micro text-ink-2">{n}</span></a> : null;
                })}
              </nav>
              {history.length > 1 && (
                <div>
                  <p className="label mb-2">History</p>
                  <ul className="space-y-1 font-mono text-micro text-ink-2">
                    {history.map((h) => <li key={String(h._id)}>v{h.version} · {h.status} · {fmtRelative(h.createdAt)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
