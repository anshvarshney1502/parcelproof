import { handle, HttpError } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { id } from "@/lib/schemas";
import { analysisState } from "@/lib/repo/analysis";
import { audit } from "@/lib/repo/usage";
import { reportContent } from "@/lib/report/content";
import { renderReportPdf } from "@/lib/report/pdf";

export const maxDuration = 60;

/** Builds the PDF from saved, reviewed data on every request — no client-supplied content. */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/report">) {
  return handle(async () => {
    const userId = await requireUserId();
    const caseId = id.parse((await ctx.params).caseId);
    const { kase, current, evidence } = await analysisState(userId, caseId);
    if (!current) throw new HttpError(409, "Run and review an analysis before exporting a report.", "no_analysis");
    if (!current.findings.some((f) => f.review === "confirmed" || f.review === "corrected"))
      throw new HttpError(409, "Confirm or correct at least one finding before exporting.", "needs_review");
    const pdf = await renderReportPdf(reportContent(kase, current, evidence));
    await audit(userId, "report.export", caseId);
    const slug = (kase.orderRef || kase.title).replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "case";
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="parcelproof-${slug}-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  });
}
