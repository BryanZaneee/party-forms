"use client";

import type { Answers, Question } from "@/lib/types";
import { isAnswered } from "@/lib/validate";

const controlStyle: React.CSSProperties = {
  fontSize: 14,
  border: "1px solid #d5dce8",
  borderRadius: 8,
  padding: "10px 12px",
};

export default function QuestionCard({
  q,
  value,
  missing,
  highlight,
  onSet,
  onToggle,
}: {
  q: Question;
  value: Answers[string] | undefined;
  missing: boolean;
  highlight?: boolean;
  onSet: (v: Answers[string]) => void;
  onToggle: (opt: string) => void;
}) {
  const answered = isAnswered(value);
  const str = typeof value === "string" ? value : "";
  return (
    <div
      style={{
        background: highlight ? "var(--accent-soft)" : "#fff",
        border: `1px solid ${missing ? "#e08579" : highlight ? "var(--accent)" : "#e2e7f0"}`,
        borderRadius: 12,
        padding: "18px 20px",
        transition: "background .35s ease, border-color .35s ease, box-shadow .35s ease",
        boxShadow: highlight ? "0 0 0 3px rgba(225,29,116,.15), 0 6px 20px rgba(225,29,116,.12)" : "none",
        animation: highlight ? "card-pop .4s ease" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{q.label}</div>
        {q.required && <div style={{ color: "#c0392b", fontSize: 14 }}>*</div>}
        <div style={{ flex: 1 }} />
        {answered && <div style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 600 }}>✓ answered</div>}
      </div>
      {missing && <div style={{ fontSize: 12.5, color: "#c0392b", marginTop: 4 }}>This question is required.</div>}
      <div style={{ marginTop: 12 }}>
        {q.type === "text" && (
          <input
            value={str}
            onChange={(e) => onSet(e.target.value)}
            placeholder="Your answer"
            style={{ ...controlStyle, width: "100%", boxSizing: "border-box" }}
          />
        )}
        {q.type === "textarea" && (
          <textarea
            value={str}
            onChange={(e) => onSet(e.target.value)}
            placeholder="Your answer"
            rows={3}
            style={{ ...controlStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
          />
        )}
        {q.type === "date" && (
          <input type="date" value={str} onChange={(e) => onSet(e.target.value)} style={{ ...controlStyle, padding: "9px 12px" }} />
        )}
        {q.type === "dropdown" && (
          <select
            value={str}
            onChange={(e) => onSet(e.target.value)}
            style={{ ...controlStyle, padding: "9px 10px", background: "#fff", minWidth: 220, cursor: "pointer" }}
          >
            <option value="">Select…</option>
            {(q.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
        {(q.type === "multiple_choice" || q.type === "checkbox") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(q.options ?? []).map((o) => {
              const checked = q.type === "multiple_choice" ? value === o : Array.isArray(value) && value.includes(o);
              return (
                <label
                  key={o}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    fontSize: 14,
                    cursor: "pointer",
                    padding: "8px 10px",
                    border: `1px solid ${checked ? "var(--accent)" : "#e2e7f0"}`,
                    borderRadius: 8,
                    background: checked ? "var(--accent-soft)" : "#fff",
                    transition: "background .2s ease, border-color .2s ease",
                  }}
                >
                  <input
                    type={q.type === "multiple_choice" ? "radio" : "checkbox"}
                    checked={checked}
                    onChange={() => (q.type === "multiple_choice" ? onSet(o) : onToggle(o))}
                    style={{ accentColor: "var(--accent)" }}
                  />{" "}
                  {o}
                </label>
              );
            })}
          </div>
        )}
        {q.type === "rating" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Array.from({ length: q.max ?? 5 }, (_, k) => k + 1).map((n) => {
              const lit = Number(str) >= n;
              return (
                <button
                  key={n}
                  onClick={() => onSet(String(n))}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 9,
                    border: `1px solid ${lit ? "var(--accent)" : "#d5dce8"}`,
                    background: lit ? "var(--accent)" : "#fff",
                    color: lit ? "#fff" : "#3a4a63",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background .15s ease, border-color .15s ease, color .15s ease",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
