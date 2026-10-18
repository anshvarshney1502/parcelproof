import { HttpError } from "./http";

/**
 * Reads a multipart body with a hard byte cap, aborting as soon as it is exceeded.
 * Content-Length can be absent (chunked uploads), so it cannot be trusted on its own.
 */
export async function readFormLimited(req: Request, maxBytes: number, tooLarge: string): Promise<FormData> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) throw new HttpError(413, tooLarge, "too_large");
  if (!req.body) throw new HttpError(400, "Expected a multipart upload.", "invalid");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, tooLarge, "too_large");
    }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
  } catch {
    throw new HttpError(400, "Expected a multipart upload.", "invalid");
  }
}

/** Parses a single "bytes=a-b" Range header. Returns null when absent or unsatisfiable. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start = m[1] === "" ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] === "" || m[2] === "" ? size - 1 : Number(m[2]);
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  return start <= end ? { start, end } : null;
}
