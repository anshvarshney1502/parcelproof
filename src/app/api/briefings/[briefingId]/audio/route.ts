import { ObjectId } from "mongodb";
import { handle, HttpError } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { collections } from "@/lib/db";
import { getOwnedBriefing } from "@/lib/repo/briefing";
import { parseRange } from "@/lib/stream";

/** Owner-only audio with byte-range support (required by Safari/iOS for playback and seeking). */
export async function GET(req: Request, ctx: RouteContext<"/api/briefings/[briefingId]/audio">) {
  return handle(async () => {
    const userId = await requireUserId();
    const b = await getOwnedBriefing(userId, id.parse((await ctx.params).briefingId));
    if (b.status !== "ready" || !b.gridfsId) throw new HttpError(404, "Audio is not available", "not_found");
    const { audio } = await collections();
    const chunks: Buffer[] = [];
    for await (const c of audio.openDownloadStream(new ObjectId(b.gridfsId))) chunks.push(c as Buffer);
    const buf = Buffer.concat(chunks);
    const range = parseRange(req.headers.get("range"), buf.byteLength);
    const body = range ? buf.subarray(range.start, range.end + 1) : buf;
    return new Response(new Uint8Array(body), {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(body.byteLength),
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${buf.byteLength}` } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}
