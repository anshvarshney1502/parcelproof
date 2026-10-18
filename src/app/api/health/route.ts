/** Liveness probe for uptime monitors. No auth, no database: cheap enough to call every few minutes. */
export function GET() {
  return Response.json({ ok: true, service: "parcelproof" }, { headers: { "Cache-Control": "no-store" } });
}

export const HEAD = GET;
