import os from "node:os";
import Papa from "papaparse";
import type { EvidenceDoc, PageText } from "../types";

export type Extraction = {
  pages: PageText[];
  pageCount: number;
  method: NonNullable<EvidenceDoc["method"]>;
  warnings: string[];
};

export class ExtractionFailed extends Error {}

const MAX_CHARS = 200_000;
const MAX_PDF_PAGES = 50;
const MAX_OCR_PAGES = 8;
const OCR_TIMEOUT_MS = 60_000;

export async function extractText(kind: EvidenceDoc["kind"], bytes: Uint8Array): Promise<Extraction> {
  let result: Extraction;
  if (kind === "text") result = { pages: [{ page: 1, text: decode(bytes) }], pageCount: 1, method: "text", warnings: [] };
  else if (kind === "csv") result = { pages: [{ page: 1, text: csvToText(decode(bytes)) }], pageCount: 1, method: "text", warnings: [] };
  else if (kind === "image") result = { pages: [{ page: 1, text: await ocr(bytes) }], pageCount: 1, method: "ocr", warnings: [] };
  else result = await extractPdf(bytes);

  let budget = MAX_CHARS;
  for (const p of result.pages) {
    p.text = p.text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, Math.max(0, budget));
    budget -= p.text.length;
  }
  if (budget <= 0) result.warnings.push(`Text was truncated to ${MAX_CHARS.toLocaleString()} characters.`);
  if (!result.pages.some((p) => p.text.length >= 3)) {
    throw new ExtractionFailed(
      kind === "image" || result.method !== "pdf-text"
        ? "No readable text was found. The image may be blurry, rotated, or contain no text. You can type the relevant text manually."
        : "No readable text was found in this document.",
    );
  }
  return result;
}

const decode = (b: Uint8Array) => new TextDecoder("utf-8").decode(b).replace(/^﻿/, "");

/** Renders CSV rows as labelled lines. Cells are treated as inert text; formula prefixes are neutralised. */
export function csvToText(src: string) {
  const parsed = Papa.parse<string[]>(src, { skipEmptyLines: true });
  const rows = parsed.data.slice(0, 2000);
  if (!rows.length) return "";
  const [head, ...rest] = rows;
  const inert = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  if (!rest.length) return head.map(inert).join(" | ");
  return rest
    .map((r, i) => `Row ${i + 1}: ` + r.map((cell, j) => `${inert(head[j] ?? `Column ${j + 1}`)}: ${inert(cell ?? "")}`).join(" | "))
    .join("\n");
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, rej) => (t = setTimeout(() => rej(new ExtractionFailed(`${label} timed out`)), ms)))]);
  } finally {
    clearTimeout(t);
  }
}

async function ocr(image: Uint8Array): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { cachePath: os.tmpdir() });
  try {
    const { data } = await withTimeout(worker.recognize(Buffer.from(image)), OCR_TIMEOUT_MS, "Text recognition");
    return data.text ?? "";
  } catch (e) {
    if (e instanceof ExtractionFailed) throw e;
    throw new ExtractionFailed("Text recognition failed for this image.");
  } finally {
    await worker.terminate().catch(() => {});
  }
}

async function extractPdf(bytes: Uint8Array): Promise<Extraction> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    await task.destroy().catch(() => {});
    throw new ExtractionFailed("This PDF could not be opened. It may be damaged or password-protected.");
  }
  const warnings: string[] = [];
  const pages: PageText[] = [];
  const count = doc.numPages;
  const n = Math.min(count, MAX_PDF_PAGES);
  if (count > n) warnings.push(`Only the first ${n} of ${count} pages were processed.`);
  let ocrUsed = 0;
  let textPages = 0;
  try {
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("");
      if (text.replace(/\s/g, "").length >= 20) textPages++;
      else if (ocrUsed < MAX_OCR_PAGES) {
        ocrUsed++;
        try {
          text = await ocr(await renderPage(page));
        } catch {
          warnings.push(`Page ${i} looks scanned and could not be read.`);
          text = "";
        }
      } else {
        warnings.push(`Page ${i} looks scanned; OCR was skipped (limit ${MAX_OCR_PAGES} pages).`);
        text = "";
      }
      pages.push({ page: i, text });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return { pages, pageCount: count, method: ocrUsed === 0 ? "pdf-text" : textPages === 0 ? "pdf-ocr" : "mixed", warnings };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPage(page: any): Promise<Uint8Array> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toBuffer("image/png");
}
