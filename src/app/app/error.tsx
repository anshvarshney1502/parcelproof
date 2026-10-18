"use client";

import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const notConfigured = /not configured/i.test(error.message);
  return (
    <div className="mx-auto max-w-xl py-10">
      <Alert tone="error" title={notConfigured ? "The server is missing configuration" : "This page couldn’t load"} action={<Button size="sm" onClick={reset}>Try again</Button>}>
        {notConfigured ? error.message : "A server error occurred. Your data has not been changed."}
        {error.digest && <span className="mt-1 block font-mono text-micro">ref {error.digest}</span>}
      </Alert>
    </div>
  );
}
