import { NextResponse } from "next/server";
import { createForm } from "@/lib/db";
import { normalizeQuestions } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const questions = normalizeQuestions(body?.questions);
  if (!title || !questions) {
    return NextResponse.json(
      { error: "title and a questions array (labels required, choice types need ≥2 options) are required" },
      { status: 400 }
    );
  }
  return NextResponse.json({ id: createForm(title, questions) }, { status: 201 });
}
