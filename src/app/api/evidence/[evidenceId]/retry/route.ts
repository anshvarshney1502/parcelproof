import { handle, json, sameOrigin, HttpError } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { getOwnedEvidence, runExtraction } from "@/lib/repo/evidence";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/evidence/[evidenceId]/retry">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const ev = await getOwnedEvidence(userId, id.parse((await ctx.params).evidenceId));
    if (ev.correctedAt) throw new HttpError(409, "This text was corrected by hand. Retrying would replace your corrections.", "corrected");
    const { pages, ...meta } = await runExtraction(ev);
    return json({ evidence: { ...meta, chars: pages.reduce((n, p) => n + p.text.length, 0) } });
  });
}
