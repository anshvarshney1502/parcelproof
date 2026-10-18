import { z } from "zod";
import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id, textCorrection } from "@/lib/schemas";
import { correctText, deleteEvidence, getOwnedEvidence, updateLabel } from "@/lib/repo/evidence";

export async function GET(_req: Request, ctx: RouteContext<"/api/evidence/[evidenceId]">) {
  return handle(async () => {
    const userId = await requireUserId();
    return json({ evidence: await getOwnedEvidence(userId, id.parse((await ctx.params).evidenceId)) });
  });
}

const patch = z.union([textCorrection, z.object({ label: z.string().trim().max(80) })]);

export async function PATCH(req: Request, ctx: RouteContext<"/api/evidence/[evidenceId]">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const evidenceId = id.parse((await ctx.params).evidenceId);
    const input = await body(req, patch);
    if ("pages" in input) await correctText(userId, evidenceId, input.pages);
    else await updateLabel(userId, evidenceId, input.label);
    return json({ evidence: await getOwnedEvidence(userId, evidenceId) });
  });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/evidence/[evidenceId]">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    await deleteEvidence(userId, id.parse((await ctx.params).evidenceId));
    return json({ ok: true });
  });
}
