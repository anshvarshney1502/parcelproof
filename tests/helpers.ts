import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { setTestDb } from "@/lib/db";
import type { ModelClient } from "@/lib/ai/gemma";
import type { TtsClient } from "@/lib/voice/tts";

let server: MongoMemoryReplSet;
let client: MongoClient;

export async function startDb() {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(server.getUri()).connect();
  setTestDb(client.db("pp_test"));
}
export async function resetDb() {
  await client.db("pp_test").dropDatabase();
  setTestDb(client.db("pp_test"));
}
export async function stopDb() {
  setTestDb(undefined);
  await client?.close();
  await server?.stop();
}

/** Scripted model double: returns queued replies or throws queued errors. Test-only. */
export function fakeModel(replies: (string | Error)[]): ModelClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    modelId: "gemma-test-double",
    calls,
    async generate(prompt) {
      calls.push(prompt);
      const next = replies.shift();
      if (next === undefined) throw new Error("fakeModel: no reply queued");
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

export function fakeTts(fail?: Error): TtsClient & { calls: number } {
  const t = {
    voiceId: "voice-test",
    modelId: "eleven_multilingual_v2",
    calls: 0,
    async synthesize() {
      t.calls++;
      if (fail) throw fail;
      return new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4]);
    },
  };
  return t;
}

export const enc = (s: string) => new TextEncoder().encode(s);

export const CUSTOMER_MSG = `From: customer
Date: 2026-09-14
The parcel arrived but the box was empty when I opened it. I want a full refund.`;

export const TRACKING_TXT = `Tracking ID BX4421
2026-09-12 10:02 Shipment picked up from seller
2026-09-13 18:40 Delivered - signed by R. Kumar
Package weight at pickup: 1.2 kg`;
