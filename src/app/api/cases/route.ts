import { handle, json, body, sameOrigin } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { caseInput, caseQuery } from "@/lib/schemas";
import { createCase, listCases } from "@/lib/repo/cases";

export async function GET(req: Request) {
  return handle(async () => {
    const userId = await requireUserId();
    const q = caseQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json({ cases: await listCases(userId, q) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const userId = await requireUserId();
    const doc = await createCase(userId, await body(req, caseInput));
    return json({ case: doc }, 201);
  });
}
