import { Check, X } from "lucide-react";
import { pageUser } from "@/lib/session";
import { getSettings } from "@/lib/repo/briefing";
import { usageToday } from "@/lib/repo/usage";
import { collections } from "@/lib/db";
import { config, limits } from "@/lib/env";
import { fmtBytes } from "@/lib/format";
import { PreferencesForm, DeleteAccount } from "@/components/app/settings-form";
import { ReplayTourLink } from "@/components/app/tour-gate";

export const metadata = { title: "Settings" };

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-rule py-8 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="font-serif text-xl">{title}</h2>
        {desc && <p className="mt-1 text-sm text-ink-2">{desc}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await pageUser();
  const { evidence, cases } = await collections();
  const [s, usage, storage, caseCount] = await Promise.all([
    getSettings(user.id),
    usageToday(user.id),
    evidence.aggregate<{ total: number; n: number }>([{ $match: { ownerId: user.id } }, { $group: { _id: null, total: { $sum: "$size" }, n: { $sum: 1 } } }]).toArray(),
    cases.countDocuments({ ownerId: user.id }),
  ]);
  const used = storage[0]?.total ?? 0;
  const st = config.status();
  const meter = (label: string, n: number, max: number, fmt = (x: number) => String(x)) => (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="font-mono text-micro text-ink-2">{fmt(n)} / {fmt(max)}</span></div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunk" role="meter" aria-label={label} aria-valuenow={n} aria-valuemin={0} aria-valuemax={max}><div className={`h-full ${n / max > 0.85 ? "bg-rust" : "bg-moss"}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <p className="label">Account</p>
      <h1 className="mt-1 font-serif text-4xl tracking-[-0.015em]">Settings</h1>

      <div className="mt-8">
        <Section title="Account" desc="Signed in with Google.">
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-ink-2">Name</dt><dd>{user.name || "—"}</dd>
            <dt className="text-ink-2">Email</dt><dd className="break-all">{user.email}</dd>
            <dt className="text-ink-2">Cases</dt><dd>{caseCount}</dd>
          </dl>
        </Section>

        <Section title="Voice briefing" desc="Defaults for new briefings.">
          <PreferencesForm initial={{ language: s.language, voiceStyle: s.voiceStyle }} />
          <ReplayTourLink className="mt-6" />
        </Section>

        <Section title="Usage" desc="Daily limits reset at midnight UTC. They protect free-tier quotas.">
          <div className="space-y-4">
            {meter("Evidence analyses today", usage.ai, limits.aiDailyLimit)}
            {meter("Voice generations today", usage.tts, limits.ttsDailyLimit)}
            {meter("Evidence storage", used, limits.maxUserStorageBytes, fmtBytes)}
          </div>
        </Section>

        <Section title="Services" desc="What this server is configured to use. Keys are never shown.">
          <ul className="space-y-2 text-sm">
            {[
              [st.gemma, `Gemma analysis (${st.gemmaModel}) via Google Gemini API`],
              [st.voice, "ElevenLabs voice briefings"],
              [st.mongo, "MongoDB Atlas storage"],
            ].map(([ok, label]) => (
              <li key={label as string} className="flex items-center gap-2">
                {ok ? <Check className="size-4 text-ok" aria-hidden /> : <X className="size-4 text-err" aria-hidden />}
                <span>{label}</span><span className="sr-only">{ok ? "configured" : "not configured"}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Your data" desc="Where your information goes.">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            <li>Files and extracted text are stored in this app’s MongoDB Atlas database and are only served to you.</li>
            <li>When you analyse a case, extracted text is sent to Google’s hosted Gemma API.</li>
            <li>When you generate audio, the briefing transcript is sent to ElevenLabs.</li>
            <li>Deleting a case removes its files, analyses and audio.</li>
          </ul>
        </Section>

        <Section title="Delete account data" desc="Permanently removes every case, file, analysis, audio briefing, usage record and your sign-in record.">
          <DeleteAccount />
        </Section>
      </div>
    </div>
  );
}
