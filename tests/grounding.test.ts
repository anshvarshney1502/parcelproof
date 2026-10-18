import { describe, expect, it } from "vitest";
import { groundEvents, groundFindings, resolveRef, sortEvents, type Source } from "@/lib/ai/grounding";
import { caseInput, comparisonOutput, extractionOutput } from "@/lib/schemas";
import { parseJsonReply } from "@/lib/ai/gemma";
import { CUSTOMER_MSG, TRACKING_TXT } from "./helpers";

const sources = new Map<string, Source>([
  ["S1", { sourceId: "S1", evidenceId: "ev1", pages: [{ page: 1, text: TRACKING_TXT }] }],
  ["S2", { sourceId: "S2", evidenceId: "ev2", pages: [{ page: 1, text: CUSTOMER_MSG }, { page: 2, text: "Second page with the  weight   note 1.0 kg" }] }],
]);
const otherCase = new Map<string, Source>([["S9", { sourceId: "S9", evidenceId: "evX", pages: [{ page: 1, text: "another user's private document text" }] }]]);

describe("schema validation", () => {
  it("accepts a valid case and applies defaults", () => {
    const c = caseInput.parse({ title: "Empty box claim", category: "missing_contents", orderValue: "1499", orderDate: "2026-09-10" });
    expect(c.currency).toBe("INR");
    expect(c.orderValue).toBe(1499);
  });
  it("rejects invalid case input", () => {
    expect(caseInput.safeParse({ title: "x", category: "missing_contents" }).success).toBe(false);
    expect(caseInput.safeParse({ title: "Valid title", category: "nope" }).success).toBe(false);
    expect(caseInput.safeParse({ title: "Valid title", category: "other", orderDate: "14/09/2026" }).success).toBe(false);
  });
  it("rejects a case missing required fields", () => {
    expect(caseInput.safeParse({ category: "other" }).success).toBe(false);
  });
  it("rejects model output that does not match the schema", () => {
    expect(extractionOutput.safeParse({ events: [{ description: "x", type: "teleport", attributedTo: "a", dateCertainty: "exact", refs: [] }] }).success).toBe(false);
    expect(comparisonOutput.safeParse({ findings: [] }).success).toBe(false);
  });
  it("extracts JSON from fenced replies and rejects prose", () => {
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseJsonReply("I cannot help with that")).toThrow(/did not contain JSON/);
  });
});

describe("source references", () => {
  it("verifies an exact quotation and returns real offsets", () => {
    const r = resolveRef({ sourceId: "S1", page: 1, quote: "Delivered - signed by R. Kumar" }, sources);
    expect(r.ok).toBe(true);
    if (r.ok) expect(TRACKING_TXT.slice(r.ref.start, r.ref.end)).toBe("Delivered - signed by R. Kumar");
  });
  it("tolerates only whitespace and typographic differences", () => {
    expect(resolveRef({ sourceId: "S2", page: 2, quote: "with the weight note 1.0 kg" }, sources).ok).toBe(true);
    expect(resolveRef({ sourceId: "S1", page: 1, quote: "Delivered – signed by R. Kumar" }, sources).ok).toBe(true);
    expect(resolveRef({ sourceId: "S1", page: 1, quote: "delivered - signed by r. kumar" }, sources).ok).toBe(false);
  });
  it("rejects a quotation that is not in the source", () => {
    const r = resolveRef({ sourceId: "S1", page: 1, quote: "Parcel was left at the door" }, sources);
    expect(r).toEqual({ ok: false, reason: "quotation not found in S1" });
  });
  it("rejects an unknown source id", () => {
    expect(resolveRef({ sourceId: "S7", quote: "Delivered - signed" }, sources).ok).toBe(false);
  });
  it("rejects a reference to evidence from another case", () => {
    expect(resolveRef({ sourceId: "S9", quote: "another user's private document" }, sources).ok).toBe(false);
    expect(resolveRef({ sourceId: "S9", quote: "another user's private document" }, otherCase).ok).toBe(true);
  });
  it("corrects a wrong page number with a visible warning", () => {
    const r = resolveRef({ sourceId: "S2", page: 1, quote: "weight note 1.0 kg" }, sources);
    expect(r.ok && r.ref.page).toBe(2);
    expect(r.ok && r.warning).toMatch(/page 2, not page 1/);
  });
});

