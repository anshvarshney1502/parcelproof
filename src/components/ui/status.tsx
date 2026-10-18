import { CheckCircle2, CircleDashed, CircleSlash, Split, Loader2, AlertTriangle, FileCheck2, PenLine } from "lucide-react";
import type { EvidenceStatus } from "@/lib/schemas";

const EV: Record<EvidenceStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  supported: { label: "Supported", cls: "text-ok bg-ok-bg border-[#c4d6c1]", Icon: CheckCircle2 },
  conflicting: { label: "Conflicting", cls: "text-rust-ink bg-[#f6e4dc] border-[#e3c0b2]", Icon: Split },
  unverified: { label: "Unverified", cls: "text-warn bg-warn-bg border-[#e6d1a6]", Icon: CircleDashed },
  missing: { label: "Missing", cls: "text-archive-ink bg-info-bg border-[#c5d2dc]", Icon: CircleSlash },
};

const chip = "inline-flex items-center gap-1.5 rounded-[var(--radius-mark)] border px-1.5 py-0.5 font-mono text-micro uppercase tracking-[0.06em]";

/** Evidence-review status. Always icon + text — never colour alone. */
export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const s = EV[status];
  return (
    <span className={`${chip} ${s.cls}`}>
      <s.Icon className="size-3" aria-hidden />
      {s.label}
    </span>
  );
}

export function ExtractionBadge({ status, corrected, audio }: { status: "processing" | "extracted" | "failed"; corrected?: boolean; audio?: boolean }) {
  if (status === "processing")
    return <span className={`${chip} border-rule text-ink-2`}><Loader2 className="size-3 animate-spin" aria-hidden />{audio ? "Transcribing" : "Processing"}</span>;
  if (status === "failed")
    return <span className={`${chip} border-[#e0bcb5] bg-err-bg text-err`}><AlertTriangle className="size-3" aria-hidden />{audio ? "Transcription failed" : "Extraction failed"}</span>;
  return corrected ? (
    <span className={`${chip} border-[#c5d2dc] bg-info-bg text-archive-ink`}><PenLine className="size-3" aria-hidden />Text corrected</span>
  ) : (
    <span className={`${chip} border-[#c4d6c1] bg-ok-bg text-ok`}><FileCheck2 className="size-3" aria-hidden />{audio ? "Transcribed" : "Text extracted"}</span>
  );
}

export function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "rust" | "moss" | "archive" }) {
  const t = { plain: "border-rule text-ink-2", rust: "border-[#e3c0b2] text-rust-ink", moss: "border-[#cfd2c2] text-moss-ink", archive: "border-[#c5d2dc] text-archive-ink" }[tone];
  return <span className={`${chip} ${t}`}>{children}</span>;
}

export const STATUS_HELP: Record<EvidenceStatus, string> = {
  supported: "A cited record directly shows this.",
  conflicting: "Two records disagree on this point.",
  unverified: "Someone said it; no independent record confirms it.",
  missing: "Information that would matter is absent.",
};
