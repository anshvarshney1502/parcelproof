import { handle, json, sameOrigin, HttpError } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { limits } from "@/lib/env";
import { getOwnedCase } from "@/lib/repo/cases";
import { listEvidence, uploadEvidence } from "@/lib/repo/evidence";

export const maxDuration = 300;

export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/evidence">) {
  return handle(async () => {
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    await getOwnedCase(userId, caseId);
    const rows = await listEvidence(userId, caseId);
    return json({ evidence: rows.map(({ pages, originalPages, ...e }) => ({ ...e, chars: pages.reduce((n, p) => n + p.text.length, 0), hasOriginal: Boolean(originalPages) })) });
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/evidence">) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    // Reject oversized bodies before buffering them.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > limits.maxUploadBytes + 512 * 1024) throw new HttpError(413, `Files must be ${Math.round(limits.maxUploadBytes / 1048576)} MB or smaller.`, "too_large");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, "Expected a multipart upload.", "invalid");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file was attached.", "invalid");
    if (file.size > limits.maxUploadBytes) throw new HttpError(413, `Files must be ${Math.round(limits.maxUploadBytes / 1048576)} MB or smaller.`, "too_large");
    const doc = await uploadEvidence(userId, caseId, file.name, new Uint8Array(await file.arrayBuffer()));
    const { pages, ...meta } = doc;
    return json({ evidence: { ...meta, chars: pages.reduce((n, p) => n + p.text.length, 0) } }, 201);
  });
}
