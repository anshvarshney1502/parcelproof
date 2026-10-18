import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HttpError } from "./http";

/** For route handlers: resolves the authenticated user id or throws 401. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new HttpError(401, "Sign in required", "unauthenticated");
  return userId;
}

/** For server components: redirects to sign-in when there is no session. */
export async function pageUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return { id: session.user.id, name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null };
}
