import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { collections } from "@/lib/db";
import { createCase, deleteCase, getOwnedCase, listCases, setCaseState, updateCase } from "@/lib/repo/cases";
import { deleteEvidence, getOwnedEvidence, uploadEvidence, correctText } from "@/lib/repo/evidence";
import { analysisState, currentAnalysis, reviewFinding, startAnalysis } from "@/lib/repo/analysis";
import { deleteBriefing, generateBriefing, previewBriefing, saveSettings } from "@/lib/repo/briefing";
import { deleteAccountData } from "@/lib/repo/account";
import { ModelError } from "@/lib/ai/gemma";
import { VoiceError } from "@/lib/voice/tts";
import { reportContent } from "@/lib/report/content";
import { renderReportPdf } from "@/lib/report/pdf";
import { HttpError } from "@/lib/http";
import { confirmAllSupported } from "@/lib/repo/analysis";
import { draftScript } from "@/lib/repo/briefing";
import type { Transcriber } from "@/lib/voice/stt";
import { CUSTOMER_MSG, TRACKING_TXT, enc, fakeModel, fakeTts, resetDb, startDb, stopDb } from "./helpers";

const ALICE = "aaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "bbbbbbbbbbbbbbbbbbbbbbbb";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

const newCase = (owner = ALICE) => createCase(owner, { title: "Empty box complaint", category: "missing_contents", currency: "INR", orderRef: "ORD-7781" });
const status = async (p: Promise<unknown>) => p.then(() => 200, (e) => (e instanceof HttpError ? e.status : -1));

const EXTRACTION = JSON.stringify({
  events: [
    { description: "Courier records delivery", type: "delivery", attributedTo: "Courier tracking", date: "2026-09-13T18:40", originalDateText: "2026-09-13 18:40", dateCertainty: "exact", refs: [{ sourceId: "S1", page: 1, quote: "2026-09-13 18:40 Delivered - signed by R. Kumar" }] },
    { description: "Customer reports empty box", type: "complaint", attributedTo: "Customer (message)", date: "2026-09-14", originalDateText: "2026-09-14", dateCertainty: "exact", refs: [{ sourceId: "S2", page: 1, quote: "the box was empty when I opened it" }] },
  ],
});
const COMPARISON = JSON.stringify({
  summary: "Courier records a signed delivery. The customer reports the box was empty. No record shows the contents at delivery.",
  findings: [
    { statement: "The courier recorded a signed delivery on 13 September.", category: "delivery", status: "supported", supporting: [{ sourceId: "S1", page: 1, quote: "Delivered - signed by R. Kumar" }], conflicting: [], limitation: "Does not show the contents.", nextAction: "Request proof-of-delivery from the courier." },
    { statement: "The customer reported the box was empty.", category: "contents", status: "unverified", supporting: [{ sourceId: "S2", page: 1, quote: "the box was empty when I opened it" }], conflicting: [], limitation: "A report, not a record of contents.", nextAction: "Ask for photos of the opened box." },
    { statement: "A warehouse scan shows the item packed.", category: "contents", status: "supported", supporting: [{ sourceId: "S1", quote: "Warehouse scan: item packed" }], conflicting: [], limitation: "", nextAction: "" },
  ],
  gaps: [{ description: "No packing photo or weight at packing", whyItMatters: "Would show the contents before dispatch.", importance: "required", nextStep: "Add packing photos." }],
});

async function caseWithEvidence(owner = ALICE) {
  const c = await newCase(owner);
  await uploadEvidence(owner, c._id, "tracking.txt", enc(TRACKING_TXT));
  await uploadEvidence(owner, c._id, "message.txt", enc(CUSTOMER_MSG));
  return c;
}

