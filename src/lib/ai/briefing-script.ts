import { z } from "zod";
import { sha256 } from "../ids";
import { CATEGORIES } from "../schemas";
import type { AnalysisDoc, CaseDoc } from "../types";
import { finalStatement, reviewedFindings } from "../voice/briefing-text";
import type { ModelClient } from "./gemma";
import { callStructured } from "./workflow";

/** Everything the script may draw on. If this changes, a saved script is stale. */
export function scriptBasis(kase: CaseDoc, a: AnalysisDoc) {
  const lines = [
    `Case title: ${kase.title}`,
    kase.orderRef ? `Order reference: ${kase.orderRef}` : "",
    `Dispute type: ${CATEGORIES[kase.category]}`,
    ...reviewedFindings(a).map((f) => `[${f.status}] ${finalStatement(f)}${f.nextAction ? ` (next step: ${f.nextAction})` : ""}`),
    ...a.gaps.filter((g) => g.importance === "required").map((g) => `[missing, required] ${g.description}`),
  ].filter(Boolean);
  return { text: lines.join("\n"), hash: sha256(lines.join("\n") + a._id) };
}

const out = z.object({ script: z.string().min(80).max(1600) });

const STYLE = {
  en: "Write in plain, calm, natural spoken English, as if a careful colleague were briefing the seller.",
  hinglish:
    "Write in natural spoken Hinglish: conversational Hindi-English mix in Roman script, the way a Delhi or Mumbai small-business owner talks. Translate the statements into Hinglish; keep product names, order references and courier terms in English.",
};

/**
 * Asks Gemma to turn reviewed findings into a 30–60 second spoken script, then verifies it:
 * every number in the script must appear in the reviewed material, and accusatory language is refused.
 */
export async function writeBriefingScript(model: ModelClient, kase: CaseDoc, a: AnalysisDoc, language: "en" | "hinglish") {
  const basis = scriptBasis(kase, a);
  const prompt = `You write short spoken case briefings for ParcelProof, a tool that helps an online seller review evidence for a parcel dispute.

Rules:
- Use ONLY the reviewed statements below. Do not add facts, dates, amounts, names or events that are not in them.
- Keep each status honest: "supported" = the records show it; "conflicting" = records disagree; "unverified" = someone said it, no record confirms it; "missing" = not in the evidence. Never present an unverified or conflicting point as fact.
- Do not accuse anyone of fraud or lying, and do not give legal advice.
- Structure: what the dispute is about, what the records support, what conflicts or is only claimed, the most important missing evidence, then one cautious next step. End by reminding the seller to check before sending anything.
- 90 to 150 words. Short sentences that sound natural when spoken. No lists, headings, markdown or emojis.
- ${STYLE[language]}

<reviewed>
${basis.text}
</reviewed>

Respond with only this JSON: {"script":"..."}`;

  const { script } = await callStructured(model, prompt, out);
  const clean = script.replace(/\s+/g, " ").trim();
  const allowed = new Set(basis.text.match(/\d+(?:[.,]\d+)*/g) ?? []);
  const invented = (clean.match(/\d+(?:[.,]\d+)*/g) ?? []).filter((n) => !allowed.has(n));
  if (invented.length) throw new ScriptRejected(`The draft mentioned numbers that are not in your reviewed findings (${[...new Set(invented)].join(", ")}).`);
  if (/\b(fraud|fraudulent|scam|liar|lying|dhokha|jhooth)\b/i.test(clean)) throw new ScriptRejected("The draft used accusatory language.");
  return { text: clean, basisHash: basis.hash };
}

export class ScriptRejected extends Error {}
