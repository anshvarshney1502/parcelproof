"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { UploadCloud, FileText, Check, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { fmtBytes } from "@/lib/format";

type Item = { id: number; name: string; size: number; phase: "queued" | "uploading" | "processing" | "done" | "error"; progress: number; message?: string };

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv";
const OK_EXT = /\.(pdf|png|jpe?g|webp|txt|csv)$/i;

/**
 * Upload dropzone. Progress reflects real bytes sent (XHR upload events); "Reading text" is shown
 * while the server extracts and only resolves when the server responds.
 */
export function Dropzone({ caseId, maxBytes, remaining, disabled }: { caseId: string; maxBytes: number; remaining: number; disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const reduce = useReducedMotion();
  const busy = items.some((i) => i.phase === "uploading" || i.phase === "processing" || i.phase === "queued");

  const patch = (id: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const send = (file: File, id: number) =>
    new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/cases/${caseId}/evidence`);
      xhr.upload.onprogress = (e) => e.lengthComputable && patch(id, { phase: "uploading", progress: e.loaded / e.total });
      xhr.upload.onload = () => patch(id, { phase: "processing", progress: 1 });
      xhr.onload = () => {
        let data: { error?: string; evidence?: { status: string; error?: string; sourceId: string } } = {};
        try { data = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300 && data.evidence) {
          const ev = data.evidence;
          if (ev.status === "failed") patch(id, { phase: "error", message: `Saved as ${ev.sourceId}, but text extraction failed: ${ev.error}` });
          else patch(id, { phase: "done", message: `Saved as ${ev.sourceId}` });
        } else patch(id, { phase: "error", message: data.error ?? `Upload failed (${xhr.status}).` });
        resolve();
      };
      xhr.onerror = () => { patch(id, { phase: "error", message: "Network error during upload." }); resolve(); };
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    if (list.length > remaining) toast("error", `This case can take ${remaining} more file(s).`);
    const queued: [File, Item][] = list.slice(0, Math.max(remaining, 0)).map((f, i) => {
      const bad = !OK_EXT.test(f.name) ? "Unsupported type. Use PDF, PNG, JPG, WebP, TXT or CSV." : f.size > maxBytes ? `Larger than ${fmtBytes(maxBytes)}.` : f.size === 0 ? "The file is empty." : undefined;
      return [f, { id: Date.now() + i, name: f.name, size: f.size, phase: bad ? "error" : "queued", progress: 0, message: bad }];
    });
    setItems((xs) => [...queued.map(([, it]) => it), ...xs].slice(0, 12));
    for (const [f, it] of queued) if (it.phase === "queued") await send(f, it.id);
    router.refresh();
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) addFiles(e.dataTransfer.files); }}
        className={`relative overflow-hidden rounded-[var(--radius-obj)] border border-dashed transition-colors ${over ? "border-archive bg-info-bg" : "border-rule-strong bg-raised/60"} ${disabled ? "opacity-60" : ""}`}
      >
        <motion.div aria-hidden animate={over && !reduce ? { y: -3 } : { y: 0 }} className="pointer-events-none absolute right-6 top-5 hidden h-16 w-12 rotate-3 rounded-[3px] border border-rule-strong bg-paper shadow-sm sm:block">
          <div className="mx-2 mt-3 space-y-1.5">{[70, 90, 55, 80].map((w) => <div key={w} className="h-px bg-rule-strong" style={{ width: `${w}%` }} />)}</div>
        </motion.div>
        <div className="flex flex-col items-start gap-3 px-6 py-7 sm:px-8">
          <UploadCloud className="size-5 text-archive-ink" aria-hidden />
          <div>
            <p className="font-medium text-ink">{over ? "Drop to add to this case" : "Drag evidence files here"}</p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-2">PDF, PNG, JPG, WebP, TXT or CSV · up to {fmtBytes(maxBytes)} each · {remaining} slot(s) left in this case</p>
          </div>
          <button type="button" disabled={disabled || remaining <= 0 || busy} onClick={() => input.current?.click()} className="h-10 rounded-[var(--radius-mark)] border border-rule-strong bg-paper px-3.5 text-sm text-ink hover:border-ink-2 disabled:opacity-50">
            Choose files
          </button>
          <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      <ul className="mt-3 space-y-1.5" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li key={it.id} initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-3 rounded-[var(--radius-mark)] border border-rule bg-raised px-3 py-2 text-sm">
                <span className="shrink-0">
                  {it.phase === "done" ? <Check className="size-4 text-ok" aria-hidden /> : it.phase === "error" ? <AlertTriangle className="size-4 text-err" aria-hidden /> : <FileText className="size-4 text-ink-2" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-ink">{it.name}</span>
                    <span className="shrink-0 font-mono text-micro text-ink-2">
                      {it.phase === "uploading" ? `${Math.round(it.progress * 100)}%` : it.phase === "processing" ? "reading text…" : it.phase === "queued" ? "queued" : fmtBytes(it.size)}
                    </span>
                  </div>
                  {(it.phase === "uploading" || it.phase === "processing") && (
                    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-sunk" role="progressbar" aria-label={`Uploading ${it.name}`} aria-valuenow={Math.round(it.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className={`h-full bg-archive transition-[width] duration-200 ${it.phase === "processing" ? "animate-pulse" : ""}`} style={{ width: `${it.progress * 100}%` }} />
                    </div>
                  )}
                  {it.message && <p className={`mt-0.5 text-[0.8125rem] ${it.phase === "error" ? "text-err" : "text-ink-2"}`}>{it.message}</p>}
                </div>
                {(it.phase === "done" || it.phase === "error") && (
                  <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} className="grid size-7 place-items-center rounded text-ink-2 hover:bg-sunk" aria-label={`Dismiss ${it.name}`}>
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
