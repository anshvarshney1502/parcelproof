import { loadCase } from "@/lib/load-case";
import { analysisState } from "@/lib/repo/analysis";
import { plain } from "@/lib/format";
import { Timeline } from "@/components/app/timeline";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Timeline" };

export default async function TimelinePage({ params }: PageProps<"/app/cases/[caseId]/timeline">) {
  const { caseId } = await params;
  const { user } = await loadCase(caseId);
  const { current, stale } = await analysisState(user.id, caseId);
  if (!current)
    return (
      <EmptyState mark="No timeline yet" title="The timeline is built from your evidence" action={<ButtonLink href={`/app/cases/${caseId}/review`} variant="primary" size="sm">Go to analysis</ButtonLink>}>
        <p>After an analysis, every dated event the evidence supports is placed here in order, each with its source quotation. Events without a reliable date are listed separately rather than guessed.</p>
      </EmptyState>
    );
  return (
    <div className="space-y-6">
      {stale && <Alert tone="warn" title="Built from an earlier version of the evidence">Re-analyse to update the timeline.</Alert>}
      {current.events.length === 0 ? <p className="text-ink-2">No events with verifiable quotations were found.</p> : <Timeline caseId={caseId} events={plain(current.events)} />}
    </div>
  );
}
