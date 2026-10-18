/** Wordmark: a folded parcel corner beside a serif name. */
export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="3.5" y="5.5" width="17" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 9.5h17M12 5.5v4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14.5 14.5l1.6 1.6 3.2-3.4" stroke="var(--rust)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <Mark />
      <span className="font-serif text-[1.3rem] font-medium tracking-[-0.01em]">
        Parcel<span className="italic text-rust-ink">Proof</span>
      </span>
    </span>
  );
}
