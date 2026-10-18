export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" role="status" aria-label="Loading">
      <div className="h-3 w-24 rounded bg-sunk" />
      <div className="mt-3 h-9 w-72 rounded bg-sunk" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-[var(--radius-obj)] border border-rule bg-raised" />)}
      </div>
    </div>
  );
}
