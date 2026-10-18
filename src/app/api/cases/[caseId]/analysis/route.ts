import { z } from "zod";
import { handle, json, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { analysisHistory, analysisState, startAnalysis } from "@/lib/repo/analysis";

export const maxDuration = 300;

export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/analysis">) {
  return handle(async () => {
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const { current, latest, stale } = await analysisState(userId, caseId);
    return json({ current, latest, stale, history: await analysisHistory(userId, caseId) });
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/analysis">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const raw = await req.json().catch(() => ({}));
    const { force } = z.object({ force: z.boolean().optional() }).parse(raw);
    return json(await startAnalysis(userId, caseId, { force }));
  });
}
