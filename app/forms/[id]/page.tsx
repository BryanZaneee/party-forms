import Link from "next/link";
import { notFound } from "next/navigation";
import { getForm, listSubmissions } from "@/lib/db";
import Hero from "@/components/Hero";
import ResponsesClient from "@/components/ResponsesClient";

export const dynamic = "force-dynamic";

export default async function Responses({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) notFound();
  const submissions = listSubmissions(id);
  return (
    <div style={{ minHeight: "100vh" }}>
      <Hero padding="20px 28px 24px">
        <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
          ← All forms
        </Link>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginTop: 10 }}>{form.title} — Responses</div>
        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.65)", marginTop: 4 }}>
          {submissions.length} response{submissions.length === 1 ? "" : "s"}
        </div>
      </Hero>
      <ResponsesClient form={form} submissions={submissions} />
    </div>
  );
}
