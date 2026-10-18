import { collections } from "../db";
import { HttpError } from "../http";
import { today } from "../ids";
import type { UsageDoc } from "../types";

/** Atomically reserves one unit of daily quota, or throws 429. */
export async function consume(ownerId: string, kind: UsageDoc["kind"], limit: number) {
  const { usage } = await collections();
  const day = today();
  await usage.updateOne({ ownerId, kind, day }, { $setOnInsert: { count: 0 } }, { upsert: true });
  const res = await usage.findOneAndUpdate(
    { ownerId, kind, day, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  );
  if (!res) throw new HttpError(429, `Daily limit reached (${limit} per day). It resets at midnight UTC.`, "limit");
}

/** Returns a unit when the provider call failed before doing billable work. */
export async function refund(ownerId: string, kind: UsageDoc["kind"]) {
  const { usage } = await collections();
  await usage.updateOne({ ownerId, kind, day: today(), count: { $gt: 0 } }, { $inc: { count: -1 } });
}

export async function usageToday(ownerId: string) {
  const { usage } = await collections();
  const rows = await usage.find({ ownerId, day: today() }).toArray();
  const get = (k: UsageDoc["kind"]) => rows.find((r) => r.kind === k)?.count ?? 0;
  return { ai: get("ai"), tts: get("tts"), stt: get("stt"), upload: get("upload") };
}

export async function audit(ownerId: string, action: string, targetId?: string) {
  const { audit } = await collections();
  await audit.insertOne({ ownerId, action, targetId, at: new Date() });
}
