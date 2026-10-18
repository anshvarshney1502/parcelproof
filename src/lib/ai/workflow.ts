import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { ZodType } from "zod";
import { collections } from "../db";
import { limits } from "../env";
import { comparisonOutput, extractionOutput } from "../schemas";
import type { AnalysisDoc, CaseDoc, EvidenceEvent, StageRecord } from "../types";
import { groundEvents, groundFindings, type Rejection, type Source } from "./grounding";
import { comparisonPrompt, extractionPrompt, buildEvidenceBlock } from "./prompts";
import { ModelError, parseJsonReply, type ModelClient } from "./gemma";

/**
 * Evidence-analysis workflow, orchestrated by Mastra.
 *
 *   verify-case → load-evidence → build-chunks → extract-events (Gemma) → ground-events
 *   → compare-evidence (Gemma) → ground-findings → persist
 *
 * Every stage records its status on the analysis document. Only the server-side
 * analysis id enters the workflow; owner and sources are loaded from the database.
 */

const ctx = z.object({ analysisId: z.string(), ownerId: z.string(), caseId: z.string() });
const any = <T>() => z.custom<T>(() => true);

async function stage(analysisId: string, id: string, status: StageRecord["status"], note?: string) {
  const { analyses } = await collections();
  await analyses.updateOne({ _id: analysisId }, { $push: { stages: { id, status, at: new Date(), ...(note ? { note } : {}) } } });
}

/** Runs a stage body with status bookkeeping. */
function tracked<I extends { analysisId: string }, O>(id: string, fn: (input: I) => Promise<O>) {
  return async ({ inputData }: { inputData: I }) => {
    await stage(inputData.analysisId, id, "running");
    try {
      const out = await fn(inputData);
      await stage(inputData.analysisId, id, "success");
      return out;
    } catch (e) {
      await stage(inputData.analysisId, id, "failed", e instanceof Error ? e.message.slice(0, 300) : "failed");
      throw e;
    }
  };
}

/** One model call with a single corrective retry for malformed output and one retry for transient provider errors. */
export async function callStructured<T>(model: ModelClient, prompt: string, schema: ZodType<T>, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  let lastError: ModelError | undefined;
  let p = prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = schema.safeParse(parseJsonReply(await model.generate(p)));
      if (parsed.success) return parsed.data;
      lastError = new ModelError("The model reply did not match the required structure.", "bad_output", true);
    } catch (e) {
      if (!(e instanceof ModelError) || !e.transient) throw e;
      lastError = e;
      if (e.kind !== "bad_output") await sleep(e.kind === "rate_limit" ? 4000 : 1500);
    }
    if (lastError.kind === "bad_output")
      p = `${prompt}\n\nYour previous reply was not valid. Reply with ONLY the JSON object in the exact shape described.`;
  }
  throw lastError!;
}

type Loaded = z.infer<typeof ctx> & { kase: CaseDoc; sources: Source[] };