describe("authorization", () => {
  it("lets a user read and list their own case only", async () => {
    const c = await newCase();
    expect((await getOwnedCase(ALICE, c._id)).title).toBe("Empty box complaint");
    expect(await status(getOwnedCase(BOB, c._id))).toBe(404);
    expect(await listCases(BOB, { view: "all", sort: "updated" })).toHaveLength(0);
  });
  it("blocks cross-user update, state change and deletion", async () => {
    const c = await newCase();
    expect(await status(updateCase(BOB, c._id, { title: "hijacked" }))).toBe(404);
    expect(await status(setCaseState(BOB, c._id, "archive"))).toBe(404);
    expect(await status(deleteCase(BOB, c._id))).toBe(404);
    expect((await getOwnedCase(ALICE, c._id)).title).toBe("Empty box complaint");
  });
  it("blocks access to another user's evidence and uploads into their case", async () => {
    const c = await caseWithEvidence();
    const { evidence } = await collections();
    const ev = (await evidence.findOne({ caseId: c._id }))!;
    expect(await status(getOwnedEvidence(BOB, ev._id))).toBe(404);
    expect(await status(deleteEvidence(BOB, ev._id))).toBe(404);
    expect(await status(uploadEvidence(BOB, c._id, "x.txt", enc("intrusion attempt")))).toBe(404);
  });
});

describe("case management", () => {
  it("archives, restores, resolves and filters", async () => {
    const a = await newCase();
    const b = await newCase();
    await setCaseState(ALICE, a._id, "archive");
    await setCaseState(ALICE, b._id, "resolve");
    expect((await listCases(ALICE, { view: "archived", sort: "updated" })).map((c) => c._id)).toEqual([a._id]);
    expect((await listCases(ALICE, { view: "resolved", sort: "updated" })).map((c) => c._id)).toEqual([b._id]);
    expect(await listCases(ALICE, { view: "active", sort: "updated" })).toHaveLength(0);
    await setCaseState(ALICE, a._id, "restore");
    expect(await listCases(ALICE, { view: "active", sort: "updated", q: "empty" })).toHaveLength(1);
  });
});

describe("file processing", () => {
  it("accepts text, CSV and PDF and extracts with page numbers", async () => {
    const c = await newCase();
    const csv = await uploadEvidence(ALICE, c._id, "orders.csv", enc("order,status\nORD-7781,=HYPERLINK(\"x\")"));
    expect(csv.status).toBe("extracted");
    expect(csv.pages[0].text).toContain("status: '=HYPERLINK");
    const pdf = await uploadEvidence(ALICE, c._id, "invoice.pdf", await makePdf(["Invoice ORD-7781 total 1499 INR", "Page two: packed by Asha"]));
    expect(pdf.status).toBe("extracted");
    expect(pdf.pages.map((p) => p.page)).toEqual([1, 2]);
    expect(pdf.pages[1].text).toContain("packed by Asha");
  });
  it("rejects unsupported and disguised formats", async () => {
    const c = await newCase();
    expect(await status(uploadEvidence(ALICE, c._id, "run.exe", new Uint8Array([0x4d, 0x5a, 0, 0])))).toBe(415);
    expect(await status(uploadEvidence(ALICE, c._id, "photo.png", enc("%PDF-1.4 fake")))).toBe(415);
    expect(await status(uploadEvidence(ALICE, c._id, "notes.txt", new Uint8Array([0x68, 0, 0x69])))).toBe(415);
  });
  it("rejects uploads that are too large", async () => {
    const c = await newCase();
    process.env.MAX_UPLOAD_MB = "1";
    try {
      expect(await status(uploadEvidence(ALICE, c._id, "big.txt", new Uint8Array(1024 * 1024 + 1).fill(97)))).toBe(413);
    } finally {
      delete process.env.MAX_UPLOAD_MB;
    }
  });
  it("detects duplicate uploads by SHA-256", async () => {
    const c = await newCase();
    await uploadEvidence(ALICE, c._id, "a.txt", enc(TRACKING_TXT));
    expect(await status(uploadEvidence(ALICE, c._id, "copy.txt", enc(TRACKING_TXT)))).toBe(409);
  });
  it("reports a failed PDF extraction instead of storing invented text", async () => {
    const c = await newCase();
    const ev = await uploadEvidence(ALICE, c._id, "broken.pdf", enc("%PDF-1.7\nthis is not really a pdf"));
    expect(ev.status).toBe("failed");
    expect(ev.error).toMatch(/could not be opened|No readable text/);
    expect(ev.pages).toEqual([]);
  });
  it("reports OCR failure for an image with no text", async () => {
    const { createCanvas } = await import("@napi-rs/canvas");
    const canvas = createCanvas(200, 120);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 200, 120);
    const c = await newCase();
    const ev = await uploadEvidence(ALICE, c._id, "blank.png", canvas.toBuffer("image/png"));
    expect(ev.status).toBe("failed");
    expect(ev.error).toMatch(/No readable text|Text recognition/);
  }, 120_000);
  it("cleans up GridFS files and derived records when a case is deleted", async () => {
    const c = await caseWithEvidence();
    const { files, evidence, analyses } = await collections();
    await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
    expect(await files.find({}).toArray()).toHaveLength(2);
    await deleteCase(ALICE, c._id);
    expect(await files.find({}).toArray()).toHaveLength(0);
    expect(await evidence.countDocuments({ caseId: c._id })).toBe(0);
    expect(await analyses.countDocuments({ caseId: c._id })).toBe(0);
  });
});

