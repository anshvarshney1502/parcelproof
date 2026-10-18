"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

const STAGES: [string, string][] = [
  ["verify-case", "Verify case ownership"],
  ["load-evidence", "Load extracted evidence"],
  ["build-chunks", "Label sources and apply size limit"],
  ["extract-events", "Gemma: extract attributed events"],
  ["ground-events", "Verify event quotations"],
  ["compare-evidence", "Gemma: compare records"],
  ["ground-findings-and-persist", "Verify findings and save"],
];

type Stage = { id: string; status: "running" | "success" | "failed"; note?: string };

export function AnalyzePanel({
  caseId, hasAnalysis, stale, canRun, blocker, latestFailed, configured, modelId, usage,
}: {
  caseId: string; hasAnalysis: boolean; stale: boolean; canRun: boolean; blocker?: string;
  latestFailed?: { error?: string; stages: Stage[] }; configured: boolean; modelId: string; usage: { used: number; limit: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);

  const start = async (force: boolean) => {
    setRunning(true);
    setError(undefined);
    setElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      const res = await api<{ reused: boolean }>(`/api/cases/${caseId}/analysis`, { method: "POST", json: { force } });
      toast("ok", res.reused ? "Evidence unchanged — the saved analysis is current" : "Analysis complete. Review the findings below.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      router.refresh();
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  };

  const failedStages = latestFailed?.stages ?? [];
  const stageState = (id: string) => {
    const recs = failedStages.filter((s) => s.id === id);
    return recs.at(-1);
  };

  return (
    <section className="rounded-[var(--radius-obj)] border border-rule bg-raised p-5" aria-labelledby="an-h">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="an-h" className="font-serif text-xl">{hasAnalysis ? (stale ? "Evidence changed since the last analysis" : "Analysis is current") : "Analyse the evidence"}</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            Sends the extracted text of this case to <span className="font-mono text-[0.8125rem] text-ink">{modelId}</span> on Google’s Gemini API. Every finding it returns is checked against your files before it is shown.
          </p>
          <p className="mt-1 font-mono text-micro text-ink-2">{usage.used}/{usage.limit} analyses used today</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasAnalysis && !stale ? (
            <Button size="sm" variant="ghost" loading={running} disabled={!canRun} onClick={() => start(true)} icon={<RefreshCw className="size-3.5" aria-hidden />}>Re-run anyway</Button>
          ) : (
            <Button variant="accent" loading={running} disabled={!canRun || !configured} onClick={() => start(false)} icon={<Sparkles className="size-4" aria-hidden />}>
              {hasAnalysis ? "Re-analyse" : "Analyse evidence"}
            </Button>
          )}
        </div>
      </div>

      {!configured && <div className="mt-4"><Alert tone="warn" title="Gemma is not configured">Set <code>GEMMA_API_KEY</code> on the server to enable analysis. Your cases and evidence remain fully usable.</Alert></div>}
      {blocker && configured && <p className="mt-3 text-sm text-ink-2">{blocker}</p>}

      {running && (
        <div className="mt-5 border-t border-rule pt-4" role="status">
          <p className="flex items-center gap-2 text-sm text-ink"><Loader2 className="size-4 animate-spin" aria-hidden />Running the evidence workflow… {elapsed}s</p>
          <p className="mt-1 text-[0.8125rem] text-ink-2">This usually takes 20–90 seconds. Stage results appear when the server finishes — keep this tab open.</p>
        </div>
      )}

      {(error || (!running && latestFailed)) && (
        <div className="mt-5 space-y-3 border-t border-rule pt-4">
          <Alert tone="error" title="The last analysis did not complete" action={<Button size="sm" onClick={() => start(true)} disabled={running || !canRun}>Retry</Button>}>
            {error ?? latestFailed?.error} {hasAnalysis && "Your previous analysis is unchanged."}
          </Alert>
          {failedStages.length > 0 && (
            <ol className="grid gap-1 text-[0.8125rem] sm:grid-cols-2">
              {STAGES.map(([id, label], i) => {
                const st = stageState(id);
                return (
                  <li key={id} className="flex items-center gap-2 text-ink-2">
                    <span className="w-5 font-mono text-micro">{i + 1}</span>
                    {st?.status === "success" ? <Check className="size-3.5 text-ok" aria-label="done" /> : st?.status === "failed" ? <X className="size-3.5 text-err" aria-label="failed" /> : <span className="size-3.5 rounded-full border border-rule-strong" aria-label="not reached" />}
                    <span className={st?.status === "failed" ? "text-err" : ""}>{label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
