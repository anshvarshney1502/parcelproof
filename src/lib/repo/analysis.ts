import { collections } from "../db";
import { ConfigError, limits } from "../env";
import { HttpError, notFound } from "../http";
import { newId, sha256 } from "../ids";
import { gemmaClient, ModelError, type ModelClient } from "../ai/gemma";
import { buildAnalysisWorkflow } from "../ai/workflow";
import type { AnalysisDoc, CaseDoc, EvidenceDoc, ReviewDecision } from "../types";
import { getOwnedCase } from "./cases";
import { consume, refund, audit } from "./usage";

const STALE_RUN_MS = 10 * 60 * 1000;

/** Fingerprint of everything the analysis reads. If it changes, the saved analysis is stale. */
export function analysisInputHash(kase: CaseDoc, evidence: EvidenceDoc[]) {
  const ev = evidence
    .filter((e) => e.status === "extracted")
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId, undefined, { numeric: true }))
    .map((e) => ({ sourceId: e.sourceId, sha256: e.sha256, textHash: sha256(JSON.stringify(e.pages)) }));
  const meta = [kase.category, kase.orderRef, kase.orderValue, kase.currency, kase.channel, kase.orderDate, kase.dispatchDate, kase.expectedDeliveryDate, kase.disputeDate, kase.description];
  return { hash: sha256(JSON.stringify({ ev, meta })), evidenceHashes: ev };
}

export async function currentAnalysis(ownerId: string, caseId: string) {
  const { analyses } = await collections();
  return analyses.findOne({ caseId, ownerId, status: "succeeded" }, { sort: { version: -1 } });
}

export async function latestRun(ownerId: string, caseId: string) {
  const { analyses } = await collections();
  return analyses.findOne({ caseId, ownerId }, { sort: { version: -1 }, projection: { events: 0, findings: 0, gaps: 0 } });
}

export async function analysisState(ownerId: string, caseId: string) {
  const { evidence } = await collections();
  const kase = await getOwnedCase(ownerId, caseId);
  const [current, latest, ev] = await Promise.all([currentAnalysis(ownerId, caseId), latestRun(ownerId, caseId), evidence.find({ caseId, ownerId }).toArray()]);
  const { hash } = analysisInputHash(kase, ev);
  return { kase, current, latest, evidence: ev, stale: Boolean(current && current.inputHash !== hash) };
}

export async function startAnalysis(ownerId: string, caseId: string, opts: { force?: boolean; model?: ModelClient } = {}) {
  const c = await collections();
  const kase = await getOwnedCase(ownerId, caseId);
  const ev = await c.evidence.find({ caseId, ownerId }).toArray();
  if (ev.some((e) => e.status === "processing")) throw new HttpError(409, "Wait for evidence processing to finish.", "busy");
  if (!ev.some((e) => e.status === "extracted")) throw new HttpError(409, "Add at least one evidence file with readable text first.", "no_evidence");

  const latest = await c.analyses.findOne({ caseId, ownerId }, { sort: { version: -1 } });
  if (latest?.status === "running" && Date.now() - latest.createdAt.getTime() < STALE_RUN_MS)
    throw new HttpError(409, "An analysis is already running for this case.", "busy");
  if (latest?.status === "running")
    await c.analyses.updateOne({ _id: latest._id }, { $set: { status: "failed", error: "The analysis did not finish (the server may have restarted)." } });

  const { hash, evidenceHashes } = analysisInputHash(kase, ev);
  const current = await currentAnalysis(ownerId, caseId);
  if (current && current.inputHash === hash && !opts.force) return { analysisId: current._id, reused: true };

  let model: ModelClient;
  try {
    model = opts.model ?? gemmaClient();
  } catch (e) {
    if (e instanceof ModelError) throw new HttpError(503, e.message, "not_configured");
    throw e;
  }
  await consume(ownerId, "ai", limits.aiDailyLimit);

  const doc: AnalysisDoc = {
    _id: newId(),
    caseId,
    ownerId,
    version: (latest?.version ?? 0) + 1,
    status: "running",
    inputHash: hash,
    evidenceHashes,
    modelId: model.modelId,
    stages: [],
    events: [],
    findings: [],
    gaps: [],
    contradictions: [],
    summary: "",
    validation: { rejected: [], warnings: [] },
    truncated: false,
    createdAt: new Date(),
  };
  try {
    await c.analyses.insertOne(doc);
  } catch (e) {
    await refund(ownerId, "ai");
    if ((e as { code?: number }).code === 11000) throw new HttpError(409, "An analysis was started at the same moment. Refresh to see it.", "busy");
    throw e;
  }

  const workflow = buildAnalysisWorkflow(model);
  const run = await workflow.createRun({ resourceId: ownerId });
  let error: string | undefined;
  try {
    const res = await run.start({ inputData: { analysisId: doc._id, ownerId, caseId } });
    if (res.status !== "success") error = res.status === "failed" ? describe(res.error) : `Workflow ended with status "${res.status}".`;
  } catch (e) {
    error = describe(e);
  }
  if (error) {
    // The failed run is kept for history; the previous succeeded analysis remains current.
    await c.analyses.updateOne({ _id: doc._id }, { $set: { status: "failed", error, completedAt: new Date() } });
    if (/not configured|not available/i.test(error)) await refund(ownerId, "ai");
    await audit(ownerId, "analysis.failed", doc._id);
    throw new HttpError(502, error, "analysis_failed");
  }
  await audit(ownerId, "analysis.succeeded", doc._id);
  return { analysisId: doc._id, reused: false };
}

