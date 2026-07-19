"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Answers, Form, Question } from "@/lib/types";
import { isAnswered, validateAnswers } from "@/lib/validate";
import Hero from "./Hero";
import Toast from "./Toast";

const controlStyle: React.CSSProperties = {
  fontSize: 14,
  border: "1px solid #d5dce8",
  borderRadius: 8,
  padding: "10px 12px",
};

export default function FillClient({ form }: { form: Form }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const toastT = useRef<ReturnType<typeof setTimeout>>(null);

  const toastMsg = (t: string) => {
    setToast(t);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 2200);
  };

  const setAnswer = (qid: string, val: Answers[string]) => {
    setAnswers((a) => ({ ...a, [qid]: val }));
    setMissing((m) => m.filter((x) => x !== qid));
  };

  const toggleCheck = (qid: string, opt: string) => {
    const cur = answers[qid];
    const arr = Array.isArray(cur) ? cur : [];
    setAnswer(qid, arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt]);
  };

  const reset = () => {
    setAnswers({});
    setMissing([]);
    setSubmitted(false);
  };

  const submit = async (via: "form" | "ai") => {
    if (submitting) return;
    const check = validateAnswers(form.questions, answers);
    if (!check.ok) {
      setMissing([...check.missing, ...check.invalid]);
      toastMsg("Please answer the required questions");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/forms/${form.id}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, via }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const body = await res.json().catch(() => null);
      if (body?.missing || body?.invalid) setMissing([...(body.missing ?? []), ...(body.invalid ?? [])]);
      toastMsg(body?.error === "validation failed" ? "Please answer the required questions" : (body?.error ?? "Submitting failed"));
    }
  };

  const answeredCount = form.questions.filter((q) => isAnswered(answers[q.id])).length;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Hero padding="22px 28px 26px">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
            ← Party Forms
          </Link>
          <div
            style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,.75)",
              background: "rgba(255,255,255,.12)",
              border: "1px solid rgba(255,255,255,.2)",
              padding: "5px 12px",
              borderRadius: 99,
            }}
          >
            {answeredCount} of {form.questions.length} answered
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 12 }}>{form.title}</div>
        {form.description && (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", marginTop: 6, maxWidth: 640, lineHeight: 1.5 }}>
            {form.description}
          </div>
        )}
      </Hero>

      {submitted ? (
        <div
          style={{
            maxWidth: 520,
            margin: "60px auto",
            background: "#fff",
            border: "1px solid #e2e7f0",
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              margin: "0 auto",
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 16 }}>Response submitted</div>
          <div style={{ fontSize: 14, color: "#5c6b82", marginTop: 6 }}>Thanks — your answers were recorded.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
            <button
              onClick={reset}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Fill out again
            </button>
            <Link href="/" style={{ padding: "10px 14px", fontSize: 14 }}>
              Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "24px 28px 80px",
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1.25, minWidth: 380, display: "flex", flexDirection: "column", gap: 14 }}>
            {form.questions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                value={answers[q.id]}
                missing={missing.includes(q.id)}
                onSet={(v) => setAnswer(q.id, v)}
                onToggle={(opt) => toggleCheck(q.id, opt)}
              />
            ))}
            <button
              onClick={() => submit("form")}
              disabled={submitting}
              style={{
                alignSelf: "flex-start",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "13px 26px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 6,
              }}
            >
              Submit response
            </button>
          </div>
        </div>
      )}
      <Toast text={toast} />
    </div>
  );
}

function QuestionCard({
  q,
  value,
  missing,
  onSet,
  onToggle,
}: {
  q: Question;
  value: Answers[string] | undefined;
  missing: boolean;
  onSet: (v: Answers[string]) => void;
  onToggle: (opt: string) => void;
}) {
  const answered = isAnswered(value);
  const str = typeof value === "string" ? value : "";
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${missing ? "#e08579" : "#e2e7f0"}`,
        borderRadius: 12,
        padding: "18px 20px",
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
