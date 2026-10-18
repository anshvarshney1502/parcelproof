import { z } from "zod";

export const CATEGORIES = {
  not_received: "Marked delivered, not received",
  damaged: "Damaged parcel or item",
  missing_contents: "Missing contents",
  return_mismatch: "Return mismatch",
  wrong_item: "Wrong item received",
  other: "Other",
} as const;
export type Category = keyof typeof CATEGORIES;

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "AED", "SGD"] as const;

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
);

export const caseInput = z.object({
  title: z.string().trim().min(3, "Give the case a short title").max(140),
  orderRef: optStr(80),
  orderValue: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative().max(1e9).optional(),
  ),
  currency: z.enum(CURRENCIES).default("INR"),
  channel: optStr(60),
  category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
  customerRef: optStr(80),
  orderDate: optDate,
  dispatchDate: optDate,
  expectedDeliveryDate: optDate,
  disputeDate: optDate,
  deadline: optDate,
  description: optStr(4000),
});
export type CaseInput = z.infer<typeof caseInput>;
export const caseUpdate = caseInput.partial();

export const caseAction = z.object({ action: z.enum(["archive", "restore", "resolve", "reopen"]) });

export const caseQuery = z.object({
  view: z.enum(["all", "active", "unresolved", "resolved", "archived"]).default("active"),
  q: z.string().trim().max(100).optional(),
  category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]).optional(),
  sort: z.enum(["created", "updated", "deadline"]).default("updated"),
});

export const id = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, "Invalid id");

export const textCorrection = z.object({
  pages: z.array(z.object({ page: z.number().int().min(1), text: z.string().max(200_000) })).min(1).max(500),
});

export const EVIDENCE_STATUSES = ["supported", "conflicting", "unverified", "missing"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const findingReview = z.object({
  findingId: id,
  decision: z.enum(["confirmed", "corrected", "dismissed", "pending"]),
  correction: z.string().trim().max(1000).optional(),
  status: z.enum(EVIDENCE_STATUSES).optional(),
});

export const eventReview = z.object({
  eventId: id,
  decision: z.enum(["confirmed", "dismissed", "pending"]),
});

export const settingsInput = z.object({
  language: z.enum(["en", "hinglish"]),
  voiceStyle: z.enum(["calm", "balanced"]),
});

export const appealInput = z.object({ appealDraft: z.string().max(8000) });

/* ---------- Model output (untrusted) ---------- */

const ref = z.object({
  sourceId: z.string().max(20),
  page: z.number().int().min(1).nullish(),
  quote: z.string().min(1).max(600),
});
export type ModelRef = z.infer<typeof ref>;

export const extractionOutput = z.object({
  events: z
    .array(
      z.object({
        description: z.string().min(1).max(400),
        type: z.enum(["order", "payment", "dispatch", "transit", "delivery", "complaint", "return", "communication", "packing", "other"]),
        attributedTo: z.string().max(120),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/).nullish(),
        originalDateText: z.string().max(120).nullish(),
        dateCertainty: z.enum(["exact", "approximate", "unknown"]),
        refs: z.array(ref).min(1).max(4),
      }),
    )
    .max(40),
});
export type ExtractionOutput = z.infer<typeof extractionOutput>;

export const comparisonOutput = z.object({
  summary: z.string().min(1).max(1500),
  findings: z
    .array(
      z.object({
        statement: z.string().min(1).max(400),
        category: z.enum(["delivery", "condition", "contents", "identity", "timing", "communication", "return", "other"]),
        status: z.enum(EVIDENCE_STATUSES),
        supporting: z.array(ref).max(4),
        conflicting: z.array(ref).max(4),
        limitation: z.string().max(500),
        nextAction: z.string().max(300),
      }),
    )
    .max(25),
  gaps: z
    .array(
      z.object({
        description: z.string().min(1).max(300),
        whyItMatters: z.string().max(400),
        importance: z.enum(["required", "useful"]),
        nextStep: z.string().max(300),
      }),
    )
    .max(15),
});
export type ComparisonOutput = z.infer<typeof comparisonOutput>;
