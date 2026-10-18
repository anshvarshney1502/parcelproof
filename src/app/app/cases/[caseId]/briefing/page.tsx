import { loadCase } from "@/lib/load-case";
import { previewBriefing } from "@/lib/repo/briefing";
import { usageToday } from "@/lib/repo/usage";
import { config, limits } from "@/lib/env";
import { plain } from "@/lib/format";
import { BriefingPanel } from "@/components/app/briefing-panel";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Briefing" };

export default async function BriefingPage({ params, searchParams }: PageProps<"/app/cases/[caseId]/briefing">) {
  const { caseId } = await params;
  const { language } = await searchParams;
  const { user } = await loadCase(caseId);
  const lang = language === "en" || language === "hinglish" ? language : undefined;
  const [p, usage] = await Promise.all([previewBriefing(user.id, caseId, lang), usageToday(user.id)]);
  if (!p.ready)
    return (
      <EmptyState mark="No briefing yet" title="A spoken summary of your reviewed case" action={<ButtonLink href={`/app/cases/${caseId}/review`} variant="primary" size="sm">Go to analysis</ButtonLink>}>
        <p>Once you analyse the evidence and review the findings, ParcelProof writes a short briefing — what is supported, what conflicts, what is missing — and can read it aloud in English or Hinglish.</p>
      </EmptyState>
    );
  return (
    <BriefingPanel
      caseId={caseId}
      language={p.language}
      text={p.text}
      scriptOrigin={p.scriptOrigin}
      scriptStale={p.scriptStale}
      gemmaConfigured={config.status().gemma}
      characters={p.characters}
      pending={p.pending}
      reviewed={p.reviewed}
      cached={p.cached ? plain(p.cached) : null}
      lastError={p.lastError}
      voiceConfigured={config.status().voice}
      usage={{ used: usage.tts, limit: limits.ttsDailyLimit }}
      stale={p.stale}
    />
  );
}
