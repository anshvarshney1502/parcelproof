import { pageUser } from "@/lib/session";
import { CaseForm } from "@/components/app/case-form";

export const metadata = { title: "New case" };

export default async function NewCase() {
  await pageUser();
  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div>
        <p className="label">New case file</p>
        <h1 className="mt-1 font-serif text-4xl leading-tight tracking-[-0.015em]">Describe the dispute</h1>
        <p className="mt-2 max-w-prose text-ink-2">Only the title and dispute type are required. Everything else helps the analysis line up dates, but you can add it later.</p>
        <div className="mt-8"><CaseForm /></div>
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-10 border-l border-rule pl-5 text-sm text-ink-2">
          <p className="label mb-2">What happens next</p>
          <p>After saving, you’ll add evidence files. ParcelProof extracts their text so you can check it before any analysis runs.</p>
          <p className="mt-3">Nothing is sent to an AI service until you choose <span className="text-ink">Analyse evidence</span>.</p>
        </div>
      </aside>
    </div>
  );
}