describe("analysis workflow", () => {
  it("runs both Gemma stages, grounds references and rejects unsupported evidence", async () => {
    const c = await caseWithEvidence();
    const model = fakeModel([EXTRACTION, COMPARISON]);
    const res = await startAnalysis(ALICE, c._id, { model });
    expect(res.reused).toBe(false);
    expect(model.calls).toHaveLength(2);
    expect(model.calls[0]).toContain('<evidence source="S1" page="1">');
    const a = (await currentAnalysis(ALICE, c._id))!;
    expect(a.status).toBe("succeeded");
    expect(a.stages.filter((s) => s.status === "success").map((s) => s.id)).toEqual([
      "verify-case", "load-evidence", "build-chunks", "extract-events", "ground-events", "compare-evidence", "ground-findings-and-persist",
    ]);
    expect(a.events).toHaveLength(2);
    expect(a.findings[0].supporting[0].evidenceId).toBeTruthy();
    expect(a.findings[2].status).toBe("unverified");
    expect(a.validation.rejected.some((r) => r.reason.includes("quotation not found"))).toBe(true);
    expect((await getOwnedCase(ALICE, c._id)).pendingReview).toBe(3);
  });

  it("reuses an unchanged analysis and marks it stale when evidence changes", async () => {
    const c = await caseWithEvidence();
    await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
    const again = fakeModel([]);
    expect((await startAnalysis(ALICE, c._id, { model: again })).reused).toBe(true);
    expect(again.calls).toHaveLength(0);
    await uploadEvidence(ALICE, c._id, "extra.txt", enc("Packing note: item sealed in box at 09:00"));
    expect((await analysisState(ALICE, c._id)).stale).toBe(true);
  });

  it("retries once on malformed output, then fails without replacing the prior analysis", async () => {
    const c = await caseWithEvidence();
    await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
    const prior = (await currentAnalysis(ALICE, c._id))!;
    await correctText(ALICE, (await getEv(c._id, "S2"))._id, [{ page: 1, text: CUSTOMER_MSG + "\nPhotos attached." }]);
    const bad = fakeModel(["not json at all", '{"events": "wrong"}']);
    expect(await status(startAnalysis(ALICE, c._id, { model: bad }))).toBe(502);
    expect(bad.calls).toHaveLength(2);
    expect((await currentAnalysis(ALICE, c._id))!._id).toBe(prior._id);
  });

  it("surfaces timeouts and rate limits as real failures", async () => {
    const c = await caseWithEvidence();
    const timeout = new ModelError("The Gemma request timed out.", "timeout", true);
    const err = await startAnalysis(ALICE, c._id, { model: fakeModel([timeout, timeout]) }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.message).toMatch(/timed out/);
    const limited = new ModelError("The Gemma API rate limit or free quota was reached. Try again later.", "rate_limit", true);
    const err2 = await startAnalysis(ALICE, c._id, { model: fakeModel([limited, limited]) }).catch((e) => e);
    expect(err2.message).toMatch(/rate limit/);
    expect(await currentAnalysis(ALICE, c._id)).toBeNull();
  }, 30_000);

  it("enforces the daily AI limit", async () => {
    process.env.AI_DAILY_LIMIT = "1";
    try {
      const c = await caseWithEvidence();
      await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
      expect(await status(startAnalysis(ALICE, c._id, { force: true, model: fakeModel([EXTRACTION, COMPARISON]) }))).toBe(429);
    } finally {
      delete process.env.AI_DAILY_LIMIT;
    }
  });
});

