import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadCase } from "@/lib/load-case";
import { CATEGORIES } from "@/lib/schemas";
import { fmtDate, daysUntil } from "@/lib/format";
import { CaseTabs } from "@/components/app/nav";
import { CaseActions } from "@/components/app/case-actions";
import { Tag } from "@/components/ui/status";

export default async function CaseLayout({ children, params }: LayoutProps<"/app/cases/[caseId]">) {
  const { caseId } = await params;
  const { kase } = await loadCase(caseId);
  const d = daysUntil(kase.deadline);
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app" className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-2 hover:text-ink"><ChevronLeft className="size-3.5" aria-hidden />All cases</Link>
      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-micro text-ink-2">
            <span className="uppercase tracking-[0.08em]">{CATEGORIES[kase.category]}</span>
            {kase.orderRef && <span>· #{kase.orderRef}</span>}
            {kase.archivedAt && <Tag>Archived</Tag>}
            {kase.status === "resolved" && <Tag tone="moss">Resolved</Tag>}
            {kase.deadline && kase.status === "open" && (
              <Tag tone={d !== null && d <= 3 ? "rust" : "plain"}>Due {fmtDate(kase.deadline)}{d !== null && d < 0 ? " · overdue" : ""}</Tag>
            )}
          </div>
          <h1 className="mt-1.5 font-serif text-3xl leading-tight tracking-[-0.015em] sm:text-4xl">{kase.title}</h1>
        </div>
        <CaseActions caseId={kase._id} archived={Boolean(kase.archivedAt)} resolved={kase.status === "resolved"} title={kase.title} />
      </header>
      <div className="mt-6"><CaseTabs caseId={kase._id} pending={kase.pendingReview} /></div>
      <div className="pt-8">{children}</div>
    </div>
  );
}
