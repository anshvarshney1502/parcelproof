import { handle, json, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { deleteBriefing } from "@/lib/repo/briefing";

export async function DELETE(req: Request, ctx: RouteContext<"/api/briefings/[briefingId]">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    await deleteBriefing(userId, id.parse((await ctx.params).briefingId));
    return json({ ok: true });
  });
}