async function getEv(caseId: string, sourceId: string) {
  const { evidence } = await collections();
  return (await evidence.findOne({ caseId, sourceId }))!;
}

async function reviewedCase() {
  const c = await caseWithEvidence();
  await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
  const a = (await currentAnalysis(ALICE, c._id))!;
  await reviewFinding(ALICE, c._id, { findingId: a.findings[0].id, decision: "confirmed" });
  await reviewFinding(ALICE, c._id, { findingId: a.findings[1].id, decision: "corrected", correction: "The customer says the box was empty; no photo was provided." });
  await reviewFinding(ALICE, c._id, { findingId: a.findings[2].id, decision: "dismissed" });
  return c;
}

describe("voice briefing", () => {
  it("builds the briefing from reviewed findings only, with hedging", async () => {
    const c = await reviewedCase();
    const p = await previewBriefing(ALICE, c._id, "en");
    if (!p.ready) throw new Error("not ready");
    expect(p.text).toContain("signed delivery");
    expect(p.text).toContain("no photo was provided");
    expect(p.text).not.toContain("warehouse scan");
    expect(p.text).toMatch(/no independent record confirms/);
    const h = await previewBriefing(ALICE, c._id, "hinglish");
    expect(h.ready && h.text).toMatch(/verify nahi hui/);
  });

  it("requires every finding to be reviewed", async () => {
    const c = await caseWithEvidence();
    await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
    expect(await status(generateBriefing(ALICE, c._id, "en", fakeTts()))).toBe(409);
  });

  it("reuses cached audio and regenerates when text or voice settings change", async () => {
    const c = await reviewedCase();
    const tts = fakeTts();
    const first = await generateBriefing(ALICE, c._id, "en", tts);
    expect(first.reused).toBe(false);
    const second = await generateBriefing(ALICE, c._id, "en", tts);
    expect(second.reused).toBe(true);
    expect(tts.calls).toBe(1);
    await generateBriefing(ALICE, c._id, "hinglish", tts);
    expect(tts.calls).toBe(2);
    await saveSettings(ALICE, { language: "en", voiceStyle: "balanced" });
    await generateBriefing(ALICE, c._id, "en", tts);
    expect(tts.calls).toBe(3);
  });

  it("keeps the text and refunds quota when the provider fails", async () => {
    const c = await reviewedCase();
    const err = await generateBriefing(ALICE, c._id, "en", fakeTts(new VoiceError("ElevenLabs credits or rate limit are exhausted for this account. The text briefing is still available.", 429))).catch((e) => e);
    expect(err.status).toBe(429);
    const { usage, audio } = await collections();
    expect((await usage.findOne({ ownerId: ALICE, kind: "tts" }))?.count).toBe(0);
    expect(await audio.find({}).toArray()).toHaveLength(0);
    const p = await previewBriefing(ALICE, c._id, "en");
    expect(p.ready && p.lastError).toMatch(/exhausted/);
  });

  it("reports missing voice credentials without fabricating audio", async () => {
    const c = await reviewedCase();
    delete process.env.ELEVENLABS_API_KEY;
    const err = await generateBriefing(ALICE, c._id, "en").catch((e) => e);
    expect(err.status).toBe(503);
    expect(err.message).toMatch(/ELEVENLABS_API_KEY/);
  });

  it("enforces the daily TTS limit", async () => {
    process.env.TTS_DAILY_LIMIT = "1";
    try {
      const c = await reviewedCase();
      await generateBriefing(ALICE, c._id, "en", fakeTts());
      expect(await status(generateBriefing(ALICE, c._id, "hinglish", fakeTts()))).toBe(429);
    } finally {
      delete process.env.TTS_DAILY_LIMIT;
    }
  });

  it("does not let another user delete audio", async () => {
    const c = await reviewedCase();
    const { briefing } = await generateBriefing(ALICE, c._id, "en", fakeTts());
    expect(await status(deleteBriefing(BOB, briefing.id))).toBe(404);
    await deleteBriefing(ALICE, briefing.id);
  });
});

