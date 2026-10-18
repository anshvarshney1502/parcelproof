"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SlideConfirm } from "@/components/ui/slide-confirm";
import { useToast } from "@/components/ui/toast";

export function PreferencesForm({ initial }: { initial: { language: "en" | "hinglish"; voiceStyle: "calm" | "balanced" } }) {
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = v.language !== initial.language || v.voiceStyle !== initial.voiceStyle;
  const opt = <K extends keyof typeof v>(k: K, value: (typeof v)[K], label: string, hint: string) => (
    <label className={`flex cursor-pointer gap-3 rounded-[var(--radius-mark)] border px-3 py-2.5 transition-colors ${v[k] === value ? "border-ink bg-raised" : "border-rule hover:border-rule-strong"}`}>
      <input type="radio" name={k} checked={v[k] === value} onChange={() => setV({ ...v, [k]: value })} className="mt-1 accent-[var(--ink)]" />
      <span><span className="block text-sm text-ink">{label}</span><span className="block text-[0.8125rem] text-ink-2">{hint}</span></span>
    </label>
  );
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Default briefing language</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {opt("language", "en", "English", "Plain, calm English.")}
          {opt("language", "hinglish", "Hinglish", "Conversational Hindi-English mix in Roman script.")}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Voice delivery</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {opt("voiceStyle", "calm", "Calm", "Steadier, slightly slower delivery.")}
          {opt("voiceStyle", "balanced", "Balanced", "A little more natural variation.")}
        </div>
        <p className="mt-2 text-[0.8125rem] text-ink-2">Changing these creates new audio next time; existing audio stays until replaced.</p>
      </fieldset>
      <Button variant="primary" size="sm" disabled={!dirty} loading={busy} onClick={async () => {
        setBusy(true);
        try { await api("/api/settings", { method: "PUT", json: v }); toast("ok", "Preferences saved"); router.refresh(); }
        catch (e) { toast("error", (e as Error).message); }
        finally { setBusy(false); }
      }}>Save preferences</Button>
    </div>
  );
}

export function DeleteAccount() {
  const toast = useToast();
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <label htmlFor="confirm-del" className="block text-sm text-ink-2">Type <span className="font-mono text-ink">DELETE</span> to enable</label>
      <Input id="confirm-del" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="max-w-xs font-mono" />
      {typed === "DELETE" && (
        <div className="max-w-md">
          <SlideConfirm label="Slide to delete everything" busy={busy} onConfirm={async () => {
            setBusy(true);
            try {
              await api("/api/account", { method: "DELETE", json: { confirm: "DELETE" } });
              router.replace("/");
              router.refresh();
            } catch (e) {
              toast("error", (e as Error).message);
              setBusy(false);
            }
          }} />
        </div>
      )}
    </div>
  );
}
