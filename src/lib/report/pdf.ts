import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { SourceRef } from "../types";
import type { ReportContent } from "./content";

const INK = "#242923";
const MUTED = "#62665F";
const RULE = "#DEDCD2";
const RUST = "#9C4530";
const BLUE = "#3F5A6C";

// Built-in PDF fonts are Latin-only; Hindi from voice-note transcripts needs a Devanagari font.
const DEVA_FONT = path.join(process.cwd(), "node_modules/@fontsource/noto-serif-devanagari/files/noto-serif-devanagari-devanagari-400-normal.woff");
const DEVA = /[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]/;

const STATUS_LABEL: Record<string, string> = {
  supported: "SUPPORTED BY RECORDS",
  conflicting: "CONFLICTING RECORDS",
  unverified: "UNVERIFIED — STATED, NOT INDEPENDENTLY RECORDED",
  missing: "MISSING INFORMATION",
};

/** Renders the saved, reviewed case into a PDF. Uses only built-in PDF fonts so it needs no font files at runtime. */
export function renderReportPdf(r: ReportContent, generatedAt = new Date()): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 64, left: 60, right: 60 }, bufferPages: true, info: { Title: `ParcelProof report — ${r.caseInfo[0]?.[1] ?? "Case"}`, Producer: "ParcelProof" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const W = doc.page.width - 120;
  const hasDeva = fs.existsSync(DEVA_FONT);
  if (hasDeva) doc.registerFont("Deva", DEVA_FONT);
  /** Writes text, switching to the Devanagari font for Hindi runs so mixed Hinglish renders correctly. */
  const rich = (t: string, font: string, size: number, color: string, x: number | undefined, y: number | undefined, opts: PDFKit.Mixins.TextOptions) => {
    if (!hasDeva || !DEVA.test(t)) {
      doc.font(font).fontSize(size).fillColor(color);
      return x === undefined ? doc.text(t, opts) : doc.text(t, x, y, opts);
    }
    const runs = t.match(/[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF\u200C\u200D]+(?:\s+[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF\u200C\u200D]+)*|[^\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]+/g) ?? [t];
    runs.forEach((run, i) => {
      doc.font(DEVA.test(run) ? "Deva" : font).fontSize(size).fillColor(color);
      const o = { ...opts, continued: i < runs.length - 1 };
      if (i === 0 && x !== undefined) doc.text(run, x, y, o);
      else doc.text(run, o);
    });
    return doc;
  };

  const ensure = (h: number) => { if (doc.y + h > doc.page.height - 72) doc.addPage(); };
  const h1 = (t: string) => { doc.font("Times-Bold").fontSize(22).fillColor(INK).text(t, { width: W }); doc.moveDown(0.3); };
  const h2 = (t: string) => {
    ensure(60);
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text(t.toUpperCase(), { characterSpacing: 1.2 });
    doc.moveTo(60, doc.y + 3).lineTo(60 + W, doc.y + 3).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.moveDown(0.6);
  };
  const body = (t: string, opts: PDFKit.Mixins.TextOptions = {}) => rich(t, "Times-Roman", 11, INK, undefined, undefined, { width: W, lineGap: 2.5, ...opts });
  const small = (t: string, color = MUTED) => doc.font("Helvetica").fontSize(8.5).fillColor(color).text(t, { width: W, lineGap: 1.5 });
  const quote = (ref: SourceRef) => {
    ensure(40);
    const x = doc.x;
    rich(`“${ref.quote.replace(/\s+/g, " ").slice(0, 400)}”`, "Times-Italic", 10, INK, x + 12, doc.y, { width: W - 12, lineGap: 1.5 });
    doc.font("Courier").fontSize(8).fillColor(BLUE).text(`${ref.sourceId} · page ${ref.page} · chars ${ref.start}–${ref.end}`, x + 12, doc.y, { width: W - 12 });
    doc.x = x;
    doc.moveDown(0.4);
  };

  // Cover
  doc.font("Courier").fontSize(8).fillColor(MUTED).text(`PARCELPROOF · EVIDENCE REPORT · ${generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC`);
  doc.moveDown(1.2);
  h1(r.caseInfo[0]?.[1] ?? "Case report");
  small(`Analysis v${r.analysis.version} · model ${r.analysis.modelId}${r.analysis.completedAt ? ` · analysed ${new Date(r.analysis.completedAt).toISOString().slice(0, 10)}` : ""}`);
  doc.moveDown(0.6);
  doc.rect(60, doc.y, W, 0.1).fill(RULE);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(RUST).text("AI-assisted. Seller review required.", { width: W });
  small("This report organises evidence the seller uploaded. Statuses describe what the records show; they are not legal findings and do not determine anyone's intent. Only findings the seller confirmed or corrected appear below.");
  if (r.pendingCount || r.excludedCount) small(`${r.pendingCount} finding(s) were not yet reviewed and ${r.excludedCount} were dismissed; none of them are included.`);

  h2("1 · Order information");
  for (const [k, v] of r.caseInfo.slice(1)) {
    ensure(16);
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, 60, y, { width: 140 });
    doc.font("Times-Roman").fontSize(11).fillColor(INK).text(v, 210, y, { width: W - 150 });
    doc.x = 60;
    doc.moveDown(0.25);
  }

  h2("2 · Summary");
  body(r.summary || "No summary available.");

  h2("3 · Timeline of recorded events");
  if (!r.events.length) body("No dated events were verified in the evidence.");
  for (const e of r.events) {
    ensure(50);
    const when = e.date ? `${e.date.replace("T", " ")}${e.dateCertainty !== "exact" ? ` (${e.dateCertainty})` : ""}` : "Date uncertain";
    doc.font("Courier").fontSize(8.5).fillColor(BLUE).text(when);
    body(`${e.description} — ${e.attributedTo}`);
    if (e.refs[0]) quote(e.refs[0]);
  }

  const findingSection = (title: string, list: ReportContent["supported"]) => {
    h2(title);
    if (!list.length) { body("None."); return; }
    for (const f of list) {
      ensure(70);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(f.status === "supported" ? BLUE : RUST).text(STATUS_LABEL[f.status], { characterSpacing: 0.8 });
      body(f.final, { continued: false });
      if (f.review === "corrected") small(`Seller-corrected. Original AI wording: ${f.statement}`);
      for (const ref of f.supporting) quote(ref);
      if (f.conflicting.length) { small("Conflicting record:", RUST); for (const ref of f.conflicting) quote(ref); }
      if (f.limitation) small(`Limitation: ${f.limitation}`);
      doc.moveDown(0.5);
    }
  };
  findingSection("4 · Findings supported by records", r.supported);
  findingSection("5 · Conflicting records", r.conflicting);
  findingSection("6 · Unverified statements", r.unverified);
  findingSection("7 · Missing information", r.missing);

  h2("8 · Evidence gaps");
  if (!r.gaps.length) body("No gaps were identified.");
  for (const g of r.gaps) {
    ensure(40);
    body(`${g.importance === "required" ? "[Required] " : "[Useful] "}${g.description}`);
    small(`${g.whyItMatters}${g.nextStep ? ` Next: ${g.nextStep}` : ""}`);
    doc.moveDown(0.3);
  }

  h2("9 · Seller corrections");
  if (!r.corrections.length) body("The seller did not correct any finding.");
  for (const f of r.corrections) { ensure(30); body(`Corrected: ${f.final}`); small(`Originally: ${f.statement}`); doc.moveDown(0.3); }

  h2("10 · Suggested next steps");
  if (!r.nextSteps.length) body("None suggested.");
  r.nextSteps.forEach((s, i) => { ensure(20); body(`${i + 1}. ${s}`); });

  h2("11 · Draft response (seller to edit before sending)");
  body(r.appealDraft);

  h2("12 · Source index");
  for (const s of r.sources) {
    ensure(30);
    doc.font("Courier").fontSize(9).fillColor(BLUE).text(`${s.sourceId}`, { continued: true }).font("Times-Roman").fontSize(10.5).fillColor(INK).text(`  ${s.filename}${s.label ? ` — ${s.label}` : ""}`);
    small(`${s.kind.toUpperCase()} · ${s.pages} page(s) · ${s.status}${s.corrected ? " · text corrected by seller" : ""} · SHA-256 ${s.sha256.slice(0, 16)}…`);
    doc.moveDown(0.3);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Courier").fontSize(7.5).fillColor(MUTED).text(`ParcelProof · AI-assisted, seller-reviewed · page ${i + 1} of ${range.count}`, 60, doc.page.height - 40, { width: W, align: "center" });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
