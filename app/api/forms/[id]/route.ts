import { NextResponse } from "next/server";
import { deleteForm } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!deleteForm(id)) return NextResponse.json({ error: "form not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
