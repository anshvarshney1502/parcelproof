import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ConfigError } from "./env";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}

export const notFound = () => new HttpError(404, "Not found", "not_found");

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps known errors to safe responses. Never returns stack traces. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
    if (err instanceof ZodError)
      return json({ error: "Invalid input", code: "invalid", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
    if (err instanceof ConfigError) return json({ error: err.message, code: "not_configured" }, 503);
    console.error("[api] unexpected error:", err instanceof Error ? err.message : "unknown");
    return json({ error: "Something went wrong on our side. Please try again.", code: "internal" }, 500);
  });
}

/** Rejects cross-site mutations (defence in depth on top of SameSite=Lax session cookies). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return;
  } catch {}
  throw new HttpError(403, "Cross-site request blocked", "forbidden");
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON", "invalid");
  }
  return schema.parse(raw);
}
