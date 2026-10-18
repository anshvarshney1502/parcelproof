import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { caseUpdate, id } from "@/lib/schemas";
import { deleteCase, getOwnedCase, updateCase } from "@/lib/repo/cases";

export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]">) {
  return handle(async () => {
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    return json({ case: await getOwnedCase(userId, caseId) });
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/cases/[caseId]">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    return json({ case: await updateCase(userId, caseId, await body(req, caseUpdate)) });
  });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/cases/[caseId]">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    await deleteCase(userId, id.parse((await ctx.params).caseId));
    return json({ ok: true });
  });
}
