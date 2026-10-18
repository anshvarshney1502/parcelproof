"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native <dialog>: focus trapping, Escape and inert background come from the platform. */
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dlg-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-[var(--radius-obj)] border border-rule-strong bg-raised p-0 text-ink shadow-[0_24px_60px_-24px_rgba(36,41,35,0.5)] backdrop:bg-[rgba(36,41,35,0.35)] backdrop:backdrop-blur-[1px]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
        <h2 id="dlg-title" className="font-serif text-xl leading-tight">{title}</h2>
        <button onClick={onClose} className="-mr-1 grid size-8 place-items-center rounded text-ink-2 hover:bg-sunk hover:text-ink" aria-label="Close">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-5 py-4 text-sm text-ink-2">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-rule bg-paper/60 px-5 py-3">{footer}</div>}
    </dialog>
  );
}
