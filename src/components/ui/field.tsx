import { forwardRef, type ComponentProps, type ReactNode } from "react";

const control =
  "w-full rounded-[var(--radius-mark)] border border-rule-strong bg-raised px-3 text-[0.9375rem] text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-archive focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 aria-[invalid=true]:border-err";

export function Field({ label, htmlFor, optional, hint, error, children, className = "" }: { label: string; htmlFor: string; optional?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  const hintId = `${htmlFor}-hint`;
  const errId = `${htmlFor}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="font-mono text-micro font-normal tracking-wide text-ink-2">optional</span>}
      </label>
      {children}
      {hint && !error && <p id={hintId} className="text-[0.8125rem] leading-snug text-ink-2">{hint}</p>}
      {error && <p id={errId} role="alert" className="text-[0.8125rem] leading-snug text-err">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className = "", ...p }, ref) {
  return <input ref={ref} {...p} className={`${control} h-11 ${className}`} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className = "", ...p }, ref) {
  return <select ref={ref} {...p} className={`${control} h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%2362665f%22 stroke-width=%221.5%22><path d=%22M3 4.5l3 3 3-3%22/></svg>')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9 ${className}`} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className = "", ...p }, ref) {
  return <textarea ref={ref} {...p} className={`${control} py-2.5 leading-relaxed ${className}`} />;
});
