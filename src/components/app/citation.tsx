"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Quote, ChevronDown, ArrowUpRight } from "lucide-react";
import type { SourceRef } from "@/lib/types";

/** A verified quotation that expands in place and links to the exact span in the source. */
export function Citation({ caseId, cite: r, tone = "plain" }: { caseId: string; cite: SourceRef; tone?: "plain" | "conflict" }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const href = `/app/cases/${caseId}/evidence?e=${r.evidenceId}&p=${r.page}&s=${r.start}&t=${r.end}`;
  return (
    <div className={`border-l-2 pl-3 ${tone === "conflict" ? "border-rust" : "border-archive"}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group flex w-full items-start gap-2 text-left">
        <Quote className="mt-1 size-3 shrink-0 text-ink-3" aria-hidden />
        <span className={`flex-1 font-serif text-[0.975rem] italic leading-snug text-ink ${open ? "" : "line-clamp-2"}`}>{r.quote}</span>
        <ChevronDown className={`mt-1 size-3.5 shrink-0 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="pt-1.5 text-[0.8125rem] text-ink-2">Verified: this exact text appears in {r.sourceId}, page {r.page}. It shows what the document says — not that the statement is true.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <Link href={href} className="mt-1 inline-flex items-center gap-1 font-mono text-micro text-archive-ink hover:underline">
        {r.sourceId} · p.{r.page} · {r.start}–{r.end}
        <ArrowUpRight className="size-3" aria-hidden />
      </Link>
    </div>
  );
}
