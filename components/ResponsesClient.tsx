"use client";

import { useRef, useState } from "react";
import type { Form, Submission } from "@/lib/types";
import { fmtWhen, valStr } from "./format";
import Toast from "./Toast";

export default function ResponsesClient({ form, submissions }: { form: Form; submissions: Submission[] }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastT = useRef<ReturnType<typeof setTimeout>>(null);

  const cols = form.questions.slice(0, 4);
  const detail = submissions.find((s) => s.id === detailId);

  const cellStyle = (s: Submission, color: string): React.CSSProperties => ({
    fontSize: 13.5,
    padding: "12px 16px",
    borderBottom: "1px solid #edf0f6",
    cursor: "pointer",
    background: detailId === s.id ? "var(--accent-soft)" : "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color,
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px 80px", display: "flex", flexDirection: "column", gap: 16 }}>
      {detail && (
        <div style={{ background: "#fff", border: "1px solid #e2e7f0", borderRadius: 12, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }} suppressHydrationWarning>
              Response · {fmtWhen(detail.created_at)} · {detail.via === "ai" ? "via AI assistant" : "via form"}
            </div>
            <button
              onClick={() => setDetailId(null)}
              style={{ background: "none", border: "none", fontSize: 14, color: "#5c6b82", cursor: "pointer" }}
            >
              ✕ Close
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
            {form.questions.map((q) => (
              <div
                key={q.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "280px 1fr",
                  gap: 14,
                  padding: "10px 0",
                  borderTop: "1px solid #edf0f6",
                  fontSize: 13.5,
                }}
              >
                <div style={{ color: "#5c6b82" }}>{q.label}</div>
                <div style={{ fontWeight: 500, whiteSpace: "pre-wrap" }}>{valStr(detail.answers[q.id])}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {submissions.length > 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e7f0", borderRadius: 12, overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `150px 90px repeat(${Math.max(cols.length, 1)}, 1fr)`,
              minWidth: 760,
            }}
          >
            {["Submitted", "Via", ...cols.map((q) => q.label)].map((h, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  color: "#7a8699",
                  padding: "13px 16px",
                  borderBottom: "1px solid #e2e7f0",
                  background: "#f8fafd",
                }}
              >
                {h}
              </div>
            ))}
            {submissions.map((s) => (
              <div key={s.id} style={{ display: "contents" }} onClick={() => setDetailId(s.id)}>
                <div style={cellStyle(s, "#0e1524")} suppressHydrationWarning>
                  {fmtWhen(s.created_at)}
                </div>
                <div style={cellStyle(s, "#5c6b82")}>{s.via === "ai" ? "🤖 AI" : "Form"}</div>
                {cols.map((q) => (
                  <div key={q.id} style={cellStyle(s, "#0e1524")}>
                    {valStr(s.answers[q.id])}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#5c6b82" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#22304a" }}>No responses yet</div>
          <div style={{ fontSize: 13.5, marginTop: 6 }}>Share the fill link to start collecting answers.</div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}/fill/${form.id}`);
              setToast("Fill link copied to clipboard");
              if (toastT.current) clearTimeout(toastT.current);
              toastT.current = setTimeout(() => setToast(""), 2200);
            }}
            style={{
              marginTop: 16,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Copy fill link
          </button>
        </div>
      )}
      <Toast text={toast} />
    </div>
  );
}
