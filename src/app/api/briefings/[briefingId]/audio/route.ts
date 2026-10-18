import { ObjectId } from "mongodb";
import { handle, HttpError } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { collections } from "@/lib/db";
import { getOwnedBriefing } from "@/lib/repo/briefing";

/** Owner-only audio. Buffered so the browser gets a Content-Length and can seek. */
export async function GET(_req: Request, ctx: RouteContext<"/api/briefings/[briefingId]/audio">) {
  return handle(async () => {
    const userId = await requireUserId();
    const b = await getOwnedBriefing(userId, id.parse((await ctx.params).briefingId));
    if (b.status !== "ready" || !b.gridfsId) throw new HttpError(404, "Audio is not available", "not_found");
    const { audio } = await collections();
    const chunks: Buffer[] = [];
    for await (const c of audio.openDownloadStream(new ObjectId(b.gridfsId))) chunks.push(c as Buffer);
    const buf = Buffer.concat(chunks);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "audio/mpeg", "Content-Length": String(buf.byteLength), "Cache-Control": "private, max-age=3600", "Accept-Ranges": "none" },
    });
  });
}
