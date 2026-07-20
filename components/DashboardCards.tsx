"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Form } from "@/lib/types";
import { fmtDate } from "./format";
import Toast, { useToast } from "./Toast";

export default function DashboardCards({ forms }: { forms: (Form & { submission_count: number })[] }) {
  const router = useRouter();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [toast, toastMsg] = useToast();

  const copyLink = (id: string) => {
    navigator.clipboard?.writeText(`${location.origin}/fill/${id}`);
    setMenuId(null);
    toastMsg("Fill link copied to clipboard");
  };

  const del = async (f: Form) => {
    if (!confirm(`Delete “${f.title}” and its responses?`)) return;
    await fetch(`/api/forms/${f.id}`, { method: "DELETE" });
    setMenuId(null);
    router.refresh();
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
        {forms.map((f) => (
          <div
            key={f.id}
            style={{
              position: "relative",
              background: "#fff",
              border: "1px solid #e2e7f0",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: "0 1px 2px rgba(15,25,50,.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <Link href={`/forms/${f.id}`} style={{ fontSize: 17, fontWeight: 600, color: "#0e1524" }}>
                {f.title}
              </Link>
              <div style={{ fontSize: 12, color: "#7a8699", whiteSpace: "nowrap" }} suppressHydrationWarning>
                {fmtDate(f.created_at)}
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: "#5c6b82", lineHeight: 1.45, minHeight: 20 }}>{f.description}</div>
            <div style={{ fontSize: 12.5, color: "#7a8699" }}>
              {f.questions.length} question{f.questions.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
              <Link
                href={`/fill/${f.id}`}
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 7,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Fill out
              </Link>
              <Link
                href={`/forms/${f.id}`}
                className="btn-outline"
                style={{
                  background: "#fff",
                  color: "#22304a",
                  border: "1px solid #d5dce8",
                  borderRadius: 7,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                Responses ({f.submission_count})
              </Link>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setMenuId(menuId === f.id ? null : f.id)}
                className="btn-outline"
                style={{
                  background: "#fff",
                  color: "#5c6b82",
                  border: "1px solid #d5dce8",
                  borderRadius: 7,
                  padding: "8px 11px",
                  fontSize: 13,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ⋯
              </button>
            </div>
            {menuId === f.id && (
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 56,
                  background: "#fff",
                  border: "1px solid #e2e7f0",
                  borderRadius: 10,
                  boxShadow: "0 10px 30px rgba(10,20,50,.14)",
                  padding: 6,
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 150,
                  zIndex: 10,
                }}
              >
                <button
                  onClick={() => copyLink(f.id)}
                  className="menu-item"
                  style={{
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    fontSize: 13.5,
                    color: "#22304a",
                    padding: "8px 12px",
                    borderRadius: 7,
                    cursor: "pointer",
                  }}
                >
                  Copy share link
                </button>
                <button
                  onClick={() => del(f)}
                  className="menu-item-danger"
                  style={{
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    fontSize: 13.5,
                    color: "#c0392b",
                    padding: "8px 12px",
                    borderRadius: 7,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Toast text={toast} />
    </>
  );
}
