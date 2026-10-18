"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function AppealEditor({ caseId, initial, isDefault }: { caseId: string; initial: string; isDefault: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async (value: string) => {
    setBusy(true);
    try {
      await api(`/api/cases/${caseId}/appeal`, { method: "PUT", json: { appealDraft: value } });
      setSaved(value);
      toast("ok", value ? "Draft saved — it will appear in the PDF" : "Draft reset to the generated version");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <label htmlFor="appeal" className="sr-only">Draft response</label>
      <Textarea id="appeal" rows={14} value={text} onChange={(e) => setText(e.target.value)} className="bg-white font-serif text-[1.02rem] leading-relaxed" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" loading={busy} disabled={text === saved} onClick={() => save(text)}>Save draft</Button>
        {!isDefault && <Button size="sm" variant="ghost" onClick={() => save("")}>Reset to generated</Button>}
        <span className="text-[0.8125rem] text-ink-2">{text !== saved ? "Unsaved changes — the PDF uses the saved version." : isDefault ? "Generated from your confirmed findings. Edit before sending." : "Saved."}</span>
      </div>
    </div>
  );
}
