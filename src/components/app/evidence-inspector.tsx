"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, PenLine, ExternalLink, Download } from "lucide-react";
import type { EvidenceDoc, PageText } from "@/lib/types";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { ExtractionBadge } from "@/components/ui/status";
import { Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { fmtBytes, fmtDate } from "@/lib/format";

type Ev = EvidenceDoc;

export function EvidenceInspector({ ev, highlight }: { ev: Ev; highlight?: { page: number; start: number; end: number } }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<"text" | "original">("text");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PageText[]>(ev.pages.length ? ev.pages : [{ page: 1, text: "" }]);
  const [busy, setBusy] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [highlight?.start, ev._id]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast("ok", ok);
      router.refresh();
      return true;
    } catch (e) {
      toast("error", (e as Error).message);
      return false;
    } finally {
      setBusy(undefined);
    }
  };

  const fileUrl = `/api/evidence/${ev._id}/file`;
  const pagesToShow = showOriginal && ev.originalPages ? ev.originalPages : ev.pages;

  return (
    <article className="rounded-[var(--radius-obj)] border border-rule bg-raised" aria-labelledby="insp-title">
      <header className="border-b border-rule px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-mark)] bg-ink px-1.5 py-0.5 font-mono text-micro text-paper">{ev.sourceId}</span>
          <ExtractionBadge status={ev.status} corrected={Boolean(ev.correctedAt)} />
        </div>
        <h2 id="insp-title" className="mt-2 break-words font-serif text-xl leading-snug">{ev.filename}</h2>
        <p className="mt-1 font-mono text-micro text-ink-2">
          {ev.kind.toUpperCase()} · {fmtBytes(ev.size)}{ev.pageCount ? ` · ${ev.pageCount} page(s)` : ""} · added {fmtDate(ev.uploadedAt)}{ev.method ? ` · ${ev.method === "ocr" || ev.method === "pdf-ocr" ? "OCR" : ev.method === "mixed" ? "text + OCR" : "embedded text"}` : ""}
        </p>
        <p className="mt-1 break-all font-mono text-[0.625rem] text-ink-3" title="SHA-256">sha256 {ev.sha256}</p>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-rule px-5">
        <div role="tablist" aria-label="Evidence view" className="flex gap-4">
          {(["text", "original"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`relative h-10 text-sm ${view === v ? "text-ink" : "text-ink-2 hover:text-ink"}`}>
              {v === "text" ? "Extracted text" : "Original file"}
              <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[2px] bg-ink transition-transform ${view === v ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <a href={fileUrl} target="_blank" rel="noopener" className="grid size-8 place-items-center rounded text-ink-2 hover:bg-sunk hover:text-ink" aria-label="Open original in new tab"><ExternalLink className="size-4" aria-hidden /></a>
          <a href={`${fileUrl}?download=1`} className="grid size-8 place-items-center rounded text-ink-2 hover:bg-sunk hover:text-ink" aria-label="Download original"><Download className="size-4" aria-hidden /></a>
        </div>
      </div>

      <div className="px-5 py-4">
        {view === "original" ? (
          ev.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={`Original image ${ev.filename}`} className="max-h-[32rem] w-full rounded-[var(--radius-mark)] border border-rule object-contain bg-paper" />
          ) : ev.kind === "pdf" ? (
            <iframe src={fileUrl} title={`Original PDF ${ev.filename}`} className="h-[32rem] w-full rounded-[var(--radius-mark)] border border-rule bg-paper" />
          ) : (
            <iframe src={fileUrl} title={`Original file ${ev.filename}`} sandbox="" className="h-[24rem] w-full rounded-[var(--radius-mark)] border border-rule bg-white" />
          )
        ) : (
          <div className="space-y-4">
            {ev.status === "failed" && !editing && (
              <Alert tone="error" title="Text could not be extracted" action={!ev.correctedAt && <Button size="sm" loading={busy === "retry"} onClick={() => run("retry", () => api(`/api/evidence/${ev._id}/retry`, { method: "POST" }), "Extraction finished")} icon={<RefreshCw className="size-3.5" aria-hidden />}>Retry</Button>}>
                {ev.error} You can also type the relevant text yourself.
              </Alert>
            )}
            {ev.warnings?.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
            {ev.correctedAt && !editing && (
              <p className="text-[0.8125rem] text-ink-2">
                You corrected this text on {fmtDate(ev.correctedAt)}. Analysis uses your version.{" "}
                {ev.originalPages && <button className="underline" onClick={() => setShowOriginal((s) => !s)}>{showOriginal ? "Show corrected" : "Compare with machine extraction"}</button>}
              </p>
            )}

            {editing ? (
              <div className="space-y-3">
                {draft.map((p, i) => (
                  <div key={p.page}>
                    <label htmlFor={`pg-${p.page}`} className="label">Page {p.page}</label>
                    <Textarea id={`pg-${p.page}`} rows={10} value={p.text} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className="mt-1 font-mono text-[0.8125rem]" />
                  </div>
                ))}
                <p className="text-[0.8125rem] text-ink-2">Only fix what the file actually says. Corrections change the evidence the analysis reads and will mark the current analysis out of date.</p>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" loading={busy === "save"} onClick={async () => { if (await run("save", () => api(`/api/evidence/${ev._id}`, { method: "PATCH", json: { pages: draft } }), "Text correction saved")) setEditing(false); }}>Save correction</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(ev.pages.length ? ev.pages : [{ page: 1, text: "" }]); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              pagesToShow.length > 0 && (
                <div className="max-h-[32rem] space-y-5 overflow-y-auto pr-1">
                  {pagesToShow.map((p) => (
                    <section key={p.page} aria-label={`Page ${p.page}`}>
                      {pagesToShow.length > 1 && <p className="label mb-1.5 border-b border-dotted border-rule pb-1">Page {p.page}</p>}
                      <pre className="whitespace-pre-wrap break-words font-mono text-[0.8125rem] leading-relaxed text-ink">
                        {highlight && highlight.page === p.page && !showOriginal ? (
                          <>
                            {p.text.slice(0, highlight.start)}
                            <mark ref={markRef} className="cite">{p.text.slice(highlight.start, highlight.end)}</mark>
                            {p.text.slice(highlight.end)}
                          </>
                        ) : (p.text || <span className="text-ink-3">(no text on this page)</span>)}
                      </pre>
                    </section>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-rule px-5 py-3">
        {!editing && ev.status !== "processing" && (
          <Button size="sm" variant="secondary" onClick={() => { setView("text"); setEditing(true); }} icon={<PenLine className="size-3.5" aria-hidden />}>
            {ev.status === "failed" ? "Enter text manually" : "Correct text"}
          </Button>
        )}
        {ev.status === "extracted" && !ev.correctedAt && (
          <Button size="sm" variant="ghost" loading={busy === "retry"} onClick={() => run("retry", () => api(`/api/evidence/${ev._id}/retry`, { method: "POST" }), "Extraction re-run")} icon={<RefreshCw className="size-3.5" aria-hidden />}>Re-extract</Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto text-err hover:bg-err-bg hover:text-err" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="size-3.5" aria-hidden />}>Delete</Button>
      </footer>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${ev.sourceId}?`}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button size="sm" variant="danger" loading={busy === "delete"} onClick={async () => { if (await run("delete", () => api(`/api/evidence/${ev._id}`, { method: "DELETE" }), `${ev.sourceId} deleted`)) router.push(location.pathname); }}>Delete file</Button>
          </>
        }
      >
        <p>The original file and its extracted text will be removed. Findings that cite {ev.sourceId} will be out of date until you re-run the analysis. The id {ev.sourceId} will not be reused.</p>
      </Dialog>
    </article>
  );
}
