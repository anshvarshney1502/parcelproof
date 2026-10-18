import { CATEGORIES } from "../schemas";
import type { AnalysisDoc, CaseDoc, EvidenceDoc } from "../types";
import { finalStatement, reviewedFindings } from "../voice/briefing-text";

/** The exact data a report contains — shared by the on-screen preview and the PDF so they cannot drift. */
export function reportContent(kase: CaseDoc, a: AnalysisDoc, evidence: EvidenceDoc[]) {
  const reviewed = reviewedFindings(a).map((f) => ({ ...f, final: finalStatement(f) }));
  const group = (s: string) => reviewed.filter((f) => f.status === s);
  const events = a.events.filter((e) => e.review !== "dismissed");
  return {
    caseInfo: [
      ["Case", kase.title],
      ["Dispute type", CATEGORIES[kase.category]],
      ["Order reference", kase.orderRef],
      ["Order value", kase.orderValue !== undefined ? `${kase.orderValue.toLocaleString("en-IN")} ${kase.currency}` : undefined],
      ["Sales channel", kase.channel],
      ["Customer reference", kase.customerRef],
      ["Order date", kase.orderDate],
      ["Dispatch date", kase.dispatchDate],
      ["Expected delivery", kase.expectedDeliveryDate],
      ["Dispute opened", kase.disputeDate],
      ["Response deadline", kase.deadline],
    ].filter((r): r is [string, string] => Boolean(r[1])),
    summary: a.summary,
    events,
    supported: group("supported"),
    conflicting: group("conflicting"),
    unverified: group("unverified"),
    missing: group("missing"),
    corrections: reviewed.filter((f) => f.review === "corrected"),
    gaps: a.gaps,
    nextSteps: [...new Set([...reviewed.map((f) => f.nextAction), ...a.gaps.filter((g) => g.importance === "required").map((g) => g.nextStep)].filter(Boolean))].slice(0, 8),
    pendingCount: a.findings.filter((f) => f.review === "pending").length,
    excludedCount: a.findings.filter((f) => f.review === "dismissed").length,
    sources: evidence.map((e) => ({ sourceId: e.sourceId, filename: e.filename, kind: e.kind, pages: e.pageCount ?? e.pages.length, status: e.status, sha256: e.sha256, corrected: Boolean(e.correctedAt), label: e.label })),
    appealDraft: kase.appealDraft?.trim() || defaultAppeal(kase, a),
    analysis: { version: a.version, modelId: a.modelId, completedAt: a.completedAt },
  };
}
export type ReportContent = ReturnType<typeof reportContent>;

export function defaultAppeal(kase: CaseDoc, a: AnalysisDoc) {
  const reviewed = reviewedFindings(a);
  const sup = reviewed.filter((f) => f.status === "supported");
  const lines = [
    "Hello,",
    "",
    `I am writing about ${kase.orderRef ? `order ${kase.orderRef}` : "this order"}, which is the subject of a dispute (${CATEGORIES[kase.category].toLowerCase()}).`,
    "",
    sup.length ? "Our records show the following:" : "I would like to share the records I have for this order.",
    ...sup.slice(0, 5).map((f) => `- ${finalStatement(f)} (source ${f.supporting.map((r) => r.sourceId).join(", ")})`),
    "",
    "I have attached the referenced documents. I would be grateful if you could review them and let me know if any further information would help.",
    "",
    "Thank you,",
    "[Your name]",
  ];
  return lines.join("\n");
}
