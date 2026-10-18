import type { EvidenceDoc } from "../types";

export class FileRejected extends Error {}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/**
 * Determines the real file type from its bytes. The browser-declared MIME type is advisory only:
 * a mismatch between extension and signature is rejected.
 */
export function detectFile(bytes: Uint8Array, filename: string): { kind: EvidenceDoc["kind"]; mime: string } {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (startsWith(bytes, ascii("%PDF-"))) {
    if (ext !== "pdf") throw new FileRejected("File contents are a PDF but the name does not end in .pdf");
    return { kind: "pdf", mime: "application/pdf" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return img(ext, ["png"], "image/png");
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return img(ext, ["jpg", "jpeg"], "image/jpeg");
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return img(ext, ["webp"], "image/webp");

  // Audio: voice notes and call recordings, transcribed by ElevenLabs Scribe.
  const audio = (allowed: string[], mime: string) => {
    if (!allowed.includes(ext)) throw new FileRejected(`File contents are ${mime} but the extension is .${ext}`);
    return { kind: "audio" as const, mime };
  };
  if (startsWith(bytes, ascii("ID3")) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && ext === "mp3")) return audio(["mp3"], "audio/mpeg");
  if (startsWith(bytes, ascii("OggS"))) return audio(["ogg", "opus", "oga"], "audio/ogg");
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WAVE"), 8)) return audio(["wav"], "audio/wav");
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return audio(["webm"], "audio/webm");
  if (startsWith(bytes, ascii("ftyp"), 4) && ["m4a", "aac", "mp4"].includes(ext)) return audio(["m4a", "aac", "mp4"], "audio/mp4");

  if (ext === "txt" || ext === "csv") {
    if (bytes.includes(0)) throw new FileRejected("This looks like a binary file, not plain text");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new FileRejected("Text files must be UTF-8 encoded");
    }
    return ext === "csv" ? { kind: "csv", mime: "text/csv" } : { kind: "text", mime: "text/plain" };
  }
  throw new FileRejected("Unsupported file type. Upload PDF, PNG, JPG, WebP, TXT, CSV, or a voice note (MP3, M4A, OGG/Opus, WAV, WebM).");
}

function img(ext: string, allowed: string[], mime: string) {
  if (!allowed.includes(ext)) throw new FileRejected(`File contents are ${mime} but the extension is .${ext}`);
  return { kind: "image" as const, mime };
}

export function safeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(-120);
}
