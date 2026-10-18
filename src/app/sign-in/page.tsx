import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Wordmark } from "@/components/brand";
import { config } from "@/lib/env";
import { Alert } from "@/components/ui/feedback";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/app") ? sp.next : "/app";
  const session = await auth().catch(() => null);
  if (session?.user) redirect(next);
  const ready = config.status().auth && config.status().mongo;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <div className="grain grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/"><Wordmark /></Link>
        <div className="my-auto max-w-sm py-16">
          <p className="label">Sign in</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight tracking-[-0.015em]">Open your case files</h1>
          <p className="mt-3 text-ink-2">Use your Google account. ParcelProof only receives your name, email address and profile picture.</p>
          {error && <div className="mt-6"><Alert tone="error" title="Sign-in did not complete">Please try again. ({error})</Alert></div>}
          {!ready ? (
            <div className="mt-8"><Alert tone="warn" title="Sign-in is not configured on this server">The operator needs to set AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and MONGODB_URI. See the README.</Alert></div>
          ) : (
            <form className="mt-8" action={async () => { "use server"; await signIn("google", { redirectTo: next }); }}>
              <button className="flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-mark)] border border-rule-strong bg-raised text-[0.9375rem] font-medium text-ink shadow-[0_1px_0_var(--rule)] transition-colors hover:border-ink-2 hover:bg-white">
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
                Continue with Google
              </button>
            </form>
          )}
          <p className="mt-6 text-[0.8125rem] text-ink-2">By continuing you agree to the <Link href="/terms" className="underline">terms</Link> and acknowledge the <Link href="/privacy" className="underline">privacy notice</Link>.</p>
        </div>
      </div>
      <aside className="hidden border-l border-rule bg-raised lg:flex lg:flex-col lg:justify-end lg:p-12">
        <blockquote className="max-w-md">
          <p className="font-serif text-3xl leading-snug">“A quotation’s presence proves the text exists in the source — not that the source proves the interpretation.”</p>
          <footer className="label mt-4">The ParcelProof review principle</footer>
        </blockquote>
      </aside>
    </div>
  );
}
