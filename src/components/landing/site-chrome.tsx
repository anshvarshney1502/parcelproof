import Link from "next/link";
import { Wordmark } from "@/components/brand";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
      <Link href="/" aria-label="ParcelProof home"><Wordmark /></Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/privacy" className="link-underline hidden text-ink-2 hover:text-ink sm:inline">Privacy</Link>
        <Link href={signedIn ? "/app" : "/sign-in"} className="inline-flex h-10 items-center rounded-[var(--radius-mark)] bg-ink px-4 text-paper hover:bg-[#363c35]">
          {signedIn ? "Open workspace" : "Sign in"}
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-serif italic">Every claim needs evidence. Every piece of evidence needs context.</p>
        <nav className="flex gap-5">
          <Link href="/privacy" className="link-underline hover:text-ink">Privacy</Link>
          <Link href="/terms" className="link-underline hover:text-ink">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
