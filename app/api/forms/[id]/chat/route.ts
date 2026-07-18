import { NextResponse } from "next/server";
import { chatTurn } from "@/lib/ai";
import { getForm } from "@/lib/db";
import type { Answers } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) return NextResponse.json({ error: "form not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const history = Array.isArray(body?.messages)
    ? body.messages.filter(
        (m: { role?: unknown; content?: unknown }) =>
          (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string"
      )
    : null;
  if (!history || history.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const current: Answers = {};
  if (body?.answers && typeof body.answers === "object") {
    for (const q of form.questions) {
      if (typeof body.answers[q.id] === "string") current[q.id] = body.answers[q.id];
    }
  }

  try {
    return NextResponse.json(await chatTurn(form, history, current));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI unavailable" }, { status: 503 });
  }
}
