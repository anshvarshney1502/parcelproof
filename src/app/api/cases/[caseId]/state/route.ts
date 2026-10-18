import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { caseAction, id } from "@/lib/schemas";
import { setCaseState } from "@/lib/repo/cases";

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/state">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const { action } = await body(req, caseAction);
    return json({ case: await setCaseState(userId, caseId, action) });
  });
}
