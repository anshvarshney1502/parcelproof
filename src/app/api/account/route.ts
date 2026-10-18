import { z } from "zod";
import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { deleteAccountData } from "@/lib/repo/account";

export async function DELETE(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    await body(req, z.object({ confirm: z.literal("DELETE") }));
    await deleteAccountData(userId);
    return json({ ok: true });
  });
}
