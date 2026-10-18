import { newId } from "../ids";
import type { ComparisonOutput, EvidenceStatus, ExtractionOutput, ModelRef } from "../schemas";
import type { CaseFinding, EvidenceEvent, EvidenceGap, PageText, SourceRef } from "../types";

export type Source = { sourceId: string; evidenceId: string; pages: PageText[]; kind?: string };
export type Rejection = { what: string; reason: string };

/**
 * Normalisation allowed when matching a quotation: whitespace runs collapse to one space and
 * typographic quotes/dashes map to ASCII. Nothing else — no case folding, no fuzzy matching.
 */
const CHAR_MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " " };

function normalizeWithMap(text: string) {
  let out = "";
  const map: number[] = [];
  let prevSpace = true;
  for (let i = 0; i < text.length; i++) {
    let ch = CHAR_MAP[text[i]] ?? text[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      ch = " ";
      prevSpace = true;
    } else prevSpace = false;
    out += ch;
    map.push(i);
  }
  if (out.endsWith(" ")) { out = out.slice(0, -1); map.pop(); }
  return { out, map };
}

export const normalize = (s: string) => normalizeWithMap(s).out;

export type RefResult = { ok: true; ref: SourceRef; warning?: string } | { ok: false; reason: string };

export function resolveRef(ref: ModelRef, sources: Map<string, Source>): RefResult {
  const src = sources.get(ref.sourceId);
  if (!src) return { ok: false, reason: `unknown source "${ref.sourceId}"` };
  const needle = normalize(ref.quote);
  if (needle.length < 8) return { ok: false, reason: "quotation too short to verify" };
  const order = [...src.pages].sort((a, b) => (a.page === ref.page ? -1 : b.page === ref.page ? 1 : a.page - b.page));
  for (const p of order) {
    const { out, map } = normalizeWithMap(p.text);
    const idx = out.indexOf(needle);
    if (idx === -1) continue;
    const start = map[idx];
    const end = map[idx + needle.length - 1] + 1;
    const resolved: SourceRef = { sourceId: src.sourceId, evidenceId: src.evidenceId, page: p.page, start, end, quote: p.text.slice(start, end) };
    const warning = ref.page && ref.page !== p.page ? `${src.sourceId}: quotation found on page ${p.page}, not page ${ref.page} as cited` : undefined;
    return { ok: true, ref: resolved, warning };
  }
  return { ok: false, reason: `quotation not found in ${src.sourceId}` };
}

function resolveAll(refs: ModelRef[], sources: Map<string, Source>, what: string, rejected: Rejection[], warnings: string[]) {
  const ok: SourceRef[] = [];
  for (const r of refs) {
    const res = resolveRef(r, sources);
    if (res.ok) {
      ok.push(res.ref);
      if (res.warning) warnings.push(res.warning);
    } else rejected.push({ what: `${what} — reference to ${r.sourceId}`, reason: res.reason });
  }
  return ok;
}

export function groundEvents(out: ExtractionOutput, sources: Map<string, Source>) {
  const rejected: Rejection[] = [];
  const warnings: string[] = [];
  const events: EvidenceEvent[] = [];
  for (const e of out.events) {
    const refs = resolveAll(e.refs, sources, `Event "${e.description.slice(0, 60)}"`, rejected, warnings);
    if (!refs.length) {
      rejected.push({ what: `Event "${e.description.slice(0, 80)}"`, reason: "no verifiable source quotation; omitted" });
      continue;
    }
    let certainty = e.date ? e.dateCertainty : "unknown";
    // A precise date must be traceable to text the model actually quoted.
    if (certainty === "exact" && !(e.originalDateText && refs.some((r) => normalize(r.quote).includes(normalize(e.originalDateText!))))) {
      certainty = "approximate";
      warnings.push(`Event "${e.description.slice(0, 60)}": date not found in the quotation; marked approximate`);
    }
    events.push({
      id: newId(),
      date: e.date ?? null,
      originalDateText: e.originalDateText ?? null,
      dateCertainty: certainty,
      description: e.description,
      type: e.type,
      attributedTo: e.attributedTo || "Unattributed",
      refs,
      review: "pending",
    });
  }
  return { events: sortEvents(events), rejected, warnings };
}

/** Dated events first in order; uncertain or undated events keep their extraction order at the end. */
export function sortEvents(events: EvidenceEvent[]) {
  const dated = events.filter((e) => e.date && e.dateCertainty !== "unknown").sort((a, b) => a.date!.localeCompare(b.date!));
  return [...dated, ...events.filter((e) => !(e.date && e.dateCertainty !== "unknown"))];
}

const ACCUSATORY = /\b(fraud|fraudulent|scam(mer)?|lying|liar|lied|criminal|thief|stole)\b/i;

export function groundFindings(out: ComparisonOutput, sources: Map<string, Source>) {
  const rejected: Rejection[] = [];
  const warnings: string[] = [];
  const findings: CaseFinding[] = out.findings.map((f) => {
    const label = `Finding "${f.statement.slice(0, 60)}"`;
    const supporting = resolveAll(f.supporting, sources, label, rejected, warnings);
    const conflicting = resolveAll(f.conflicting, sources, label, rejected, warnings);
    const notes: string[] = [];
    let status: EvidenceStatus = f.status;
    if (status === "supported" && !supporting.length) {
      status = "unverified";
      notes.push("Marked supported by the model, but no cited quotation could be verified in the evidence.");
    }
    if (status === "conflicting" && (!supporting.length || !conflicting.length)) {
      status = "unverified";
      notes.push("Marked conflicting, but both sides of the conflict could not be verified in the evidence.");
    }
    if (ACCUSATORY.test(f.statement)) {
      status = status === "missing" ? status : "unverified";
      notes.push("The statement uses accusatory language. ParcelProof does not determine intent or fraud — rewrite before relying on it.");
    }
    return {
      id: newId(),
      statement: f.statement,
      category: f.category,
      status,
      modelStatus: f.status,
      supporting,
      conflicting,
      limitation: f.limitation,
      nextAction: f.nextAction,
      validationNotes: notes,
      review: "pending",
    };
  });
  const gaps: EvidenceGap[] = out.gaps.map((g) => ({
    id: newId(),
    ...g,
    relatedFindingIds: findings.filter((f) => f.status === "missing" && f.category && g.description.toLowerCase().includes(f.category)).map((f) => f.id),
  }));
  const contradictions = findings.filter((f) => f.status === "conflicting").map((f) => f.statement);
  return { findings, gaps, contradictions, rejected, warnings };
}
