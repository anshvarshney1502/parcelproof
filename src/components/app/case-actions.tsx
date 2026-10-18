"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckCheck, RotateCcw, Trash2, Pencil } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SlideConfirm } from "@/components/ui/slide-confirm";
import { useToast } from "@/components/ui/toast";

export function CaseActions({ caseId, archived, resolved, title }: { caseId: string; archived: boolean; resolved: boolean; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string>();
  const [confirm, setConfirm] = useState(false);

  const act = async (action: "archive" | "restore" | "resolve" | "reopen") => {
    setBusy(action);
    try {
      await api(`/api/cases/${caseId}/state`, { method: "POST", json: { action } });
      toast("ok", { archive: "Case archived", restore: "Case restored", resolve: "Marked resolved", reopen: "Case reopened" }[action]);
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await api(`/api/cases/${caseId}`, { method: "DELETE" });
      toast("ok", "Case and its files deleted");
      router.push("/app");
      router.refresh();
    } catch (e) {
      toast("error", (e as Error).message);
      setBusy(undefined);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href={`/app/cases/${caseId}?edit=1`} size="sm" variant="ghost" icon={<Pencil className="size-3.5" aria-hidden />}>Edit</ButtonLink>
      {resolved ? (
        <Button size="sm" variant="ghost" loading={busy === "reopen"} onClick={() => act("reopen")} icon={<RotateCcw className="size-3.5" aria-hidden />}>Reopen</Button>
      ) : (
        <Button size="sm" variant="ghost" loading={busy === "resolve"} onClick={() => act("resolve")} icon={<CheckCheck className="size-3.5" aria-hidden />}>Mark resolved</Button>
      )}
      {archived ? (
        <Button size="sm" variant="ghost" loading={busy === "restore"} onClick={() => act("restore")} icon={<ArchiveRestore className="size-3.5" aria-hidden />}>Restore</Button>
      ) : (
        <Button size="sm" variant="ghost" loading={busy === "archive"} onClick={() => act("archive")} icon={<Archive className="size-3.5" aria-hidden />}>Archive</Button>
      )}
      <Button size="sm" variant="ghost" className="text-err hover:bg-err-bg hover:text-err" onClick={() => setConfirm(true)} icon={<Trash2 className="size-3.5" aria-hidden />}>Delete</Button>

      <Dialog open={confirm} onClose={() => !busy && setConfirm(false)} title="Delete this case?">
        <p>
          <span className="text-ink">“{title}”</span> will be permanently removed with all evidence files, extracted text, analyses, briefings and audio. This cannot be undone.
        </p>
        <p className="mt-2">If you might need it later, archive it instead.</p>
        <div className="mt-5"><SlideConfirm label="Slide to delete permanently" onConfirm={remove} busy={busy === "delete"} /></div>
      </Dialog>
    </div>
  );
}
