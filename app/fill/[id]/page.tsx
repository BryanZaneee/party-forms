import { notFound } from "next/navigation";
import { getForm } from "@/lib/db";
import FillClient from "@/components/FillClient";

export const dynamic = "force-dynamic";

export default async function Fill({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) notFound();
  return <FillClient form={form} />;
}