export function buildAnalysisWorkflow(model: ModelClient) {
  const verifyCase = createStep({
    id: "verify-case",
    inputSchema: ctx,
    outputSchema: ctx.extend({ kase: any<CaseDoc>() }),
    execute: tracked("verify-case", async (i: z.infer<typeof ctx>) => {
      const { cases, analyses } = await collections();
      const a = await analyses.findOne({ _id: i.analysisId, ownerId: i.ownerId, caseId: i.caseId });
      const kase = await cases.findOne({ _id: i.caseId, ownerId: i.ownerId });
      if (!a || !kase) throw new Error("Case not found for this account.");
      return { ...i, kase };
    }),
  });

  const loadEvidence = createStep({
    id: "load-evidence",
    inputSchema: ctx.extend({ kase: any<CaseDoc>() }),
    outputSchema: ctx.extend({ kase: any<CaseDoc>(), sources: any<Source[]>() }),
    execute: tracked("load-evidence", async (i: z.infer<typeof ctx> & { kase: CaseDoc }) => {
      const { evidence } = await collections();
      const docs = await evidence.find({ caseId: i.caseId, ownerId: i.ownerId, status: "extracted" }).sort({ uploadedAt: 1 }).toArray();
      if (!docs.length) throw new Error("No evidence with extracted text is available.");
      const sources: Source[] = docs.map((d) => ({ sourceId: d.sourceId, evidenceId: d._id, pages: d.pages }));
      return { ...i, sources };
    }),
  });

  const buildChunks = createStep({
    id: "build-chunks",
    inputSchema: ctx.extend({ kase: any<CaseDoc>(), sources: any<Source[]>() }),
    outputSchema: ctx.extend({ kase: any<CaseDoc>(), sources: any<Source[]>(), evidenceBlock: z.string(), truncated: z.boolean() }),
    execute: tracked("build-chunks", async (i: Loaded) => {
      const { block, truncated } = buildEvidenceBlock(i.sources, limits.aiMaxInputChars);
      return { ...i, evidenceBlock: block, truncated };
    }),
  });

  type Chunked = Loaded & { evidenceBlock: string; truncated: boolean };

  const extractEvents = createStep({
    id: "extract-events",
    inputSchema: any<Chunked>(),
    outputSchema: any<Chunked & { raw: z.infer<typeof extractionOutput> }>(),
    execute: tracked("extract-events", async (i: Chunked) => ({
      ...i,
      raw: await callStructured(model, extractionPrompt(i.kase, i.evidenceBlock), extractionOutput),
    })),
  });

  type WithEvents = Chunked & { events: EvidenceEvent[]; rejected: Rejection[]; warnings: string[] };

  const validateEvents = createStep({
    id: "ground-events",
    inputSchema: any<Chunked & { raw: z.infer<typeof extractionOutput> }>(),
    outputSchema: any<WithEvents>(),
    execute: tracked("ground-events", async (i: Chunked & { raw: z.infer<typeof extractionOutput> }) => {
      const g = groundEvents(i.raw, new Map(i.sources.map((s) => [s.sourceId, s])));
      return { ...i, raw: undefined, events: g.events, rejected: g.rejected, warnings: g.warnings };
    }),
  });

  const compare = createStep({
    id: "compare-evidence",
    inputSchema: any<WithEvents>(),
    outputSchema: any<WithEvents & { cmp: z.infer<typeof comparisonOutput> }>(),
    execute: tracked("compare-evidence", async (i: WithEvents) => ({
      ...i,
      cmp: await callStructured(model, comparisonPrompt(i.kase, i.events, i.evidenceBlock), comparisonOutput),
    })),
  });

  const result = z.object({ analysisId: z.string(), findings: z.number(), events: z.number(), rejected: z.number() });

  const groundAndPersist = createStep({
    id: "ground-findings-and-persist",
    inputSchema: any<WithEvents & { cmp: z.infer<typeof comparisonOutput> }>(),
    outputSchema: result,
    execute: tracked("ground-findings-and-persist", async (i: WithEvents & { cmp: z.infer<typeof comparisonOutput> }) => {
      const g = groundFindings(i.cmp, new Map(i.sources.map((s) => [s.sourceId, s])));
      const { analyses, cases } = await collections();
      const update: Partial<AnalysisDoc> = {
        status: "succeeded",
        events: i.events,
        findings: g.findings,
        gaps: g.gaps,
        contradictions: g.contradictions,
        summary: i.cmp.summary,
        truncated: i.truncated,
        validation: { rejected: [...i.rejected, ...g.rejected], warnings: [...i.warnings, ...g.warnings] },
        completedAt: new Date(),
      };
      await analyses.updateOne({ _id: i.analysisId, ownerId: i.ownerId }, { $set: update });
      await cases.updateOne({ _id: i.caseId, ownerId: i.ownerId }, { $set: { pendingReview: g.findings.length, updatedAt: new Date() } });
      return { analysisId: i.analysisId, findings: g.findings.length, events: i.events.length, rejected: update.validation!.rejected.length };
    }),
  });

  return createWorkflow({ id: "evidence-analysis", inputSchema: ctx, outputSchema: result })
    .then(verifyCase)
    .then(loadEvidence)
    .then(buildChunks)
    .then(extractEvents)
    .then(validateEvents)
    .then(compare)
    .then(groundAndPersist)
    .commit();
}
