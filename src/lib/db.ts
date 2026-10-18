import { MongoClient, GridFSBucket, type Db } from "mongodb";
import { config } from "./env";
import type { CaseDoc, EvidenceDoc, AnalysisDoc, BriefingDoc, UsageDoc, AuditDoc, SettingsDoc } from "./types";

type G = { _ppClient?: Promise<MongoClient>; _ppIndexes?: Promise<void>; _ppTestDb?: Db };
const g = globalThis as unknown as G;

/** Shared client, reused across hot reloads and route invocations. */
export function getClient(): Promise<MongoClient> {
  if (!g._ppClient) {
    const { uri } = config.mongo();
    g._ppClient = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 }).connect();
    g._ppClient.catch(() => { g._ppClient = undefined; });
  }
  return g._ppClient;
}

/** Tests inject an in-memory database here. */
export function setTestDb(db: Db | undefined) {
  g._ppTestDb = db;
  g._ppIndexes = undefined;
}

export async function getDb(): Promise<Db> {
  const db = g._ppTestDb ?? (await getClient()).db(config.mongo().dbName);
  if (!g._ppIndexes) {
    g._ppIndexes = ensureIndexes(db);
    g._ppIndexes.catch(() => { g._ppIndexes = undefined; });
  }
  await g._ppIndexes;
  return db;
}

export async function collections() {
  const db = await getDb();
  return {
    db,
    cases: db.collection<CaseDoc>("cases"),
    evidence: db.collection<EvidenceDoc>("evidence"),
    analyses: db.collection<AnalysisDoc>("analyses"),
    briefings: db.collection<BriefingDoc>("briefings"),
    usage: db.collection<UsageDoc>("usage"),
    audit: db.collection<AuditDoc>("audit_events"),
    settings: db.collection<SettingsDoc>("settings"),
    files: new GridFSBucket(db, { bucketName: "evidence_files" }),
    audio: new GridFSBucket(db, { bucketName: "briefing_audio" }),
  };
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("cases").createIndexes([
      { key: { ownerId: 1, createdAt: -1 } },
      { key: { ownerId: 1, updatedAt: -1 } },
      { key: { ownerId: 1, status: 1, archivedAt: 1 } },
      { key: { ownerId: 1, deadline: 1 } },
    ]),
    db.collection("evidence").createIndexes([
      { key: { caseId: 1, uploadedAt: 1 } },
      { key: { ownerId: 1 } },
      { key: { caseId: 1, sha256: 1 }, unique: true },
    ]),
    db.collection("analyses").createIndexes([{ key: { caseId: 1, version: -1 }, unique: true }]),
    db.collection("briefings").createIndexes([
      { key: { cacheKey: 1 } },
      { key: { caseId: 1, createdAt: -1 } },
    ]),
    db.collection("usage").createIndexes([{ key: { ownerId: 1, kind: 1, day: 1 }, unique: true }]),
    db.collection("audit_events").createIndexes([{ key: { ownerId: 1, at: -1 } }]),
    db.collection("settings").createIndexes([{ key: { ownerId: 1 }, unique: true }]),
  ]);
}
