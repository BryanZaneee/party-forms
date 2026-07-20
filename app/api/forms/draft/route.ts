import { NextResponse } from "next/server";
import { draftFormTurn } from "@/lib/ai";
import { normalizeQuestions } from "@/lib/validate";
import { readUpload } from "@/lib/upload";
import type { Question } from "@/lib/types";

export async function POST(req: Request) {
  const ctype = req.headers.get("content-type") ?? "";
  let messages: { role: "user" | "assistant"; content: string }[] = [];
  let title = "";
  let description = "";
  let questions: Question[] = [];
  let documentText: string | undefined;

  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const messagesRaw = form.get("messages");
      if (typeof messagesRaw === "string") {
        const parsed = JSON.parse(messagesRaw) as unknown;
        if (Array.isArray(parsed)) {
          messages = parsed
            .filter(
              (m): m is { role: "user" | "assistant"; content: string } =>
                !!m &&
                (m.role === "user" || m.role === "assistant") &&
                typeof m.content === "string"
            )
            .map((m) => ({ role: m.role, content: m.content }));
        }
      }
      if (typeof form.get("title") === "string") title = String(form.get("title"));
      if (typeof form.get("description") === "string") description = String(form.get("description"));
      const qRaw = form.get("questions");
      if (typeof qRaw === "string") {
        const normalized = normalizeQuestions(JSON.parse(qRaw));
        if (normalized) questions = normalized;
      }
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const doc = await readUpload(file);
        if (!doc.ok) return NextResponse.json({ error: doc.error }, { status: doc.status });
        if (doc.kind === "text") documentText = doc.text;
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "JSON or multipart body required" }, { status: 400 });
      }
      if (Array.isArray(body.messages)) {
        messages = body.messages
          .filter(
            (m: unknown): m is { role: "user" | "assistant"; content: string } =>
              !!m &&
              typeof m === "object" &&
              ((m as { role?: string }).role === "user" || (m as { role?: string }).role === "assistant") &&
              typeof (m as { content?: unknown }).content === "string"
          )
          .map((m: { role: "user" | "assistant"; content: string }) => ({
            role: m.role,
            content: m.content,
          }));
      }
      if (typeof body.title === "string") title = body.title;
      if (typeof body.description === "string") description = body.description;
      if (body.questions !== undefined) {
        const normalized = normalizeQuestions(body.questions);
        if (normalized) questions = normalized;
      }
      if (typeof body.documentText === "string" && body.documentText.trim()) {
        documentText = body.documentText.trim().slice(0, 50_000);
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (messages.length === 0 && !documentText) {
    return NextResponse.json({ error: "messages or document required" }, { status: 400 });
  }

  try {
    const result = await draftFormTurn(messages, { title, description, questions }, documentText);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI unavailable" }, { status: 503 });
  }
}
