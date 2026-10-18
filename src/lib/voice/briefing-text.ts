import { CATEGORIES } from "../schemas";
import type { AnalysisDoc, CaseDoc, CaseFinding } from "../types";

export const finalStatement = (f: CaseFinding) => (f.review === "corrected" && f.correction ? f.correction : f.statement);
export const reviewedFindings = (a: AnalysisDoc) => a.findings.filter((f) => f.review === "confirmed" || f.review === "corrected");

const MAX_PER_GROUP = 3;
const clip = (s: string) => s.replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");

/**
 * Builds the spoken briefing from seller-reviewed findings only. Dismissed and unreviewed findings
 * are never read aloud, and each status keeps its hedging so uncertainty is not narrated as fact.
 */
export function buildBriefingText(kase: CaseDoc, a: AnalysisDoc, language: "en" | "hinglish"): string {
  const reviewed = reviewedFindings(a);
  const by = (s: CaseFinding["status"]) => reviewed.filter((f) => f.status === s).slice(0, MAX_PER_GROUP).map((f) => clip(finalStatement(f)));
  const supported = by("supported");
  const conflicting = by("conflicting");
  const unverified = by("unverified");
  const missing = [...by("missing"), ...a.gaps.filter((g) => g.importance === "required").map((g) => clip(g.description))].slice(0, MAX_PER_GROUP);
  const next = reviewed.find((f) => f.nextAction)?.nextAction ?? a.gaps.find((g) => g.nextStep)?.nextStep;
  const dispute = CATEGORIES[kase.category].toLowerCase();
  const order = kase.orderRef ? ` for order ${kase.orderRef}` : "";
  const list = (xs: string[]) => xs.map((x) => `${x}.`).join(" ");

  if (language === "hinglish") {
    return [
      `Namaste. Yeh aapke case "${clip(kase.title)}" ki short briefing hai${order}. Dispute ka type hai: ${dispute}.`,
      supported.length ? `Records se yeh baatein support hoti hain: ${list(supported)}` : "Abhi tak koi finding records se clearly support nahi hui hai.",
      conflicting.length ? `Kuch records aapas mein match nahi karte: ${list(conflicting)}` : "",
      unverified.length ? `Yeh baatein kahi gayi hain, lekin kisi independent record se verify nahi hui: ${list(unverified)}` : "",
      missing.length ? `Sabse important missing information: ${list(missing)}` : "",
      next ? `Agla step, dhyan se: ${clip(next)}.` : "",
      "Yaad rakhiye, yeh AI-assisted review hai, legal decision nahi. Final report bhejne se pehle har point khud check kar lijiye.",
    ].filter(Boolean).join(" ");
  }
  return [
    `Here is a short briefing on your case, "${clip(kase.title)}"${order}. The dispute is about: ${dispute}.`,
    supported.length ? `The records support the following. ${list(supported)}` : "So far, no finding is directly supported by the records.",
    conflicting.length ? `Some records disagree. ${list(conflicting)}` : "",
    unverified.length ? `These points were stated, but no independent record confirms them yet. ${list(unverified)}` : "",
    missing.length ? `The most important missing information: ${list(missing)}` : "",
    next ? `A cautious next step: ${clip(next)}.` : "",
    "Remember, this is an AI-assisted evidence review, not a legal decision. Check each point before you send anything.",
  ].filter(Boolean).join(" ");
}
