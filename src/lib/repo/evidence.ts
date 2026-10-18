import { Readable } from "node:stream";
import { ObjectId } from "mongodb";
import { collections } from "../db";
import { limits } from "../env";
import { HttpError, notFound } from "../http";
import { newId, sha256 } from "../ids";
import { detectFile, FileRejected, safeFilename } from "../files/validate";
import { extractText, ExtractionFailed } from "../files/extract";
import type { EvidenceDoc, PageText } from "../types";
import { getOwnedCase, dropFile } from "./cases";
import { audit, consume } from "./usage";

const UPLOADS_PER_DAY = 60;

export async function listEvidence(ownerId: string, caseId: string) {
  const { evidence } = await collections();
  return evidence.find({ caseId, ownerId }).sort({ uploadedAt: 1 }).toArray();
}

export async function getOwnedEvidence(ownerId: string, evidenceId: string) {
  const { evidence } = await collections();
  const doc = await evidence.findOne({ _id: evidenceId, ownerId });
  if (!doc) throw notFound();
  return doc;
}

export async function uploadEvidence(ownerId: string, caseId: string, filename: string, bytes: Uint8Array): Promise<EvidenceDoc> {
  const c = await collections();
  const kase = await getOwnedCase(ownerId, caseId);
  if (kase.archivedAt) throw new HttpError(409, "Restore this case before adding evidence.", "archived");
  if (bytes.byteLength === 0) throw new HttpError(400, "The file is empty.", "invalid");
  if (bytes.byteLength > limits.maxUploadBytes)
    throw new HttpError(413, `Files must be ${Math.round(limits.maxUploadBytes / 1048576)} MB or smaller.`, "too_large");

  const name = safeFilename(filename);
  let detected;
  try {
    detected = detectFile(bytes, name);
  } catch (e) {
    if (e instanceof FileRejected) throw new HttpError(415, e.message, "unsupported");
    throw e;
  }

  const [count, stored] = await Promise.all([
    c.evidence.countDocuments({ caseId, ownerId }),
    c.evidence.aggregate<{ total: number }>([{ $match: { ownerId } }, { $group: { _id: null, total: { $sum: "$size" } } }]).toArray(),
  ]);
  if (count >= limits.maxEvidencePerCase)
    throw new HttpError(409, `A case can hold up to ${limits.maxEvidencePerCase} evidence files.`, "limit");
  if ((stored[0]?.total ?? 0) + bytes.byteLength > limits.maxUserStorageBytes)
    throw new HttpError(409, "Your storage allowance is full. Delete older evidence or cases to make room.", "limit");

  const hash = sha256(bytes);
  const dup = await c.evidence.findOne({ caseId, ownerId, sha256: hash }, { projection: { sourceId: 1, filename: 1 } });
  if (dup) throw new HttpError(409, `This file is already in the case as ${dup.sourceId} (${dup.filename}).`, "duplicate");

  await consume(ownerId, "upload", UPLOADS_PER_DAY);

  const counter = await c.cases.findOneAndUpdate(
    { _id: caseId, ownerId },
    { $inc: { sourceCounter: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!counter) throw notFound();
  const sourceId = `S${counter.sourceCounter}`;

  const gridfsId = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    Readable.from(Buffer.from(bytes))
      .pipe(c.files.openUploadStreamWithId(gridfsId, name, { metadata: { ownerId, caseId, mime: detected.mime } }))
      .on("finish", () => resolve())
      .on("error", reject);
  });

  const doc: EvidenceDoc = {
    _id: newId(),
    caseId,
    ownerId,
    sourceId,
    filename: name,
    mime: detected.mime,
    kind: detected.kind,
    sha256: hash,
    size: bytes.byteLength,
    uploadedAt: new Date(),
    gridfsId: gridfsId.toHexString(),
    status: "processing",
    pages: [],
  };
  try {
    await c.evidence.insertOne(doc);
  } catch (e) {
    await dropFile(c.files, doc.gridfsId);
    if ((e as { code?: number }).code === 11000) throw new HttpError(409, "This file is already in the case.", "duplicate");
    throw e;
  }
  await audit(ownerId, "evidence.upload", doc._id);
  return runExtraction(doc, bytes);
}

/** Runs extraction and persists either the text or a visible failure. Never stores invented text. */
export async function runExtraction(doc: EvidenceDoc, bytes?: Uint8Array): Promise<EvidenceDoc> {
  const c = await collections();
  const data = bytes ?? (await readFile(doc.gridfsId));
  await c.evidence.updateOne({ _id: doc._id }, { $set: { status: "processing" }, $unset: { error: "" } });
  try {
    const out = await extractText(doc.kind, data);
    const set = { status: "extracted" as const, pages: out.pages, pageCount: out.pageCount, method: out.method, warnings: out.warnings };
    await c.evidence.updateOne({ _id: doc._id }, { $set: set, $unset: { error: "", originalPages: "", correctedAt: "" } });
    return { ...doc, ...set, error: undefined };
  } catch (e) {
    const error = e instanceof ExtractionFailed ? e.message : "Text extraction failed unexpectedly. Try again, or enter the text manually.";
    if (!(e instanceof ExtractionFailed)) console.error("[extract]", doc.kind, e instanceof Error ? e.message : "unknown");
    await c.evidence.updateOne({ _id: doc._id }, { $set: { status: "failed", error, pages: [] } });
    return { ...doc, status: "failed", error, pages: [] };
  }
}

export async function readFile(gridfsId: string): Promise<Uint8Array> {
  const { files } = await collections();
  const chunks: Buffer[] = [];
  for await (const chunk of files.openDownloadStream(new ObjectId(gridfsId))) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Seller-entered text replaces the extraction; the machine output is preserved once for comparison. */
export async function correctText(ownerId: string, evidenceId: string, pages: PageText[]) {
  const c = await collections();
  const doc = await getOwnedEvidence(ownerId, evidenceId);
  const clean = pages.map((p) => ({ page: p.page, text: p.text.replace(/\r\n?/g, "\n").trim() }));
  if (!clean.some((p) => p.text.length >= 3)) throw new HttpError(400, "Enter at least a few characters of text.", "invalid");
  await c.evidence.updateOne(
    { _id: doc._id, ownerId },
    {
      $set: { pages: clean, status: "extracted", correctedAt: new Date(), pageCount: doc.pageCount ?? clean.length, ...(doc.originalPages || !doc.pages.length ? {} : { originalPages: doc.pages }) },
      $unset: { error: "" },
    },
  );
  await c.cases.updateOne({ _id: doc.caseId, ownerId }, { $set: { updatedAt: new Date() } });
  await audit(ownerId, "evidence.correct", doc._id);
}

export async function updateLabel(ownerId: string, evidenceId: string, label: string) {
  const c = await collections();
  const res = await c.evidence.updateOne({ _id: evidenceId, ownerId }, { $set: { label: label.slice(0, 80) } });
  if (!res.matchedCount) throw notFound();
}

export async function deleteEvidence(ownerId: string, evidenceId: string) {
  const c = await collections();
  const doc = await getOwnedEvidence(ownerId, evidenceId);
  await c.evidence.deleteOne({ _id: doc._id, ownerId });
  await dropFile(c.files, doc.gridfsId);
  await c.cases.updateOne({ _id: doc.caseId, ownerId }, { $set: { updatedAt: new Date() } });
  await audit(ownerId, "evidence.delete", doc._id);
  return doc;
}
