import { NextResponse } from "next/server";
import { generateForm } from "@/lib/ai";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "description string required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await generateForm(description));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI unavailable" }, { status: 503 });
  }
}
