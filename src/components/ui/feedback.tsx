import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

const tones = {
  info: { cls: "border-[#c5d2dc] bg-info-bg text-archive-ink", Icon: Info },
  warn: { cls: "border-[#e6d1a6] bg-warn-bg text-warn", Icon: AlertTriangle },
  error: { cls: "border-[#e0bcb5] bg-err-bg text-err", Icon: XCircle },
  ok: { cls: "border-[#c4d6c1] bg-ok-bg text-ok", Icon: CheckCircle2 },
};

export function Alert({ tone = "info", title, children, action }: { tone?: keyof typeof tones; title?: string; children?: ReactNode; action?: ReactNode }) {
  const t = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-[var(--radius-obj)] border px-4 py-3 text-sm ${t.cls}`}>
      <t.Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-ink-2 [&_a]:underline">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Empty state drawn as an index card with a ruled margin — not a generic icon-in-a-circle. */
export function EmptyState({ title, children, action, mark = "—" }: { title: string; children?: ReactNode; action?: ReactNode; mark?: string }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-obj)] border border-dashed border-rule-strong bg-raised/60 px-6 py-10 sm:px-10">
      <div aria-hidden className="absolute inset-y-0 left-12 w-px bg-[#ecd5cc] sm:left-16" />
      <div className="relative pl-10 sm:pl-12">
        <p className="font-mono text-micro uppercase tracking-[0.1em] text-ink-2">{mark}</p>
        <h3 className="mt-1 font-serif text-2xl leading-tight text-ink">{title}</h3>
        {children && <div className="mt-2 max-w-prose text-ink-2">{children}</div>}
        {action && <div className="mt-5 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 border-b border-rule pb-2">
      <h2 className="label">{children}</h2>
      {aside}
    </div>
  );
}