function describe(e: unknown) {
  if (e instanceof ModelError || e instanceof ConfigError) return e.message;
  // Mastra may hand back the step error serialised as a plain object.
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  return msg ? msg.slice(0, 300) : "The analysis failed.";
}

async function recountPending(ownerId: string, caseId: string, a: AnalysisDoc) {
  const { cases } = await collections();
  await cases.updateOne({ _id: caseId, ownerId }, { $set: { pendingReview: a.findings.filter((f) => f.review === "pending").length, updatedAt: new Date() } });
}

export async function reviewFinding(
  ownerId: string,
  caseId: string,
  input: { findingId: string; decision: ReviewDecision; correction?: string; status?: AnalysisDoc["findings"][number]["status"] },
) {
  const { analyses } = await collections();
  const current = await currentAnalysis(ownerId, caseId);
  if (!current) throw notFound();
  if (!current.findings.some((f) => f.id === input.findingId)) throw notFound();
  if (input.decision === "corrected" && !input.correction) throw new HttpError(400, "Write the corrected statement.", "invalid");
  const set: Record<string, unknown> = { "findings.$[f].review": input.decision, "findings.$[f].reviewedAt": new Date() };
  if (input.decision === "corrected") set["findings.$[f].correction"] = input.correction;
  if (input.status) set["findings.$[f].status"] = input.status;
  const updated = await analyses.findOneAndUpdate(
    { _id: current._id, ownerId },
    { $set: set, ...(input.decision !== "corrected" ? { $unset: { "findings.$[f].correction": "" } } : {}) },
    { arrayFilters: [{ "f.id": input.findingId }], returnDocument: "after" },
  );
  if (updated) await recountPending(ownerId, caseId, updated);
  return updated;
}

export async function reviewEvent(ownerId: string, caseId: string, eventId: string, decision: "pending" | "confirmed" | "dismissed") {
  const { analyses } = await collections();
  const current = await currentAnalysis(ownerId, caseId);
  if (!current || !current.events.some((e) => e.id === eventId)) throw notFound();
  await analyses.updateOne({ _id: current._id, ownerId }, { $set: { "events.$[e].review": decision } }, { arrayFilters: [{ "e.id": eventId }] });
}

export async function analysisHistory(ownerId: string, caseId: string) {
  const { analyses } = await collections();
  return analyses
    .find({ caseId, ownerId }, { projection: { version: 1, status: 1, modelId: 1, createdAt: 1, completedAt: 1, error: 1, stages: 1 } })
    .sort({ version: -1 })
    .limit(20)
    .toArray();
}