describe("report", () => {
  it("renders a PDF from saved reviewed data with real source references", async () => {
    const c = await reviewedCase();
    const { kase, current, evidence } = await analysisState(ALICE, c._id);
    const content = reportContent(kase, current!, evidence);
    expect(content.supported.map((f) => f.final)).toEqual(["The courier recorded a signed delivery on 13 September."]);
    expect(content.unverified.map((f) => f.final)).toEqual(["The customer says the box was empty; no photo was provided."]);
    expect([...content.supported, ...content.unverified, ...content.conflicting].some((f) => f.statement.includes("warehouse scan"))).toBe(false);
    expect(content.supported[0].supporting[0].sourceId).toBe("S1");
    const pdf = await renderReportPdf(content);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });
});

describe("account deletion", () => {
  it("removes every record the user owns and nothing else", async () => {
    await reviewedCase();
    const bobCase = await caseWithEvidence(BOB);
    await deleteAccountData(ALICE);
    const c = await collections();
    for (const col of [c.cases, c.evidence, c.analyses, c.briefings, c.usage, c.audit]) expect(await col.countDocuments({ ownerId: ALICE })).toBe(0);
    expect(await c.files.find({ "metadata.ownerId": ALICE }).toArray()).toHaveLength(0);
    expect((await getOwnedCase(BOB, bobCase._id))._id).toBe(bobCase._id);
  });
});

function makePdf(pages: string[]): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    for (const p of pages) doc.addPage().fontSize(14).text(p);
    doc.end();
  });
}

describe("ElevenLabs voice features", () => {
  const voiceNote = new Uint8Array([...new TextEncoder().encode("OggS"), 0, 2, 0, 0, 1, 2, 3, 4]);
  const scribe = (text: string, fail?: Error): Transcriber & { calls: number } => {
    const t = { calls: 0, async transcribe() { t.calls++; if (fail) throw fail; return { text, languageCode: "hin", durationSec: 14, speakers: 2 }; } };
    return t;
  };

  it("transcribes a voice note into quotable evidence", async () => {
    const c = await newCase();
    const ev = await uploadEvidence(ALICE, c._id, "whatsapp.opus", voiceNote, { transcriber: scribe("[00:03] Speaker 1: Box khaali tha, sirf packing thi.") });
    expect(ev.status).toBe("extracted");
    expect(ev.method).toBe("speech");
    expect(ev.audio).toEqual({ languageCode: "hin", durationSec: 14, speakers: 2 });
    expect(ev.pages[0].text).toContain("Box khaali tha");
  });

  it("marks a failed transcription honestly and refunds the quota", async () => {
    const c = await newCase();
    const ev = await uploadEvidence(ALICE, c._id, "call.ogg", voiceNote, { transcriber: scribe("", new VoiceError("ElevenLabs credits or rate limit are exhausted for this account. The text briefing is still available.", 429)) });
    expect(ev.status).toBe("failed");
    expect(ev.pages).toEqual([]);
    const { usage } = await collections();
    expect((await usage.findOne({ ownerId: ALICE, kind: "stt" }))?.count).toBe(0);
  });

  it("confirms only clean supported findings in bulk", async () => {
    const c = await caseWithEvidence();
    await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
    expect(await confirmAllSupported(ALICE, c._id)).toBe(1);
    const a = (await currentAnalysis(ALICE, c._id))!;
    expect(a.findings.map((f) => f.review)).toEqual(["confirmed", "pending", "pending"]);
  });

  it("uses a Gemma-written script and rejects one with invented numbers", async () => {
    const c = await reviewedCase();
    const good = "Your case is about missing contents. The courier recorded the parcel as delivered and signed for on 13 September. The customer says the box was empty, but no photo has been provided yet, so that stays unverified. Ask for photos before you reply, and check everything before sending.";
    await draftScript(ALICE, c._id, "en", fakeModel([JSON.stringify({ script: good })]));
    const p = await previewBriefing(ALICE, c._id, "en");
    expect(p.ready && p.scriptOrigin).toBe("gemma");
    expect(p.ready && p.text).toBe(good);
    const invented = good.replace("13 September", "13 September at 4 pm, 2 boxes");
    const err = await draftScript(ALICE, c._id, "en", fakeModel([JSON.stringify({ script: invented })])).catch((e) => e);
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/4, 2/);
    const tts = fakeTts();
    const b = await generateBriefing(ALICE, c._id, "en", tts);
    expect(b.briefing.alignment?.starts).toEqual([0, 0.1]);
  });
});

