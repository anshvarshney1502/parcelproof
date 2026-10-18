"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "framer-motion";
import { ChevronsRight, Loader2 } from "lucide-react";

/**
 * Slide-to-confirm for destructive actions. Dragging is optional: the handle is a real button,
 * and Enter/Space or a click on it confirms too, so it never depends on a drag gesture.
 */
export function SlideConfirm({ label, onConfirm, busy }: { label: string; onConfirm: () => void; busy?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const reduce = useReducedMotion();
  const [max, setMax] = useState(0);
  const fill = useTransform(x, (v) => `${(max ? v / max : 0) * 100}%`);
  const textOpacity = useTransform(x, [0, 120], [1, 0.15]);

  const measure = () => setMax((track.current?.offsetWidth ?? 0) - 48);
  return (
    <div ref={track} onPointerEnter={measure} onFocus={measure} className="relative h-12 w-full select-none overflow-hidden rounded-[var(--radius-obj)] border border-[#d9b4ab] bg-err-bg">
      <motion.div style={{ width: fill }} className="absolute inset-y-0 left-0 bg-[#ecc7bd]" aria-hidden />
      <motion.span style={{ opacity: textOpacity }} className="pointer-events-none absolute inset-0 grid place-items-center pl-10 text-sm font-medium text-err">
        {busy ? "Deleting…" : label}
      </motion.span>
      <motion.button
        type="button"
        drag={busy || reduce ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() > max * 0.85) {
            animate(x, max, { duration: 0.12 });
            onConfirm();
          } else animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
        }}
        onClick={() => x.get() < 4 && onConfirm()}
        disabled={busy}
        aria-label={`${label} — activate to confirm`}
        className="absolute left-1 top-1 grid size-10 cursor-grab place-items-center rounded-[4px] bg-err text-white shadow-sm active:cursor-grabbing"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ChevronsRight className="size-4" aria-hidden />}
      </motion.button>
    </div>
  );
}
