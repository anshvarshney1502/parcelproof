import { z } from "zod";
import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { draftScript, resetScript, saveScript } from "@/lib/repo/briefing";

export const maxDuration = 120;
const lang = z.enum(["en", "hinglish"]);

/** Gemma drafts a script from the reviewed findings. */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/briefing/script">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const { language } = await body(req, z.object({ language: lang }));
    return json({ text: await draftScript(userId, caseId, language) });
  });
}

/** Seller edits the script by hand. */
export async function PUT(req: Request, ctx: RouteContext<"/api/cases/[caseId]/briefing/script">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const { language, text } = await body(req, z.object({ language: lang, text: z.string().trim().min(40, "The script is too short to speak.").max(1600) }));
    await saveScript(userId, caseId, language, text);
    return json({ ok: true });
  });
}

/** Back to the plain template. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/cases/[caseId]/briefing/script">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const language = lang.parse(new URL(req.url).searchParams.get("language"));
    await resetScript(userId, caseId, language);
    return json({ ok: true });
  });
}
