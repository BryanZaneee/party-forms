"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuestionType } from "@/lib/types";
import CreatorAgentPanel, { type DraftQ } from "@/components/CreatorAgentPanel";
import Hero from "@/components/Hero";
import Toast, { useToast } from "@/components/Toast";

const TYPE_OPTS: { v: QuestionType; label: string }[] = [
  { v: "text", label: "Short text" },
  { v: "textarea", label: "Long text" },
  { v: "multiple_choice", label: "Multiple choice" },
  { v: "checkbox", label: "Checkboxes" },
  { v: "dropdown", label: "Dropdown" },
  { v: "rating", label: "Rating" },
  { v: "date", label: "Date" },
];

const OPTION_TYPES: QuestionType[] = ["multiple_choice", "checkbox", "dropdown"];
const RATING_SCALES = [3, 5, 7, 10];
const letter = (j: number) => String.fromCharCode(65 + j);

const inputStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  border: "1px solid #e2e7f0",
  borderRadius: 8,
  padding: "9px 12px",
};

export default function Builder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQ[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, toastMsg] = useToast();

  const updateQ = (i: number, patch: Partial<DraftQ>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const addQuestion = (type: QuestionType) => {
    setAddMenuOpen(false);
    setQuestions((qs) => [
      ...qs,
      {
        key: crypto.randomUUID(),
        type,
        label: "",
        required: false,
        max: type === "rating" ? 5 : undefined,
        options: OPTION_TYPES.includes(type) ? ["Option A", "Option B"] : [],
      },
    ]);
  };

  const save = async () => {
    if (saving) return;
    const clean = questions
      .filter((q) => q.label.trim())
      .map((q) => ({
        label: q.label.trim(),
        type: q.type,
        options: q.options.map((o) => o.trim()).filter(Boolean),
        max: q.max,
        required: q.required,
      }));
    if (!clean.length) return toastMsg("Add at least one question with a label");
    if (clean.some((q) => OPTION_TYPES.includes(q.type) && q.options.length < 2))
      return toastMsg("Choice questions need at least 2 options");
    setSaving(true);
    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "Untitled form", description: description.trim(), questions: clean }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      setSaving(false);
      toastMsg((await res.json().catch(() => null))?.error ?? "Saving failed");
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Hero maxWidth={860} padding="20px 28px 24px">
        <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
          ← All forms
        </Link>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginTop: 10 }}>New form</div>
      </Hero>
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
        <div style={{ flex: 1.6, minWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e7f0",
              borderRadius: 12,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Form title"
              style={{
                fontSize: 20,
                fontWeight: 600,
                border: "none",
                borderBottom: "2px solid #e2e7f0",
                padding: "6px 2px",
                background: "transparent",
              }}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description or welcome text (optional)"
              rows={2}
              style={{
                fontSize: 14,
                border: "1px solid #e2e7f0",
                borderRadius: 8,
                padding: 10,
                resize: "vertical",
                color: "#3a4a63",
              }}
            />
          </div>
          {questions.map((q, i) => (
            <div
              key={q.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIdx !== i) setDragOverIdx(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx != null && dragIdx !== i)
                  setQuestions((qs) => {
                    const next = [...qs];
                    const [m] = next.splice(dragIdx, 1);
                    next.splice(i, 0, m);
                    return next;
                  });
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              style={{
                background: "#fff",
                border: `1px solid ${dragOverIdx === i && dragIdx !== null && dragIdx !== i ? "var(--accent)" : "#e2e7f0"}`,
                borderRadius: 12,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                opacity: dragIdx === i ? 0.45 : 1,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(i));
                    e.dataTransfer.effectAllowed = "move";
                    setDragIdx(i);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  title="Drag to reorder"
                  style={{ cursor: "grab", color: "#b3bccb", fontSize: 15, padding: "2px 4px", userSelect: "none" }}
                >
                  ⠿
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9aa5b6", width: 16 }}>{i + 1}</div>
                <input
                  value={q.label}
                  onChange={(e) => updateQ(i, { label: e.target.value })}
                  placeholder="Question"
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                />
                <select
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value as QuestionType;
                    updateQ(i, {
                      type,
                      options: OPTION_TYPES.includes(type) && !q.options.length ? ["Option A", "Option B"] : q.options,
                      max: type === "rating" ? (q.max ?? 5) : q.max,
                    });
                  }}
                  style={{
                    fontSize: 13,
                    border: "1px solid #d5dce8",
                    borderRadius: 8,
                    padding: "9px 8px",
                    background: "#fff",
                    color: "#22304a",
                    cursor: "pointer",
                  }}
                >
                  {TYPE_OPTS.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {OPTION_TYPES.includes(q.type) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginLeft: 38 }}>
                  {q.options.map((o, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 22, textAlign: "center", color: "#9aa5b6", fontSize: 14, flexShrink: 0 }}>
                        {q.type === "dropdown" ? `${letter(j)}.` : q.type === "multiple_choice" ? "○" : "☐"}
                      </div>
                      <input
                        value={o}
                        onChange={(e) =>
                          updateQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })
                        }
                        placeholder={`Option ${letter(j)}`}
                        style={{ ...inputStyle, fontWeight: 400, fontSize: 13.5, flex: 1, maxWidth: 340, padding: "8px 11px" }}
                      />
                      <button
                        onClick={() => updateQ(i, { options: q.options.filter((_, k) => k !== j) })}
                        title="Remove option"
                        className="opt-x"
                        style={{ background: "none", border: "none", color: "#9aa5b6", cursor: "pointer", fontSize: 13 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateQ(i, { options: [...q.options, ""] })}
                    className="dashed"
                    style={{
                      alignSelf: "flex-start",
                      marginLeft: 32,
                      background: "none",
                      border: "1px dashed #b9c3d4",
                      borderRadius: 7,
                      padding: "6px 12px",
                      fontSize: 12.5,
                      color: "#3a4a63",
                      cursor: "pointer",
                    }}
                  >
                    ＋ Add option {letter(q.options.length)}
                  </button>
                </div>
              )}
              {q.type === "rating" && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 38, fontSize: 13, color: "#3a4a63" }}
                >
                  <span>Scale</span>
                  <select
                    value={String(q.max ?? 5)}
                    onChange={(e) => updateQ(i, { max: parseInt(e.target.value, 10) })}
                    style={{
                      fontSize: 13,
                      border: "1px solid #d5dce8",
                      borderRadius: 8,
                      padding: "7px 8px",
                      background: "#fff",
                      color: "#22304a",
                      cursor: "pointer",
                    }}
                  >
                    {RATING_SCALES.map((r) => (
                      <option key={r} value={r}>
                        1–{r}
                      </option>
                    ))}
                  </select>
                  <span style={{ color: "#9aa5b6" }}>respondents pick a number from 1–{q.max ?? 5}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: 38 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#3a4a63", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQ(i, { required: e.target.checked })}
                    style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
                  />{" "}
                  Required
                </label>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontSize: 13 }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setAddMenuOpen((o) => !o)}
              className="dashed"
              style={{
                width: "100%",
                background: "#fff",
                border: "1px dashed #b9c3d4",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "#3a4a63",
                cursor: "pointer",
              }}
            >
              ＋ Add question
            </button>
            {addMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "calc(100% + 6px)",
                  background: "#fff",
                  border: "1px solid #e2e7f0",
                  borderRadius: 10,
                  boxShadow: "0 10px 30px rgba(10,20,50,.14)",
                  padding: 6,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                  minWidth: 320,
                  zIndex: 10,
                }}
              >
                {TYPE_OPTS.map((t) => (
                  <button
                    key={t.v}
                    onClick={() => addQuestion(t.v)}
                    className="menu-item"
                    style={{
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      fontSize: 13.5,
                      color: "#22304a",
                      padding: "9px 12px",
                      borderRadius: 7,
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "12px 22px",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {saving ? "Saving…" : "Save form"}
            </button>
            <Link href="/" style={{ padding: "12px 18px", fontSize: 14, color: "#5c6b82" }}>
              Cancel
            </Link>
          </div>
        </div>

        <CreatorAgentPanel
          title={title}
          description={description}
          questions={questions}
          onApplyDraft={(draft) => {
            setTitle(draft.title);
            setDescription(draft.description);
            setQuestions(draft.questions);
          }}
        />
      </div>
      <Toast text={toast} />
    </div>
  );
}
