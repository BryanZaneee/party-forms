"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Answers, Form, Question } from "@/lib/types";
import { isAnswered, validateAnswers } from "@/lib/validate";
import Hero from "./Hero";
import Toast from "./Toast";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

const greeting = (form: Form): ChatMsg => ({
  role: "assistant",
  text: `Hi! I can help you fill out “${form.title}”. Tell me your answers in your own words, or upload a document and I'll pull out what I can. What would you like to start with?`,
});

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
  const [chat, setChat] = useState<ChatMsg[]>([greeting(form)]);
  const [chatInput, setChatInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [toast, setToast] = useState("");
  const toastT = useRef<ReturnType<typeof setTimeout>>(null);
  const chatScroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatScroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, aiBusy]);

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
    setChat([greeting(form)]);
    setChatInput("");
    setAiBusy(false);
    setAiReady(false);
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || aiBusy) return;
    const nextChat: ChatMsg[] = [...chat, { role: "user", text }];
    setChat(nextChat);
    setChatInput("");
    setAiBusy(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextChat.map((m) => ({ role: m.role, content: m.text })),
          answers,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error);
      // Server returns the full merged answers object — replace, don't merge.
      setAnswers(body.answers);
      setMissing((m) => m.filter((id) => !isAnswered(body.answers[id])));
      setChat((c) => [...c, { role: "assistant", text: body.reply }]);
      setAiReady((r) => r || body.ready_to_submit === true);
    } catch {
      setChat((c) => [...c, { role: "assistant", text: "Sorry, I hit an error reaching the AI. Please try again." }]);
    }
    setAiBusy(false);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || aiBusy) return;
    setChat((c) => [...c, { role: "user", text: `📄 Uploaded “${file.name}” — please pull out any answers you can.` }]);
    setAiBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/forms/${form.id}/extract`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error);
      const merged = { ...answers, ...body.answers };
      setAnswers(merged);
      setMissing((m) => m.filter((id) => !isAnswered(merged[id])));
      const found = form.questions.filter((q) => q.id in body.answers).map((q) => q.label);
      const stillMissing = form.questions.filter((q) => q.required && !isAnswered(merged[q.id])).map((q) => q.label);
      const summary = found.length
        ? `I read “${file.name}” and filled in: ${found.join(", ")}.` +
          (stillMissing.length
            ? ` Still missing: ${stillMissing.join(", ")}.`
            : " All required questions are answered — review your answers and submit when ready.")
        : `I couldn't find any answers in “${file.name}”.` +
          (stillMissing.length ? ` Still missing: ${stillMissing.join(", ")}.` : "");
      setChat((c) => [...c, { role: "assistant", text: summary }]);
    } catch (err) {
      setChat((c) => [
        ...c,
        { role: "assistant", text: err instanceof Error && err.message ? err.message : "Sorry, I couldn't read that document." },
      ]);
    }
    setAiBusy(false);
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

          <div
            style={{
              flex: 1,
              minWidth: 330,
              position: "sticky",
              top: 16,
              background: "#fff",
              border: "1px solid #e2e7f0",
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 6px 24px rgba(10,20,50,.07)",
            }}
          >
            <div
              style={{ padding: "14px 18px", borderBottom: "1px solid #edf0f6", display: "flex", alignItems: "center", gap: 9 }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>AI assistant</div>
              <div style={{ fontSize: 12, color: "#7a8699" }}>answers fill in live</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 16px", borderBottom: "1px solid #edf0f6" }}>
              {form.questions.map((q) => {
                const done = isAnswered(answers[q.id]);
                const label = q.label.length > 22 ? q.label.slice(0, 21) + "…" : q.label;
                return (
                  <div
                    key={q.id}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "4px 9px",
                      borderRadius: 99,
                      background: done ? "var(--accent-soft)" : "#f3f5f9",
                      color: done ? "var(--accent)" : "#7a8699",
                      border: `1px solid ${done ? "var(--accent)" : "#e2e7f0"}`,
                    }}
                  >
                    {done ? "✓" : "○"} {label}
                    {q.required ? " *" : ""}
                  </div>
                );
              })}
            </div>
            <div
              ref={chatScroll}
              style={{
                height: 380,
                overflowY: "auto",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "#f8fafd",
              }}
            >
              {chat.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: m.role === "user" ? "var(--accent)" : "#fff",
                    color: m.role === "user" ? "#fff" : "#0e1524",
                    border: `1px solid ${m.role === "user" ? "var(--accent)" : "#e2e7f0"}`,
                    borderRadius: 12,
                    padding: "9px 13px",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              ))}
              {aiBusy && (
                <div style={{ alignSelf: "flex-start", color: "#7a8699", fontSize: 13, padding: "4px 2px" }}>
                  <span style={{ animation: "blink 1.2s infinite" }}>●</span>{" "}
                  <span style={{ animation: "blink 1.2s .2s infinite" }}>●</span>{" "}
                  <span style={{ animation: "blink 1.2s .4s infinite" }}>●</span>
                </div>
              )}
            </div>
            {aiReady && validateAnswers(form.questions, answers).missing.length === 0 && (
              <div
                style={{
                  margin: "12px 14px 12px",
                  border: "1px solid var(--accent)",
                  background: "var(--accent-soft)",
                  borderRadius: 11,
                  padding: "13px 15px",
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Ready to submit</div>
                <div style={{ fontSize: 12.5, color: "#3a4a63", marginTop: 3, lineHeight: 1.45 }}>
                  All required questions are answered. Review the summary above and your answers on the left — the AI never
                  submits for you.
                </div>
                <button
                  onClick={() => submit("ai")}
                  disabled={submitting}
                  style={{
                    marginTop: 10,
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Submit response
                </button>
              </div>
            )}
            <div style={{ padding: "12px 14px", borderTop: "1px solid #edf0f6", display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder="Answer naturally, e.g. “I'm Maya, I'll be there May 12”"
                  rows={2}
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    border: "1px solid #d5dce8",
                    borderRadius: 9,
                    padding: "9px 11px",
                    resize: "none",
                  }}
                />
                <button
                  onClick={sendChat}
                  disabled={aiBusy}
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 9,
                    padding: "0 16px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Send
                </button>
              </div>
              <label
                style={{ fontSize: 12.5, color: "#5c6b82", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
              >
                <span className="dashed" style={{ border: "1px dashed #b9c3d4", borderRadius: 7, padding: "5px 10px" }}>
                  📄 Upload a document
                </span>
                <span>AI extracts answers from it (.pdf, .txt, .md)</span>
                <input type="file" accept=".pdf,.txt,.md" onChange={handleUpload} style={{ display: "none" }} />
              </label>
            </div>
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
