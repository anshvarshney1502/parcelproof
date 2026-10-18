import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { pageUser } from "@/lib/session";
import { Wordmark } from "@/components/brand";
import { RailNav, MobileNav } from "@/components/app/nav";
import { ToastProvider } from "@/components/ui/toast";
import { Suspense } from "react";
import { TourGate, ReplayTourLink } from "@/components/app/tour-gate";
import { getSettings } from "@/lib/repo/briefing";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await pageUser();
  const settings = await getSettings(user.id);
  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };
  const initials = (user.name || user.email || "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-raised focus:px-3 focus:py-2">Skip to content</a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule bg-paper px-4 py-5 lg:flex">
          <Link href="/app" className="mb-8 px-2"><Wordmark /></Link>
          <RailNav />
          <ReplayTourLink className="mt-auto mb-3 px-3" />
          <div className="border-t border-rule pt-4">
            <div className="flex items-center gap-3 px-2">
              <span aria-hidden className="grid size-8 place-items-center rounded-full border border-rule-strong bg-raised font-mono text-[0.6875rem] text-ink-2">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{user.name || "Signed in"}</p>
                <p className="truncate font-mono text-micro text-ink-2">{user.email}</p>
              </div>
            </div>
            <form action={signOutAction} className="mt-3">
              <button className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-mark)] px-2 text-sm text-ink-2 hover:bg-sunk hover:text-ink">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </aside>

        <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 px-4 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between">
            <Link href="/app"><Wordmark /></Link>
            <form action={signOutAction}>
              <button className="grid size-10 place-items-center rounded text-ink-2 hover:bg-sunk" aria-label="Sign out"><LogOut className="size-4" aria-hidden /></button>
            </form>
          </div>
          <div className="pb-2"><MobileNav /></div>
        </header>

        <Suspense fallback={null}><TourGate firstRun={!settings.onboardedAt} /></Suspense>
        <main id="main" className="min-w-0 px-4 pb-24 pt-6 sm:px-8 lg:px-12 lg:pt-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
