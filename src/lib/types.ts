import type { Category, EvidenceStatus } from "./schemas";

export type CaseDoc = {
  _id: string;
  ownerId: string;
  title: string;
  orderRef?: string;
  orderValue?: number;
  currency: string;
  channel?: string;
  category: Category;
  customerRef?: string;
  orderDate?: string;
  dispatchDate?: string;
  expectedDeliveryDate?: string;
  disputeDate?: string;
  deadline?: string;
  description?: string;
  status: "open" | "resolved";
  archivedAt?: Date | null;
  resolvedAt?: Date | null;
  sourceCounter: number;
  appealDraft?: string;
  /** Spoken briefing scripts, per language. basisHash ties a script to the reviewed findings it was written from. */
  briefingScripts?: Partial<Record<"en" | "hinglish", { text: string; basisHash: string; origin: "gemma" | "seller"; createdAt: Date }>>;
  /** Denormalised from the latest analysis so the dashboard can filter cheaply. */
  pendingReview: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PageText = { page: number; text: string };

export type EvidenceDoc = {
  _id: string;
  caseId: string;
  ownerId: string;
  sourceId: string;
  filename: string;
  mime: string;
  kind: "pdf" | "image" | "text" | "csv" | "audio";
  sha256: string;
  size: number;
  uploadedAt: Date;
  gridfsId: string;
  status: "processing" | "extracted" | "failed";
  error?: string;
  warnings?: string[];
  pageCount?: number;
  method?: "text" | "pdf-text" | "ocr" | "pdf-ocr" | "mixed" | "speech";
  /** Audio only: detected language and duration from ElevenLabs Scribe. */
  audio?: { languageCode?: string; durationSec?: number; speakers?: number };
  pages: PageText[];
  /** Original machine extraction kept when the seller corrects text. */
  originalPages?: PageText[];
  correctedAt?: Date;
  label?: string;
};

export type SourceRef = {
  sourceId: string;
  evidenceId: string;
  page: number;
  start: number;
  end: number;
  quote: string;
};

export type ReviewDecision = "pending" | "confirmed" | "corrected" | "dismissed";

export type EvidenceEvent = {
  id: string;
  date: string | null;
  originalDateText: string | null;
  dateCertainty: "exact" | "approximate" | "unknown";
  description: string;
  type: string;
  attributedTo: string;
  refs: SourceRef[];
  review: "pending" | "confirmed" | "dismissed";
};

export type CaseFinding = {
  id: string;
  statement: string;
  category: string;
  status: EvidenceStatus;
  modelStatus: EvidenceStatus;
  supporting: SourceRef[];
  conflicting: SourceRef[];
  limitation: string;
  nextAction: string;
  validationNotes: string[];
  review: ReviewDecision;
  correction?: string;
  reviewedAt?: Date;
};

export type EvidenceGap = {
  id: string;
  description: string;
  whyItMatters: string;
  importance: "required" | "useful";
  nextStep: string;
  relatedFindingIds: string[];
};

export type StageRecord = { id: string; status: "running" | "success" | "failed"; at: Date; note?: string };

export type AnalysisDoc = {
  _id: string;
  caseId: string;
  ownerId: string;
  version: number;
  status: "running" | "succeeded" | "failed";
  inputHash: string;
  evidenceHashes: { sourceId: string; sha256: string; textHash: string }[];
  modelId: string;
  stages: StageRecord[];
  events: EvidenceEvent[];
  findings: CaseFinding[];
  gaps: EvidenceGap[];
  contradictions: string[];
  summary: string;
  validation: { rejected: { what: string; reason: string }[]; warnings: string[] };
  truncated: boolean;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
};

export type BriefingDoc = {
  _id: string;
  ownerId: string;
  caseId: string;
  analysisId: string;
  cacheKey: string;
  language: "en" | "hinglish";
  text: string;
  textHash: string;
  voiceId: string;
  modelId: string;
  voiceStyle: "calm" | "balanced";
  status: "generating" | "ready" | "failed";
  gridfsId?: string;
  alignment?: { characters: string[]; starts: number[] };
  scriptOrigin?: "template" | "gemma" | "seller";
  characters: number;
  error?: string;
  createdAt: Date;
};

export type UsageDoc = { _id?: unknown; ownerId: string; kind: "ai" | "tts" | "stt" | "upload"; day: string; count: number };
export type AuditDoc = { _id?: unknown; ownerId: string; action: string; targetId?: string; at: Date };
export type SettingsDoc = { _id?: unknown; ownerId: string; language: "en" | "hinglish"; voiceStyle: "calm" | "balanced" };