describe("events and findings", () => {
  it("downgrades a precise date that is not in the quotation, and orders uncertain events last", () => {
    const { events, warnings } = groundEvents(
      {
        events: [
          { description: "Customer reports empty box", type: "complaint", attributedTo: "Customer", date: "2026-09-14", originalDateText: "14 Sept", dateCertainty: "exact", refs: [{ sourceId: "S2", page: 1, quote: "the box was empty when I opened it" }] },
          { description: "Delivered", type: "delivery", attributedTo: "Courier", date: "2026-09-13T18:40", originalDateText: "2026-09-13 18:40", dateCertainty: "exact", refs: [{ sourceId: "S1", page: 1, quote: "2026-09-13 18:40 Delivered" }] },
          { description: "Undated", type: "other", attributedTo: "Courier", date: null, originalDateText: null, dateCertainty: "unknown", refs: [{ sourceId: "S1", quote: "Package weight at pickup" }] },
        ],
      },
      sources,
    );
    expect(events.map((e) => e.description)).toEqual(["Delivered", "Customer reports empty box", "Undated"]);
    expect(events[1].dateCertainty).toBe("approximate");
    expect(events[0].dateCertainty).toBe("exact");
    expect(warnings.join()).toMatch(/marked approximate/);
    expect(sortEvents(events).at(-1)?.dateCertainty).toBe("unknown");
  });

  it("omits events with no verifiable quotation", () => {
    const { events, rejected } = groundEvents(
      { events: [{ description: "Invented scan", type: "transit", attributedTo: "Courier", date: "2026-09-12", originalDateText: null, dateCertainty: "exact", refs: [{ sourceId: "S1", quote: "Arrived at Delhi hub" }] }] },
      sources,
    );
    expect(events).toHaveLength(0);
    expect(rejected.some((r) => r.reason.includes("omitted"))).toBe(true);
  });

  it("downgrades an unsupported 'supported' claim to unverified and flags accusations", () => {
    const { findings } = groundFindings(
      {
        summary: "s",
        findings: [
          { statement: "Courier delivered the parcel", category: "delivery", status: "supported", supporting: [{ sourceId: "S1", quote: "Delivered - signed by R. Kumar" }], conflicting: [], limitation: "", nextAction: "" },
          { statement: "Parcel contained the item", category: "contents", status: "supported", supporting: [{ sourceId: "S1", quote: "Item was inside the box" }], conflicting: [], limitation: "", nextAction: "" },
          { statement: "The customer is committing fraud", category: "other", status: "supported", supporting: [{ sourceId: "S2", quote: "the box was empty when I opened it" }], conflicting: [], limitation: "", nextAction: "" },
        ],
        gaps: [],
      },
      sources,
    );
    expect(findings[0].status).toBe("supported");
    expect(findings[1].status).toBe("unverified");
    expect(findings[1].validationNotes[0]).toMatch(/could be verified/);
    expect(findings[2].status).toBe("unverified");
    expect(findings[2].validationNotes.join()).toMatch(/does not determine intent/);
  });

  it("keeps a conflict only when both sides verify", () => {
    const base = { category: "contents" as const, limitation: "", nextAction: "" };
    const { findings, contradictions } = groundFindings(
      {
        summary: "s",
        findings: [
          { ...base, statement: "Weight differs between records", status: "conflicting", supporting: [{ sourceId: "S1", quote: "Package weight at pickup: 1.2 kg" }], conflicting: [{ sourceId: "S2", page: 2, quote: "weight note 1.0 kg" }] },
          { ...base, statement: "One-sided conflict", status: "conflicting", supporting: [{ sourceId: "S1", quote: "Package weight at pickup: 1.2 kg" }], conflicting: [{ sourceId: "S2", quote: "weight was 3 kg" }] },
        ],
        gaps: [],
      },
      sources,
    );
    expect(findings[0].status).toBe("conflicting");
    expect(findings[1].status).toBe("unverified");
    expect(contradictions).toEqual(["Weight differs between records"]);
  });
});

import { formatTranscript } from "@/lib/voice/stt";
import { detectFile } from "@/lib/files/validate";

describe("voice evidence", () => {
  it("formats Scribe words into timestamped speaker turns", () => {
    const words = [
      { text: "Hello", start: 0.2, end: 0.5, type: "word", speakerId: "speaker_0" },
      { text: " ", type: "spacing", speakerId: "speaker_0" },
      { text: "seller.", start: 0.6, end: 1, type: "word", speakerId: "speaker_0" },
      { text: "(laughs)", start: 1, end: 1.2, type: "audio_event" },
      { text: "Box", start: 72.4, end: 72.8, type: "word", speakerId: "speaker_1" },
      { text: " ", type: "spacing", speakerId: "speaker_1" },
      { text: "khaali tha.", start: 72.9, end: 73.6, type: "word", speakerId: "speaker_1" },
    ];
    expect(formatTranscript(words)).toEqual({ text: "[00:00] Speaker 1: Hello seller.\n[01:12] Speaker 2: Box khaali tha.", speakers: 2 });
  });
  it("accepts common voice-note formats and rejects mismatched extensions", () => {
    const ogg = new TextEncoder().encode("OggS\0\0\0\0rest");
    expect(detectFile(ogg, "PTT-20260914.opus")).toEqual({ kind: "audio", mime: "audio/ogg" });
    const m4a = new Uint8Array([0, 0, 0, 0x20, ...new TextEncoder().encode("ftypM4A ")]);
    expect(detectFile(m4a, "call.m4a").kind).toBe("audio");
    expect(() => detectFile(ogg, "note.mp3")).toThrow(/extension/);
  });
});

import { sentenceSpans } from "@/components/app/synced-transcript";
describe("briefing transcript", () => {
  it("splits sentences without breaking decimals or initials", () => {
    expect(sentenceSpans("Weight 1.2 kg tha. R. Kumar ne sign kiya! Theek hai?").map((s) => s.text)).toEqual(["Weight 1.2 kg tha.", "R. Kumar ne sign kiya!", "Theek hai?"]);
  });
});

import { parseRange, readFormLimited } from "@/lib/stream";
describe("HTTP hardening", () => {
  it("parses byte ranges and rejects unsatisfiable ones", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=0-500", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=200-300", 100)).toBeNull();
    expect(parseRange("items=0-1", 100)).toBeNull();
    expect(parseRange(null, 100)).toBeNull();
  });
  it("stops reading an upload as soon as it exceeds the cap, even without Content-Length", async () => {
    const big = new ReadableStream({ start(c) { for (let i = 0; i < 20; i++) c.enqueue(new Uint8Array(1024)); c.close(); } });
    const req = new Request("http://x/upload", { method: "POST", body: big, headers: { "content-type": "multipart/form-data; boundary=x" }, duplex: "half" } as RequestInit);
    await expect(readFormLimited(req, 4096, "too big")).rejects.toMatchObject({ status: 413 });
  });
});
