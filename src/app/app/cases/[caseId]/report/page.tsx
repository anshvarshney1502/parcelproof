import { Download } from "lucide-react";
import { loadCase } from "@/lib/load-case";
import { analysisState } from "@/lib/repo/analysis";
import { reportContent } from "@/lib/report/content";
import { AppealEditor } from "@/components/app/appeal-editor";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { EvidenceBadge } from "@/components/ui/status";
import { ButtonLink, buttonClass } from "@/components/ui/button";

export const metadata = { title: "Report" };

export default async function ReportPage({ params }: PageProps<"/app/cases/[caseId]/report">) {
  const { caseId } = await params;
  const { user } = await loadCase(caseId);
  const { kase, current, evidence, stale } = await analysisState(user.id, caseId);
  if (!current)
    return (
      <EmptyState mark="No report yet" title="Reports are built from reviewed findings" action={<ButtonLink href={`/app/cases/${caseId}/review`} variant="primary" size="sm">Go to analysis</ButtonLink>}>
        <p>Run an analysis and confirm or correct the findings you agree with. The PDF then includes your timeline, findings with quotations, gaps, corrections, a draft response and a source index.</p>
      </EmptyState>
    );
  const r = reportContent(kase, current, evidence);
  const included = r.supported.length + r.conflicting.length + r.unverified.length + r.missing.length;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 space-y-6">
        {stale && <Alert tone="warn" title="The case changed after this analysis">The report will reflect analysis v{current.version}. Re-analyse to include the latest evidence.</Alert>}
        {r.pendingCount > 0 && <Alert tone="info" title={`${r.pendingCount} finding(s) not reviewed`}>Unreviewed findings are left out of the report.</Alert>}

        {/* Document preview: the same data the PDF renders. */}
        <article className="grain rounded-[var(--radius-obj)] border border-rule bg-[#fffefb] px-6 py-8 shadow-[0_1px_0_var(--rule),0_18px_40px_-28px_rgba(36,41,35,0.35)] sm:px-12 sm:py-12">
          <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-2">ParcelProof · evidence report · preview</p>
          <h2 className="mt-4 font-serif text-3xl leading-tight">{kase.title}</h2>
          <p className="mt-2 text-[0.8125rem] font-medium text-rust-ink">AI-assisted. Seller review required.</p>

          <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
            {r.caseInfo.slice(1).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-dotted border-rule py-1.5 text-sm"><dt className="text-ink-2">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>

          <h3 className="label mt-8 border-b border-rule pb-1">Summary</h3>
          <p className="mt-2 font-serif text-[1.05rem] leading-relaxed">{r.summary}</p>

          <h3 className="label mt-8 border-b border-rule pb-1">Timeline · {r.events.length} event(s)</h3>
          <ol className="mt-2 space-y-1 text-sm">
            {r.events.slice(0, 12).map((e) => <li key={e.id} className="grid grid-cols-[7.5rem_1fr] gap-3"><span className="font-mono text-micro text-archive-ink">{e.date ?? "uncertain"}</span><span>{e.description}</span></li>)}
            {r.events.length > 12 && <li className="text-ink-2">…and {r.events.length - 12} more in the PDF</li>}
          </ol>

          <h3 className="label mt-8 border-b border-rule pb-1">Findings included · {included}</h3>
          <ul className="mt-3 space-y-3">
            {[...r.supported, ...r.conflicting, ...r.unverified, ...r.missing].map((f) => (
              <li key={f.id}>
                <EvidenceBadge status={f.status} />
                <p className="mt-1 font-serif text-[1.05rem] leading-snug">{f.final}</p>
                <p className="font-mono text-micro text-archive-ink">{[...f.supporting, ...f.conflicting].map((s) => `${s.sourceId} p.${s.page}`).join(" · ") || "no quotation"}</p>
              </li>
            ))}
            {included === 0 && <li className="text-sm text-ink-2">No reviewed findings yet.</li>}
          </ul>

          <h3 className="label mt-8 border-b border-rule pb-1">Source index</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {r.sources.map((s) => <li key={s.sourceId} className="flex gap-3"><span className="w-8 font-mono text-micro text-archive-ink">{s.sourceId}</span><span className="truncate">{s.filename}</span><span className="ml-auto font-mono text-micro text-ink-2">{s.status}</span></li>)}
          </ul>
        </article>

        <section aria-labelledby="appeal-h">
          <h2 id="appeal-h" className="font-serif text-2xl">Draft response</h2>
          <p className="mb-3 mt-1 text-sm text-ink-2">A starting point for your reply to the marketplace or courier. It is included in the PDF exactly as saved.</p>
          <AppealEditor caseId={caseId} initial={r.appealDraft} isDefault={!kase.appealDraft?.trim()} />
        </section>
      </div>

      <aside className="lg:sticky lg:top-10 lg:self-start">
        <div className="rounded-[var(--radius-obj)] border border-rule bg-raised p-5">
          <p className="label">Export</p>
          <p className="mt-1 text-sm text-ink-2">The PDF is generated on the server from the saved case each time you download it.</p>
          {included > 0 ? (
            <a href={`/api/cases/${caseId}/report`} className={buttonClass("primary", "md", "mt-4 w-full")} download>
              <Download className="size-4" aria-hidden />Download PDF
            </a>
          ) : (
            <p className="mt-4 text-sm text-rust-ink">Confirm or correct at least one finding to enable export.</p>
          )}
          <ul className="mt-4 space-y-1 font-mono text-micro text-ink-2">
            <li>{included} finding(s) · {r.excludedCount} dismissed</li>
            <li>{r.events.length} timeline event(s)</li>
            <li>{r.sources.length} source(s)</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
