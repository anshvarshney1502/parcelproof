import { Readable } from "node:stream";
import { ObjectId } from "mongodb";
import { collections } from "../db";
import { ConfigError, limits, voiceFor } from "../env";
import { HttpError, notFound } from "../http";
import { newId, sha256 } from "../ids";
import { buildBriefingText, reviewedFindings } from "../voice/briefing-text";
import { elevenLabsClient, VOICE_SETTINGS, VoiceError, type TtsClient } from "../voice/tts";
import type { BriefingDoc, SettingsDoc } from "../types";
import { analysisState } from "./analysis";
import { scriptBasis, writeBriefingScript, ScriptRejected } from "../ai/briefing-script";
import { gemmaClient, ModelError, type ModelClient } from "../ai/gemma";
import { dropFile } from "./cases";
import { audit, consume, refund } from "./usage";

export async function getSettings(ownerId: string): Promise<SettingsDoc> {
  const { settings } = await collections();
  return (await settings.findOne({ ownerId })) ?? { ownerId, language: "en", voiceStyle: "calm" };
}

export async function markOnboarded(ownerId: string) {
  const { settings } = await collections();
  await settings.updateOne({ ownerId }, { $set: { onboardedAt: new Date() }, $setOnInsert: { language: "en", voiceStyle: "calm" } }, { upsert: true });
}

export async function saveSettings(ownerId: string, s: Pick<SettingsDoc, "language" | "voiceStyle">) {
  const { settings } = await collections();
  await settings.updateOne({ ownerId }, { $set: { ...s, ownerId } }, { upsert: true });
}

export function briefingCacheKey(p: { ownerId: string; textHash: string; voiceId: string; modelId: string; language: string; voiceStyle: keyof typeof VOICE_SETTINGS }) {
  return sha256(JSON.stringify([p.ownerId, p.textHash, p.voiceId, p.modelId, p.language, VOICE_SETTINGS[p.voiceStyle]]));
}

/** What would be spoken, and whether matching audio already exists. Never calls the provider. */
export async function previewBriefing(ownerId: string, caseId: string, language?: "en" | "hinglish") {
  const { kase, current, stale } = await analysisState(ownerId, caseId);
  const settings = await getSettings(ownerId);
  const lang = language ?? settings.language;
  if (!current) return { ready: false as const, reason: "Run an analysis first.", language: lang };
  const pending = current.findings.filter((f) => f.review === "pending").length;
  const reviewed = reviewedFindings(current).length;
  const basis = scriptBasis(kase, current);
  const saved = kase.briefingScripts?.[lang];
  const useSaved = Boolean(saved && saved.basisHash === basis.hash);
  const text = useSaved ? saved!.text : buildBriefingText(kase, current, lang);
  const scriptOrigin: "template" | "gemma" | "seller" = useSaved ? saved!.origin : "template";
  const voice = voiceFor(lang);
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  const cacheKey = briefingCacheKey({ ownerId, textHash: sha256(text), voiceId: voice, modelId, language: lang, voiceStyle: settings.voiceStyle });
  const { briefings } = await collections();
  const cached = voice ? await briefings.findOne({ ownerId, caseId, cacheKey, status: "ready" }) : null;
  const last = await briefings.findOne({ ownerId, caseId }, { sort: { createdAt: -1 } });
  return {
    ready: true as const,
    language: lang,
    voiceStyle: settings.voiceStyle,
    text,
    scriptOrigin,
    scriptStale: Boolean(saved && !useSaved),
    characters: text.length,
    pending,
    reviewed,
    stale,
    analysisId: current._id,
    cached: cached ? publicBriefing(cached) : null,
    lastError: last && last.status === "failed" && last.textHash === sha256(text) && last.language === lang ? last.error : undefined,
  };
}

