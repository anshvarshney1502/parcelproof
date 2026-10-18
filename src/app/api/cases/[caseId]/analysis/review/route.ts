import { z } from "zod";
import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { eventReview, findingReview, id } from "@/lib/schemas";
import { confirmAllSupported, reviewEvent, reviewFinding } from "@/lib/repo/analysis";

export async function PATCH(req: Request, ctx: RouteContext<"/api/cases/[caseId]/analysis/review">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const input = await body(req, z.union([findingReview, eventReview, z.object({ bulk: z.literal("confirm-supported") })]));
    if ("bulk" in input) return json({ confirmed: await confirmAllSupported(userId, caseId) });
    if ("findingId" in input) {
      const a = await reviewFinding(userId, caseId, input);
      return json({ finding: a?.findings.find((f) => f.id === input.findingId) });
    }
    await reviewEvent(userId, caseId, input.eventId, input.decision);
    return json({ ok: true });
  });
}
