"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { OnboardingTour } from "./onboarding-tour";

/** Opens the walkthrough on first sign-in, or whenever ?tour=1 is in the URL. */
export function TourGate({ firstRun }: { firstRun: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const requested = params.get("tour") === "1";
  const [dismissed, setDismissed] = useState(false);
  const open = (firstRun || requested) && !dismissed;

  const close = async (completed: boolean) => {
    setDismissed(true);
    if (firstRun) await fetch("/api/onboarding", { method: "POST" }).catch(() => {});
    if (completed) router.push("/app/cases/new");
    else if (requested) router.replace(path, { scroll: false });
    router.refresh();
  };
  return <OnboardingTour open={open} onClose={close} />;
}

export function ReplayTourLink({ className = "" }: { className?: string }) {
  return (
    <a href="/app?tour=1" className={`flex items-center gap-2 text-sm text-ink-2 hover:text-ink ${className}`}>
      <PlayCircle className="size-4" aria-hidden /> Watch the walkthrough
    </a>
  );
}
