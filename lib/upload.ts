const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CHARS = 50_000;

export type UploadReadResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: 400 | 413 | 415 | 422 };

/** Shared PDF/TXT/MD text extraction for extract + creator draft uploads. */
export async function readUploadText(file: File): Promise<UploadReadResult> {
  if (!(file instanceof File)) return { ok: false, error: "multipart 'file' field required", status: 400 };
  if (file.size > MAX_BYTES) return { ok: false, error: "file too large (max 5 MB)", status: 413 };

  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    ({ text } = await extractText(pdf, { mergePages: true }));
  } else if (name.endsWith(".txt") || name.endsWith(".md")) {
    text = await file.text();
  } else {
    return { ok: false, error: "only .pdf, .txt, or .md files are supported", status: 415 };
  }

  text = text.trim().slice(0, MAX_CHARS);
  if (!text) {
    return {
      ok: false,
      error: "couldn't read any text from the document (scanned/image PDFs are not supported)",
      status: 422,
    };
  }
  return { ok: true, text };
}
