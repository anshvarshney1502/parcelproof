import Link from "next/link";
import { FileText, Image as ImageIcon, FileSpreadsheet, FileType2, AudioLines } from "lucide-react";
import { loadCase } from "@/lib/load-case";
import { listEvidence } from "@/lib/repo/evidence";
import { limits } from "@/lib/env";
import { fmtBytes, plain } from "@/lib/format";
import { Dropzone } from "@/components/app/dropzone";
import { EvidenceInspector } from "@/components/app/evidence-inspector";
import { ExtractionBadge } from "@/components/ui/status";
import { Alert, SectionLabel } from "@/components/ui/feedback";

export const metadata = { title: "Evidence" };

const ICON = { pdf: FileType2, image: ImageIcon, text: FileText, csv: FileSpreadsheet, audio: AudioLines };

export default async function EvidencePage({ params, searchParams }: PageProps<"/app/cases/[caseId]/evidence">) {
  const { caseId } = await params;
  const sp = await searchParams;
  const { user, kase } = await loadCase(caseId);
  const evidence = await listEvidence(user.id, caseId);
  const selected = evidence.find((e) => e._id === sp.e) ?? evidence[0];
  const num = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);
  const hl = num(sp.p) && num(sp.s) !== undefined && num(sp.t) ? { page: num(sp.p)!, start: num(sp.s)!, end: num(sp.t)! } : undefined;
  const remaining = limits.maxEvidencePerCase - evidence.length;

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-8">
        {kase.archivedAt ? (
          <Alert tone="info" title="This case is archived">Restore it to add new evidence.</Alert>
        ) : (
          <Dropzone caseId={caseId} maxBytes={limits.maxUploadBytes} remaining={remaining} />
        )}

        <section>
          <SectionLabel aside={<span className="font-mono text-micro text-ink-2">{evidence.length}/{limits.maxEvidencePerCase}</span>}>Source index</SectionLabel>
          {evidence.length === 0 ? (
            <p className="text-sm text-ink-2">No evidence yet. Useful files include the invoice, the courier tracking page (saved as PDF or screenshot), the customer’s message, packing photos and return labels.</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {evidence.map((e) => {
                const Icon = ICON[e.kind];
                const active = selected?._id === e._id;
                return (
                  <li key={e._id}>
                    <Link href={`?e=${e._id}`} scroll={false} aria-current={active ? "true" : undefined} className={`flex gap-3 px-2 py-3 transition-colors ${active ? "bg-raised" : "hover:bg-raised/60"}`}>
                      <span className={`mt-0.5 w-8 shrink-0 font-mono text-micro ${active ? "text-rust-ink" : "text-ink-2"}`}>{e.sourceId}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <Icon className="size-3.5 shrink-0 text-ink-2" aria-hidden />
                          <span className="truncate text-sm text-ink">{e.filename}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <ExtractionBadge status={e.status} corrected={Boolean(e.correctedAt)} audio={e.kind === "audio"} />
                          <span className="font-mono text-micro text-ink-2">{fmtBytes(e.size)}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <p className="text-[0.8125rem] text-ink-2">Each file gets a permanent source id (S1, S2…). Findings cite these ids with exact quotations so you can trace every statement back here.</p>
      </div>

      <div className="min-w-0">
        {selected ? <EvidenceInspector key={`${selected._id}:${selected.status}:${selected.correctedAt ?? ""}`} ev={plain(selected)} highlight={selected._id === sp.e ? hl : undefined} /> : (
          <div className="hidden h-full min-h-64 place-items-center rounded-[var(--radius-obj)] border border-dashed border-rule xl:grid">
            <p className="max-w-xs text-center text-sm text-ink-2">Select a file to inspect its original and the text ParcelProof extracted from it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