export async function generateBriefing(ownerId: string, caseId: string, language: "en" | "hinglish" | undefined, tts?: TtsClient) {
  const p = await previewBriefing(ownerId, caseId, language);
  if (!p.ready) throw new HttpError(409, p.reason, "no_analysis");
  if (p.pending > 0) throw new HttpError(409, `Review all findings first (${p.pending} still pending).`, "needs_review");
  if (p.reviewed === 0) throw new HttpError(409, "Confirm or correct at least one finding before generating a briefing.", "needs_review");
  if (p.cached) return { briefing: p.cached, reused: true };

  let client: TtsClient;
  try {
    client = tts ?? elevenLabsClient(p.language);
  } catch (e) {
    if (e instanceof ConfigError) throw new HttpError(503, `${e.message} The text briefing is still available.`, "not_configured");
    throw e;
  }
  const settings = await getSettings(ownerId);
  const textHash = sha256(p.text);
  const cacheKey = briefingCacheKey({ ownerId, textHash, voiceId: client.voiceId, modelId: client.modelId, language: p.language, voiceStyle: settings.voiceStyle });
  const { briefings, audio } = await collections();
  const existing = await briefings.findOne({ ownerId, caseId, cacheKey, status: "ready" });
  if (existing) return { briefing: publicBriefing(existing), reused: true };

  await consume(ownerId, "tts", limits.ttsDailyLimit);
  const doc: BriefingDoc = {
    _id: newId(),
    ownerId,
    caseId,
    analysisId: p.analysisId,
    cacheKey,
    language: p.language,
    text: p.text,
    textHash,
    voiceId: client.voiceId,
    modelId: client.modelId,
    voiceStyle: settings.voiceStyle,
    status: "generating",
    scriptOrigin: p.scriptOrigin,
    characters: p.text.length,
    createdAt: new Date(),
  };
  await briefings.insertOne(doc);
  let bytes: Uint8Array;
  let alignment: BriefingDoc["alignment"];
  try {
    const res = await client.synthesize(p.text, settings.voiceStyle);
    bytes = res.audio;
    alignment = res.alignment;
  } catch (e) {
    const err = e instanceof VoiceError ? e : new VoiceError("Voice generation failed.", 502);
    await briefings.updateOne({ _id: doc._id }, { $set: { status: "failed", error: err.message } });
    await refund(ownerId, "tts");
    throw new HttpError(err.status, err.message, "voice_failed");
  }
  const gridfsId = new ObjectId();
  await new Promise<void>((resolve, reject) =>
    Readable.from(Buffer.from(bytes))
      .pipe(audio.openUploadStreamWithId(gridfsId, `${doc._id}.mp3`, { metadata: { ownerId, caseId } }))
      .on("finish", () => resolve())
      .on("error", reject),
  );
  // Older audio for this case is superseded; keep storage bounded.
  const old = await briefings.find({ ownerId, caseId, _id: { $ne: doc._id } }).sort({ createdAt: -1 }).toArray();
  await briefings.updateOne({ _id: doc._id }, { $set: { status: "ready", gridfsId: gridfsId.toHexString(), ...(alignment ? { alignment } : {}) } });
  // Keep the three most recent recordings (typically one per language plus the previous take); drop the rest and failed rows.
  const keep = new Set(old.filter((o) => o.status === "ready").slice(0, 3).map((o) => o._id));
  for (const o of old.filter((o) => !keep.has(o._id) && o.status !== "generating")) {
    if (o.gridfsId) await dropFile(audio, o.gridfsId);
    await briefings.deleteOne({ _id: o._id });
  }
  await audit(ownerId, "briefing.generate", doc._id);
  return { briefing: publicBriefing({ ...doc, status: "ready", gridfsId: gridfsId.toHexString(), alignment }), reused: false };
}

export async function getOwnedBriefing(ownerId: string, briefingId: string) {
  const { briefings } = await collections();
  const b = await briefings.findOne({ _id: briefingId, ownerId });
  if (!b) throw notFound();
  return b;
}

export async function deleteBriefing(ownerId: string, briefingId: string) {
  const { briefings, audio } = await collections();
  const b = await getOwnedBriefing(ownerId, briefingId);
  await briefings.deleteOne({ _id: b._id, ownerId });
  if (b.gridfsId) await dropFile(audio, b.gridfsId);
}

export function publicBriefing(b: BriefingDoc) {
  return { id: b._id, status: b.status, language: b.language, text: b.text, characters: b.characters, createdAt: b.createdAt, voiceStyle: b.voiceStyle, error: b.error, alignment: b.alignment, scriptOrigin: b.scriptOrigin ?? "template" };
}

/** Gemma drafts the spoken script from reviewed findings; the seller can then edit it. */
export async function draftScript(ownerId: string, caseId: string, language: "en" | "hinglish", model?: ModelClient) {
  const { kase, current } = await analysisState(ownerId, caseId);
  if (!current) throw new HttpError(409, "Run an analysis first.", "no_analysis");
  if (reviewedFindings(current).length === 0) throw new HttpError(409, "Confirm or correct at least one finding first.", "needs_review");
  let client: ModelClient;
  try {
    client = model ?? gemmaClient();
  } catch (e) {
    if (e instanceof ModelError || e instanceof ConfigError) throw new HttpError(503, e.message, "not_configured");
    throw e;
  }
  await consume(ownerId, "ai", limits.aiDailyLimit);
  try {
    const s = await writeBriefingScript(client, kase, current, language);
    await storeScript(ownerId, caseId, language, s.text, s.basisHash, "gemma");
    return s.text;
  } catch (e) {
    if (e instanceof ScriptRejected) throw new HttpError(422, `${e.message} Nothing was saved — try again or edit the script yourself.`, "rejected");
    if (e instanceof ModelError) {
      if (!e.transient) await refund(ownerId, "ai");
      throw new HttpError(502, e.message, "model_failed");
    }
    throw e;
  }
}

/** Seller-edited script. Tied to the current reviewed findings so later changes mark it stale. */
export async function saveScript(ownerId: string, caseId: string, language: "en" | "hinglish", text: string) {
  const { kase, current } = await analysisState(ownerId, caseId);
  if (!current) throw new HttpError(409, "Run an analysis first.", "no_analysis");
  await storeScript(ownerId, caseId, language, text.replace(/\s+/g, " ").trim(), scriptBasis(kase, current).hash, "seller");
}

export async function resetScript(ownerId: string, caseId: string, language: "en" | "hinglish") {
  const { cases } = await collections();
  await cases.updateOne({ _id: caseId, ownerId }, { $unset: { [`briefingScripts.${language}`]: "" }, $set: { updatedAt: new Date() } });
}

async function storeScript(ownerId: string, caseId: string, language: "en" | "hinglish", text: string, basisHash: string, origin: "gemma" | "seller") {
  const { cases } = await collections();
  const res = await cases.updateOne({ _id: caseId, ownerId }, { $set: { [`briefingScripts.${language}`]: { text, basisHash, origin, createdAt: new Date() }, updatedAt: new Date() } });
  if (!res.matchedCount) throw notFound();
}
