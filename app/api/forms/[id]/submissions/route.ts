import { NextResponse } from "next/server";
import { createSubmission, getForm } from "@/lib/db";
import { validateAnswers } from "@/lib/validate";
import type { Answers } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) return NextResponse.json({ error: "form not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const raw = body?.answers;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "answers object required" }, { status: 400 });
  }

  // Keep only known question ids with string values.
  const answers: Answers = {};
  for (const q of form.questions) {
    if (typeof raw[q.id] === "string") answers[q.id] = raw[q.id].trim();
  }

  const { ok, missing, invalid } = validateAnswers(form.questions, answers);
  if (!ok) {
    return NextResponse.json({ error: "validation failed", missing, invalid }, { status: 400 });
  }
  return NextResponse.json({ id: createSubmission(id, answers) }, { status: 201 });
}
