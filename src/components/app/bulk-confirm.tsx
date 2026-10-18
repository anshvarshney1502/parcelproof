"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** One click for the easy part of review: findings a record directly supports and that passed validation. */
export function BulkConfirm({ caseId, count }: { caseId: string; count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!count) return null;
  return (
    <Button size="sm" variant="secondary" loading={busy} icon={<CheckCheck className="size-3.5" aria-hidden />} onClick={async () => {
      setBusy(true);
      try {
        const r = await api<{ confirmed: number }>(`/api/cases/${caseId}/analysis/review`, { method: "PATCH", json: { bulk: "confirm-supported" } });
        toast("ok", `Confirmed ${r.confirmed} supported finding(s)`);
        router.refresh();
      } catch (e) {
        toast("error", (e as Error).message);
      } finally {
        setBusy(false);
      }
    }}>
      Confirm {count} supported
    </Button>
  );
}
