import { randomUUID, createHash } from "node:crypto";

/** Server-generated ids; never accepted from the model or the client for new records. */
export const newId = () => randomUUID().replace(/-/g, "").slice(0, 24);
export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
export const today = () => new Date().toISOString().slice(0, 10);
