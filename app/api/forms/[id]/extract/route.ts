import { NextResponse } from "next/server";
import { extractAnswers } from "@/lib/ai";
import { getForm } from "@/lib/db";
import { readUploadText } from "@/lib/upload";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) return NextResponse.json({ error: "form not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "multipart 'file' field required" }, { status: 400 });
  }

  const read = await readUploadText(file);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });

  try {
    return NextResponse.json(await extractAnswers(form, read.text));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI unavailable" }, { status: 503 });
  }
}
