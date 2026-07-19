import { NextResponse } from "next/server";
import { createSubmission, getForm } from "@/lib/db";
import { coerceAnswers, validateAnswers } from "@/lib/validate";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) return NextResponse.json({ error: "form not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const raw = body?.answers;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "answers object required" }, { status: 400 });
  }

  const answers = coerceAnswers(form.questions, raw);
  const via = body?.via === "ai" ? "ai" : "form";

  const { ok, missing, invalid } = validateAnswers(form.questions, answers);
  if (!ok) {
    return NextResponse.json({ error: "validation failed", missing, invalid }, { status: 400 });
  }
  return NextResponse.json({ id: createSubmission(id, answers, via) }, { status: 201 });
}
