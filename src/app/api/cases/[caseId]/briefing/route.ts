import { z } from "zod";
import { handle, json, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { generateBriefing, previewBriefing } from "@/lib/repo/briefing";

export const maxDuration = 120;
const lang = z.enum(["en", "hinglish"]).optional();

export async function GET(req: Request, ctx: RouteContext<"/api/cases/[caseId]/briefing">) {
  return handle(async () => {
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const language = lang.parse(new URL(req.url).searchParams.get("language") ?? undefined);
    return json(await previewBriefing(userId, caseId, language));
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/briefing">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const { language } = z.object({ language: lang }).parse(await req.json().catch(() => ({})));
    return json(await generateBriefing(userId, caseId, language));
  });
}
