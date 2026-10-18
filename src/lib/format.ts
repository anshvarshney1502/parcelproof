export function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtRelative(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 30 ? `${days} d ago` : fmtDate(new Date(d));
}

/** Days until a YYYY-MM-DD deadline (UTC). Negative when overdue. */
export function daysUntil(day?: string) {
  if (!day) return null;
  const target = Date.parse(`${day}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / 864e5);
}

export function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

/** Plain JSON for passing Mongo documents to client components. */
export const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
