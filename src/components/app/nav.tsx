"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, FilePlus2, Settings2 } from "lucide-react";

const LINKS = [
  { href: "/app", label: "Cases", Icon: FolderOpen, match: (p: string) => p === "/app" || (p.startsWith("/app/cases/") && !p.endsWith("/new")) },
  { href: "/app/cases/new", label: "New case", Icon: FilePlus2, match: (p: string) => p === "/app/cases/new" },
  { href: "/app/settings", label: "Settings", Icon: Settings2, match: (p: string) => p.startsWith("/app/settings") },
];

export function RailNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {LINKS.map(({ href, label, Icon, match }) => {
        const active = match(path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-10 items-center gap-3 rounded-[var(--radius-mark)] px-3 text-sm transition-colors ${active ? "bg-raised text-ink" : "text-ink-2 hover:text-ink hover:bg-sunk/70"}`}
          >
            <span aria-hidden className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-colors ${active ? "bg-rust" : "bg-transparent"}`} />
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, label, Icon, match }) => {
        const active = match(path);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-mark)] px-3 text-sm ${active ? "bg-raised text-ink shadow-[inset_0_-2px_0_var(--rust)]" : "text-ink-2"}`}>
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CaseTabs({ caseId, pending }: { caseId: string; pending: number }) {
  const path = usePathname();
  const base = `/app/cases/${caseId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/evidence`, label: "Evidence" },
    { href: `${base}/timeline`, label: "Timeline" },
    { href: `${base}/review`, label: "Review", count: pending },
    { href: `${base}/briefing`, label: "Briefing" },
    { href: `${base}/report`, label: "Report" },
  ];
  return (
    <nav aria-label="Case sections" className="-mb-px flex gap-5 overflow-x-auto border-b border-rule [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`relative flex h-11 shrink-0 items-center gap-1.5 text-sm transition-colors ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}>
            {t.label}
            {!!t.count && <span className="rounded-[var(--radius-mark)] bg-rust-ink px-1 font-mono text-[0.625rem] leading-4 text-white" aria-label={`${t.count} to review`}>{t.count}</span>}
            <span aria-hidden className={`absolute inset-x-0 -bottom-px h-[2px] origin-left bg-ink transition-transform duration-200 ${active ? "scale-x-100" : "scale-x-0"}`} />
          </Link>
        );
      })}
    </nav>
  );
}
