import { handle, json, body, sameOrigin, notFound } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { appealInput, id } from "@/lib/schemas";
import { collections } from "@/lib/db";

export async function PUT(req: Request, ctx: RouteContext<"/api/cases/[caseId]/appeal">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const { appealDraft } = await body(req, appealInput);
    const { cases } = await collections();
    const res = await cases.updateOne({ _id: caseId, ownerId: userId }, { $set: { appealDraft, updatedAt: new Date() } });
    if (!res.matchedCount) throw notFound();
    return json({ ok: true });
  });
}
