import { notFound } from "next/navigation";
import { pageUser } from "./session";
import { getOwnedCase } from "./repo/cases";
import { HttpError } from "./http";

/** Page-level case loader: another user's case renders the same 404 as a missing one. */
export async function loadCase(caseId: string) {
  const user = await pageUser();
  try {
    return { user, kase: await getOwnedCase(user.id, caseId) };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}

