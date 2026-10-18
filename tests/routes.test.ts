import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

describe("route authentication", () => {
  it("returns 401 for unauthenticated API access", async () => {
    const cases = await import("@/app/api/cases/route");
    const one = await import("@/app/api/cases/[caseId]/route");
    const file = await import("@/app/api/evidence/[evidenceId]/file/route");
    const audio = await import("@/app/api/briefings/[briefingId]/audio/route");
    const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
    const responses = await Promise.all([
      cases.GET(new Request("http://x/api/cases")),
      one.GET(new Request("http://x/api/cases/abcdef123"), params({ caseId: "abcdef123" }) as never),
      file.GET(new Request("http://x/api/evidence/abcdef123/file"), params({ evidenceId: "abcdef123" }) as never),
      audio.GET(new Request("http://x/api/briefings/abcdef123/audio"), params({ briefingId: "abcdef123" }) as never),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(await responses[0].json()).toMatchObject({ code: "unauthenticated" });
  });

  it("blocks cross-site mutations before touching data", async () => {
    const cases = await import("@/app/api/cases/route");
    const res = await cases.POST(new Request("http://app.test/api/cases", { method: "POST", headers: { origin: "https://evil.example", host: "app.test" }, body: "{}" }));
    expect(res.status).toBe(403);
  });
});