describe("review fixes", () => {
  it("survives concurrent first-of-day quota calls", async () => {
    const { consume } = await import("@/lib/repo/usage");
    await Promise.all(Array.from({ length: 6 }, () => consume(ALICE, "stt", 10)));
    const { usage } = await collections();
    expect((await usage.findOne({ ownerId: ALICE, kind: "stt" }))?.count).toBe(6);
  });

  it("marks evidence stuck in processing as failed so analysis is not blocked forever", async () => {
    const c = await caseWithEvidence();
    const { evidence } = await collections();
    await evidence.updateOne({ caseId: c._id, sourceId: "S1" }, { $set: { status: "processing", processingAt: new Date(Date.now() - 11 * 60 * 1000) } });
    await startAnalysis(ALICE, c._id, { model: fakeModel([EXTRACTION, COMPARISON]) });
    const s1 = await evidence.findOne({ caseId: c._id, sourceId: "S1" });
    expect(s1?.status).toBe("failed");
    expect(s1?.error).toMatch(/interrupted/);
  });

  it("sorts by deadline with dated cases first and keeps undated ones", async () => {
    const mk = (title: string, deadline?: string) => createCase(ALICE, { title, category: "other", currency: "INR", ...(deadline ? { deadline } : {}) });
    await mk("no deadline A");
    await mk("late", "2026-12-01");
    await mk("soon", "2026-10-20");
    await mk("no deadline B");
    const rows = await listCases(ALICE, { view: "all", sort: "deadline" });
    expect(rows.map((r) => r.title).slice(0, 2)).toEqual(["soon", "late"]);
    expect(rows).toHaveLength(4);
  });

  it("refunds the upload quota and leaves no file when storage fails", async () => {
    const c = await newCase();
    const cols = await collections();
    const { GridFSBucket } = await import("mongodb");
    const { Writable } = await import("node:stream");
    const proto = GridFSBucket.prototype as unknown as { openUploadStreamWithId: unknown };
    const original = proto.openUploadStreamWithId;
    proto.openUploadStreamWithId = () => new Writable({ write(_c, _e, cb) { cb(new Error("connection dropped")); } });
    try {
      await expect(uploadEvidence(ALICE, c._id, "a.txt", enc(TRACKING_TXT))).rejects.toThrow(/connection dropped/);
    } finally {
      proto.openUploadStreamWithId = original;
    }
    expect((await cols.usage.findOne({ ownerId: ALICE, kind: "upload" }))?.count).toBe(0);
    expect(await cols.evidence.countDocuments({ caseId: c._id })).toBe(0);
  });
});
