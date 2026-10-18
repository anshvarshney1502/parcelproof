import type { Filter, Sort } from "mongodb";
import { ObjectId } from "mongodb";
import { collections } from "../db";
import { notFound } from "../http";
import { newId } from "../ids";
import type { CaseInput } from "../schemas";
import type { CaseDoc } from "../types";
import { audit } from "./usage";

/** Every lookup is scoped by owner; a case owned by someone else is indistinguishable from a missing one. */
export async function getOwnedCase(ownerId: string, caseId: string): Promise<CaseDoc> {
  const { cases } = await collections();
  const doc = await cases.findOne({ _id: caseId, ownerId });
  if (!doc) throw notFound();
  return doc;
}

export async function createCase(ownerId: string, input: CaseInput): Promise<CaseDoc> {
  const { cases } = await collections();
  const now = new Date();
  const doc: CaseDoc = {
    ...input,
    _id: newId(),
    ownerId,
    status: "open",
    archivedAt: null,
    resolvedAt: null,
    sourceCounter: 0,
    pendingReview: 0,
    createdAt: now,
    updatedAt: now,
  };
  await cases.insertOne(doc);
  await audit(ownerId, "case.create", doc._id);
  return doc;
}

export async function updateCase(ownerId: string, caseId: string, input: Partial<CaseInput>) {
  const { cases } = await collections();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  const unset: Record<string, ""> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) unset[k] = "";
    else set[k] = v;
  }
  // Required fields are never unset by a partial update.
  delete unset.title; delete unset.category; delete unset.currency;
  const res = await cases.findOneAndUpdate(
    { _id: caseId, ownerId },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after" },
  );
  if (!res) throw notFound();
  return res;
}

export async function setCaseState(ownerId: string, caseId: string, action: "archive" | "restore" | "resolve" | "reopen") {
  const { cases } = await collections();
  const now = new Date();
  const set: Partial<CaseDoc> = { updatedAt: now };
  if (action === "archive") set.archivedAt = now;
  if (action === "restore") set.archivedAt = null;
  if (action === "resolve") Object.assign(set, { status: "resolved", resolvedAt: now });
  if (action === "reopen") Object.assign(set, { status: "open", resolvedAt: null });
  const res = await cases.findOneAndUpdate({ _id: caseId, ownerId }, { $set: set }, { returnDocument: "after" });
  if (!res) throw notFound();
  await audit(ownerId, `case.${action}`, caseId);
  return res;
}

export async function listCases(
  ownerId: string,
  opts: { view: "all" | "active" | "unresolved" | "resolved" | "archived"; q?: string; category?: string; sort: "created" | "updated" | "deadline" },
) {
  const { cases } = await collections();
  const f: Filter<CaseDoc> = { ownerId };
  if (opts.view === "archived") f.archivedAt = { $ne: null };
  else if (opts.view !== "all") f.archivedAt = null;
  if (opts.view === "active" || opts.view === "unresolved") f.status = "open";
  if (opts.view === "resolved") f.status = "resolved";
  if (opts.category) f.category = opts.category as CaseDoc["category"];
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    f.$or = [{ title: rx }, { orderRef: rx }, { customerRef: rx }, { channel: rx }];
  }
  const sort: Sort =
    opts.sort === "created" ? { createdAt: -1 } : opts.sort === "deadline" ? { deadline: 1, updatedAt: -1 } : { updatedAt: -1 };
  const rows = await cases.find(f).sort(sort).limit(200).toArray();
  // Mongo sorts missing deadlines first; push them last.
  if (opts.sort === "deadline") rows.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  return rows;
}

export async function dashboardStats(ownerId: string) {
  const { cases } = await collections();
  const soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const base = { ownerId, archivedAt: null };
  const [active, needsReview, dueSoon, total] = await Promise.all([
    cases.countDocuments({ ...base, status: "open" }),
    cases.countDocuments({ ...base, status: "open", pendingReview: { $gt: 0 } }),
    cases.countDocuments({ ...base, status: "open", deadline: { $lte: soon, $gte: new Date().toISOString().slice(0, 10) } }),
    cases.countDocuments({ ownerId }),
  ]);
  return { active, needsReview, dueSoon, total };
}

/** Removes a case and everything derived from it, including GridFS blobs. Ordered so a crash leaves no orphan metadata pointing at deleted files. */
export async function deleteCase(ownerId: string, caseId: string) {
  const c = await collections();
  await getOwnedCase(ownerId, caseId);
  const [ev, br] = await Promise.all([
    c.evidence.find({ caseId, ownerId }, { projection: { gridfsId: 1 } }).toArray(),
    c.briefings.find({ caseId, ownerId }, { projection: { gridfsId: 1 } }).toArray(),
  ]);
  await c.cases.deleteOne({ _id: caseId, ownerId });
  await Promise.all([
    c.evidence.deleteMany({ caseId, ownerId }),
    c.analyses.deleteMany({ caseId, ownerId }),
    c.briefings.deleteMany({ caseId, ownerId }),
  ]);
  await Promise.all([
    ...ev.map((e) => dropFile(c.files, e.gridfsId)),
    ...br.filter((b) => b.gridfsId).map((b) => dropFile(c.audio, b.gridfsId!)),
  ]);
  await audit(ownerId, "case.delete", caseId);
}

export async function dropFile(bucket: { delete(id: ObjectId): Promise<void> }, id: string) {
  try {
    await bucket.delete(new ObjectId(id));
  } catch {
    // Already gone — nothing to clean up.
  }
}
