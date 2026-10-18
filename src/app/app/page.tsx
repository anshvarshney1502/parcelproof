import Link from "next/link";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import { pageUser } from "@/lib/session";
import { caseQuery, CATEGORIES } from "@/lib/schemas";
import { dashboardStats, listCases } from "@/lib/repo/cases";
import { daysUntil, fmtDate, fmtRelative } from "@/lib/format";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Tag } from "@/components/ui/status";
import { Input, Select } from "@/components/ui/field";

export const metadata = { title: "Cases" };

const VIEWS = [
  ["active", "Active"],
  ["unresolved", "Unresolved"],
  ["resolved", "Resolved"],
  ["archived", "Archived"],
  ["all", "All"],
] as const;

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const user = await pageUser();
  const sp = await searchParams;
  const parsed = caseQuery.safeParse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v)));
  const q = parsed.success ? parsed.data : caseQuery.parse({});
  const [stats, cases] = await Promise.all([dashboardStats(user.id), listCases(user.id, q)]);
  const firstName = user.name.split(" ")[0];
  const filtered = Boolean(q.q || q.category);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...q, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/app?${p}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Case register</p>
          <h1 className="mt-1 font-serif text-4xl leading-[1.05] tracking-[-0.015em] sm:text-[2.75rem]">
            {firstName ? `${firstName}'s cases` : "Your cases"}
          </h1>
        </div>
        <ButtonLink href="/app/cases/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>New case</ButtonLink>
      </header>

      {stats.total > 0 && (
        <dl className="mt-8 grid grid-cols-2 border-y border-rule sm:grid-cols-4">
          {[
            ["Active", stats.active, "open, not archived"],
            ["Needs review", stats.needsReview, "findings awaiting you"],
            ["Due within 7 days", stats.dueSoon, "by response deadline"],
            ["All cases", stats.total, "including archived"],
          ].map(([label, n, sub], i) => (
            <div key={label as string} className={`px-4 py-4 first:pl-0 sm:px-6 ${i % 2 ? "border-l border-rule" : ""} ${i === 2 ? "border-t border-rule sm:border-t-0 sm:border-l sm:pl-6" : ""} ${i === 3 ? "border-t border-rule sm:border-t-0" : ""}`}>
              <dt className="label">{label}</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className={`font-serif text-4xl tabular-nums ${label === "Needs review" && Number(n) > 0 ? "text-rust-ink" : ""}`}>{n}</span>
                <span className="text-[0.8125rem] text-ink-2">{sub}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {stats.total === 0 ? (
        <div className="mt-10">
          <EmptyState
            mark="No cases yet"
            title="Open your first case file"
            action={<ButtonLink href="/app/cases/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>Create a case</ButtonLink>}
          >
            <p>A case collects everything about one disputed order: the invoice, tracking record, customer messages and photos. ParcelProof reads them, links every finding to its source and helps you prepare a reviewed report.</p>
          </EmptyState>
          <ol className="mt-8 grid gap-6 text-sm text-ink-2 sm:grid-cols-3">
            {[
              ["01", "Describe the dispute", "Order reference, dates and what the customer reported. Only what's relevant."],
              ["02", "Add the evidence", "PDFs, screenshots, CSVs and WhatsApp voice notes. Voice is transcribed by ElevenLabs Scribe."],
              ["03", "Review, then listen", "Every finding cites a quotation. Confirm it, then hear your case read back in English or Hinglish."],
            ].map(([n, t, d]) => (
              <li key={n} className="border-t border-rule pt-3">
                <span className="font-mono text-micro text-rust-ink">{n}</span>
                <p className="mt-1 font-medium text-ink">{t}</p>
                <p className="mt-1">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <section className="mt-10" aria-labelledby="list-h">
          <h2 id="list-h" className="sr-only">Case list</h2>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Case views" className="flex gap-4 overflow-x-auto">
              {VIEWS.map(([v, label]) => (
                <Link key={v} href={href({ view: v })} aria-current={q.view === v ? "page" : undefined} className={`link-underline shrink-0 py-1 text-sm ${q.view === v ? "text-ink" : "text-ink-2 hover:text-ink"}`}>
                  {label}
                </Link>
              ))}
            </nav>
            <form className="flex flex-wrap items-center gap-2" role="search">
              <input type="hidden" name="view" value={q.view} />
              <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
                <label htmlFor="q" className="sr-only">Search cases</label>
                <Input id="q" name="q" defaultValue={q.q} placeholder="Title, order, customer…" className="h-10 pl-9" />
              </div>
              <label htmlFor="category" className="sr-only">Dispute type</label>
              <Select id="category" name="category" defaultValue={q.category ?? ""} className="h-10 w-auto">
                <option value="">All dispute types</option>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <label htmlFor="sort" className="sr-only">Sort</label>
              <Select id="sort" name="sort" defaultValue={q.sort} className="h-10 w-auto">
                <option value="updated">Recently updated</option>
                <option value="created">Recently created</option>
                <option value="deadline">Deadline</option>
              </Select>
              <button className={buttonClass("secondary", "sm", "h-10")}>Apply</button>
            </form>
          </div>

          {cases.length === 0 ? (
            <div className="mt-6">
              <EmptyState mark={filtered ? "No matches" : "Nothing here"} title={filtered ? "No cases match these filters" : `No ${q.view === "all" ? "" : q.view} cases`} action={filtered ? <ButtonLink href={href({ q: undefined, category: undefined })} size="sm">Clear filters</ButtonLink> : undefined} />
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-rule border-y border-rule">
              {cases.map((c) => {
                const d = daysUntil(c.deadline);
                const urgent = c.status === "open" && d !== null && d <= 3;
                return (
                  <li key={c._id}>
                    <Link href={`/app/cases/${c._id}`} className="group grid grid-cols-1 gap-x-6 gap-y-1.5 py-4 transition-colors hover:bg-raised/70 sm:grid-cols-[minmax(0,1fr)_9rem_8rem] sm:items-center sm:px-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-serif text-[1.2rem] leading-snug text-ink">{c.title}</h3>
                          <ArrowUpRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-2">
                          <span>{CATEGORIES[c.category]}</span>
                          {c.orderRef && <span className="font-mono text-micro">#{c.orderRef}</span>}
                          {c.channel && <span>{c.channel}</span>}
                          {c.archivedAt && <Tag>Archived</Tag>}
                          {c.status === "resolved" && <Tag tone="moss">Resolved</Tag>}
                          {c.pendingReview > 0 && <Tag tone="rust">{c.pendingReview} to review</Tag>}
                        </div>
                      </div>
                      <div className="text-[0.8125rem]">
                        <span className="label sm:hidden">Deadline </span>
                        {c.deadline ? (
                          <span className={urgent ? "font-medium text-rust-ink" : "text-ink"}>
                            {fmtDate(c.deadline)}
                            <span className="block font-mono text-micro text-ink-2">{d! < 0 ? `${-d!} d overdue` : d === 0 ? "today" : `in ${d} d`}</span>
                          </span>
                        ) : <span className="text-ink-2">No deadline</span>}
                      </div>
                      <div className="font-mono text-micro text-ink-2 sm:text-right">updated {fmtRelative(c.updatedAt)}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
