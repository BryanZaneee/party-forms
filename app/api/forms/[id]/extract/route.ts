import { NextResponse } from "next/server";
import { extractAnswers } from "@/lib/ai";
import { getForm } from "@/lib/db";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CHARS = 50_000; // ponytail: truncation over chunking — docs this size always fit context

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) return NextResponse.json({ error: "form not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "multipart 'file' field required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 5 MB)" }, { status: 413 });
  }

  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    ({ text } = await extractText(pdf, { mergePages: true }));
  } else if (name.endsWith(".txt") || name.endsWith(".md")) {
    text = await file.text();
  } else {
    return NextResponse.json({ error: "only .pdf, .txt, or .md files are supported" }, { status: 415 });
  }

  text = text.trim().slice(0, MAX_CHARS);
  if (!text) {
    return NextResponse.json(
      { error: "couldn't read any text from the document (scanned/image PDFs are not supported)" },
      { status: 422 }
    );
  }

  try {
    return NextResponse.json(await extractAnswers(form, text));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI unavailable" }, { status: 503 });
  }
}
