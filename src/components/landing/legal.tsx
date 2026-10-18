import { auth } from "@/auth";
import { SiteHeader, SiteFooter } from "./site-chrome";

export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  const signedIn = Boolean(await auth().catch(() => null));
  return (
    <div className="min-h-dvh">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto max-w-3xl px-4 pt-10 sm:px-8">
        <p className="label">Last updated {updated}</p>
        <h1 className="mt-2 font-serif text-5xl tracking-[-0.015em]">{title}</h1>
        <div className="mt-10 space-y-8 leading-relaxed text-ink-2 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink [&_h2]:mb-2 [&_li]:mt-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
