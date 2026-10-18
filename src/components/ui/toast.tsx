"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X, AlertTriangle } from "lucide-react";

type Toast = { id: number; tone: "ok" | "error"; text: string };
const Ctx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** Stacked toasts announced politely to screen readers. Shown only after real server responses. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const reduce = useReducedMotion();
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-[var(--radius-obj)] border border-[#3a4039] bg-ink px-3.5 py-2.5 text-sm text-paper shadow-[0_8px_24px_-12px_rgba(36,41,35,0.6)]"
            >
              {t.tone === "ok" ? (
                <motion.span initial={reduce ? false : { scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className="mt-0.5 grid size-4 place-items-center rounded-full bg-[#9fbf98] text-ink">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </motion.span>
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#f0b9a6]" aria-hidden />
              )}
              <span className="flex-1">{t.text}</span>
              <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="-mr-1 grid size-6 place-items-center rounded text-[#b8bcb3] hover:text-paper" aria-label="Dismiss">
                <X className="size-3.5" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
