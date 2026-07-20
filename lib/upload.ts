import { extractFileText } from "./ai.ts";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CHARS = 50_000;

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export type UploadReadResult =
  | { ok: true; kind: "text"; text: string }
  | { ok: true; kind: "image"; dataUrl: string }
  | { ok: false; error: string; status: 400 | 413 | 415 | 422 | 503 };

/**
 * Shared upload reader for extract + creator draft uploads. Text comes from
 * .txt/.md (local), .pdf (unpdf), or .docx/.doc (Moonshot file-extract, needs
 * the API key). Images are returned as data URLs for K3 vision, only where
 * the caller opts in (fill/extract route — the creator draft stays text-only).
 */
export async function readUpload(file: File, opts?: { image?: boolean }): Promise<UploadReadResult> {
  if (!(file instanceof File)) return { ok: false, error: "multipart 'file' field required", status: 400 };
  if (file.size > MAX_BYTES) return { ok: false, error: "file too large (max 5 MB)", status: 413 };

  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));
  if (opts?.image && ext in IMAGE_MIME) {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return { ok: true, kind: "image", dataUrl: `data:${IMAGE_MIME[ext]};base64,${b64}` };
  }

  let text: string;
  if (ext === ".pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    ({ text } = await extractText(pdf, { mergePages: true }));
  } else if (ext === ".txt" || ext === ".md") {
    text = await file.text();
  } else if (ext === ".docx" || ext === ".doc") {
    try {
      text = await extractFileText(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "document extraction failed", status: 503 };
    }
  } else {
    return {
      ok: false,
      error: opts?.image
        ? "only .pdf, .txt, .md, .docx/.doc, or image (.png/.jpg/.webp/.gif) files are supported"
        : "only .pdf, .txt, .md, or .docx/.doc files are supported",
      status: 415,
    };
  }

  text = text.trim().slice(0, MAX_CHARS);
  if (!text) {
    return {
      ok: false,
      error: "couldn't read any text from the document (scanned/image PDFs are not supported)",
      status: 422,
    };
  }
  return { ok: true, kind: "text", text };
}
