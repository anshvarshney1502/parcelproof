import { handle, json, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { markOnboarded } from "@/lib/repo/briefing";

/** Records that the user has seen (or skipped) the walkthrough. */
export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    await markOnboarded(await requireUserId());
    return json({ ok: true });
  });
}
