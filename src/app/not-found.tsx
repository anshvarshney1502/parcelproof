import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-md">
        <p className="label">404 · not on file</p>
        <h1 className="mt-2 font-serif text-4xl">This page isn’t in the archive</h1>
        <p className="mt-3 text-ink-2">It may have been deleted, or it belongs to a different account.</p>
        <Link href="/app" className="mt-6 inline-block underline">Back to your cases</Link>
      </div>
    </main>
  );
}
