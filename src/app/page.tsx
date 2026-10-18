import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { SiteHeader, SiteFooter } from "@/components/landing/site-chrome";
import { HeroVisual } from "@/components/landing/hero-visual";
import { EvidenceBadge } from "@/components/ui/status";

async function signedIn() {
  try {
    return Boolean((await auth())?.user);
  } catch {
    return false;
  }
}

export default async function Home() {
  const isIn = await signedIn();
  return (
    <div className="grain min-h-dvh">
      <SiteHeader signedIn={isIn} />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-16">
          <div>
            <p className="label">Dispute preparation for independent sellers</p>
            <h1 className="mt-4 font-serif text-[2.75rem] leading-[1.02] tracking-[-0.02em] sm:text-6xl">
              Every claim needs evidence.<br />
              <span className="italic text-rust-ink">Every piece of evidence</span> needs context.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed text-ink-2">
              ParcelProof turns the invoice, tracking page, customer messages and packing photos behind a disputed order into one organised case — with every finding tied to the exact line it came from, and every uncertainty left visible.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={isIn ? "/app" : "/sign-in"} className="group inline-flex h-12 items-center gap-2 rounded-[var(--radius-mark)] bg-ink px-5 text-paper hover:bg-[#363c35]">
                {isIn ? "Open your cases" : "Start a case"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <span className="text-sm text-ink-2">Free to use · sign in with Google</span>
            </div>
          </div>
          <HeroVisual />
        </section>

        <section className="border-y border-rule bg-raised/70" aria-labelledby="how-h">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
            <h2 id="how-h" className="label">How a case comes together</h2>
            <ol className="mt-8 grid gap-10 md:grid-cols-4">
              {[
                ["Collect", "Upload PDFs, screenshots, chats and spreadsheets. Each file gets a permanent source id."],
                ["Read", "Text is extracted — including OCR for scans — and shown to you to check and correct."],
                ["Compare", "An open-weight Gemma model lists events and findings. Every quotation is verified against your files."],
                ["Decide", "You confirm, correct or dismiss each finding, listen to a spoken briefing, and export a report."],
              ].map(([t, d], i) => (
                <li key={t} className="relative">
                  <span className="font-mono text-micro text-rust-ink">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-1 font-serif text-2xl">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-labelledby="ground-h">
          <div>
            <p className="label">The distinction that matters</p>
            <h2 id="ground-h" className="mt-3 font-serif text-4xl leading-tight tracking-[-0.015em]">A message proves someone said it. Not that it happened.</h2>
            <p className="mt-4 max-w-prose leading-relaxed text-ink-2">
              A courier’s “delivered” scan doesn’t show what was inside the box. A customer’s complaint is their account, not a record. ParcelProof keeps these apart, marks what is only claimed, and never decides who is lying.
            </p>
          </div>
          {/* A static specimen of the review interface, labelled as an illustration. */}
          <figure className="rounded-[var(--radius-obj)] border border-rule bg-paper p-5 shadow-[0_18px_40px_-30px_rgba(36,41,35,0.4)]">
            <figcaption className="label mb-4 flex justify-between"><span>Illustration · how findings are shown</span><span>not real data</span></figcaption>
            {([
              ["supported", "The courier recorded the parcel as delivered and signed for.", "S2 · p.1"],
              ["unverified", "The customer reports the box was empty on opening.", "S3 · p.1"],
              ["conflicting", "Pickup weight differs from the weight on the return label.", "S2 · S4"],
              ["missing", "No photo of the item sealed inside the box.", "—"],
            ] as const).map(([s, t, ref]) => (
              <div key={t} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-rule py-3 first:border-t-0 first:pt-0">
                <EvidenceBadge status={s} />
                <div>
                  <p className="font-serif text-[1.05rem] leading-snug">{t}</p>
                  <p className="mt-0.5 font-mono text-micro text-archive-ink">{ref}</p>
                </div>
              </div>
            ))}
          </figure>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-8" aria-labelledby="trust-h">
          <div className="grid gap-8 border-t border-rule pt-10 md:grid-cols-3">
            <h2 id="trust-h" className="font-serif text-2xl">What it is careful about</h2>
            <p className="text-sm leading-relaxed text-ink-2"><span className="text-ink">Honest about data.</span> Extracted text goes to Google’s hosted Gemma API when you analyse; the briefing transcript goes to ElevenLabs when you generate audio. Files stay in this app’s database, served only to you.</p>
            <p className="text-sm leading-relaxed text-ink-2"><span className="text-ink">Honest about limits.</span> It doesn’t guarantee refunds, give legal advice or detect fraud. If a service fails, you see the failure — not a made-up result.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
