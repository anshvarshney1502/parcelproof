/** Browser-side fetch wrapper: surfaces the server's real error message, never a fabricated success. */
export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = data?.issues?.[0];
    throw new Error(issue ? `${issue.path || "Input"}: ${issue.message}` : data?.error || `Request failed (${res.status}).`);
  }
  return data as T;
}
