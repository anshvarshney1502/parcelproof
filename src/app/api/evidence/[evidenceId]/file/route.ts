import { ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { collections } from "@/lib/db";
import { getOwnedEvidence } from "@/lib/repo/evidence";
import { parseRange } from "@/lib/stream";

/** Streams the original upload to its owner only. Never a public or permanent URL. */
export async function GET(req: Request, ctx: RouteContext<"/api/evidence/[evidenceId]/file">) {
  return handle(async () => {
    const userId = await requireUserId();
    const ev = await getOwnedEvidence(userId, id.parse((await ctx.params).evidenceId));
    const { files } = await collections();
    const download = new URL(req.url).searchParams.get("download") === "1";
    // Text files are served as plain text so they can never render as HTML.
    const type = ev.kind === "text" || ev.kind === "csv" ? "text/plain; charset=utf-8" : ev.mime;
    // Byte ranges let Safari/iOS play audio evidence and seek within it.
    const range = parseRange(req.headers.get("range"), ev.size);
    const stream = Readable.toWeb(
      files.openDownloadStream(new ObjectId(ev.gridfsId), range ? { start: range.start, end: range.end + 1 } : undefined),
    ) as ReadableStream;
    return new Response(stream, {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(range ? range.end - range.start + 1 : ev.size),
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${ev.size}` } : {}),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(ev.filename)}`,
        "Cache-Control": "private, no-store",
        // Sandbox everything except PDFs, which the browser's built-in viewer must render.
        ...(ev.kind === "pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
