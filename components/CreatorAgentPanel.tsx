"use client";

import { useEffect, useRef, useState } from "react";
import type { Question, QuestionType } from "@/lib/types";

export interface DraftQ {
  key: string;
  label: string;
  type: QuestionType;
  options: string[];
  max?: number;
  required: boolean;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
}

export default function CreatorAgentPanel({
  title,
  description,
  questions,
  onApplyDraft,
}: {
  title: string;
  description: string;
  questions: DraftQ[];
  onApplyDraft: (draft: { title: string; description: string; questions: DraftQ[] }) => void;
}) {
  const [chat, setChat] = useState<Msg[]>([
    {
      role: "assistant",
      text: "I'm the creator agent. Describe the form you need, or upload a brief — I'll draft questions you can edit before saving.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, busy]);

  const toApiQuestions = () =>
    questions
      .filter((q) => q.label.trim())
      .map((q) => ({
        label: q.label.trim(),
        type: q.type,
        options: q.options,
        max: q.max,
        required: q.required,
      }));

  const applyBody = (body: {
    reply: string;
    title: string;
    description: string;
    questions: Question[];
  }) => {
    onApplyDraft({
      title: body.title,
      description: body.description,
      questions: body.questions.map((q) => ({
        key: crypto.randomUUID(),
        label: q.label,
        type: q.type,
        options: q.options ?? [],
        max: q.max,
        required: q.required,
      })),
    });
    setChat((c) => [...c, { role: "assistant", text: body.reply }]);
  };

  const send = async (file?: File) => {
    const text = input.trim();
    if (busy) return;
    if (!text && !file) return;
    const userLine = file
      ? text
        ? `${text}\n\n📎 Uploaded “${file.name}”`
        : `📎 Uploaded “${file.name}” — draft a form from this document.`
      : text;
    const nextChat: Msg[] = [...chat, { role: "user", text: userLine }];
    setChat(nextChat);
    setInput("");
    setBusy(true);
    setError("");
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append(
          "messages",
          JSON.stringify(nextChat.map((m) => ({ role: m.role, content: m.text })))
        );
        fd.append("title", title);
        fd.append("description", description);
        fd.append("questions", JSON.stringify(toApiQuestions()));
        fd.append("file", file);
        res = await fetch("/api/forms/draft", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/forms/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextChat.map((m) => ({ role: m.role, content: m.text })),
            title,
            description,
            questions: toApiQuestions(),
          }),
        });
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Draft failed");
      applyBody(body);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Creator agent unavailable");
      setChat((c) => [
        ...c,
        { role: "assistant", text: "Sorry — I couldn't reach the AI. Traditional editing still works." },
      ]);
    }
    setBusy(false);
  };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 300,
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
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #edf0f6", display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: busy ? "blink 1.2s infinite" : undefined,
          }}
        />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Creator agent</div>
        <div style={{ fontSize: 12, color: "#7a8699" }}>{busy ? "drafting…" : "drafts the form"}</div>
      </div>
      <div style={{ fontSize: 12.5, color: "#5c6b82", lineHeight: 1.45, padding: "10px 16px", borderBottom: "1px solid #edf0f6" }}>
        Chat to build or refine the schema, or upload a brief. You review and edit every row before saving.
      </div>
      <div
        ref={scroll}
        style={{
          height: 280,
          overflowY: "auto",
          padding: "14px 16px",
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
              maxWidth: "90%",
              background: m.role === "user" ? "var(--accent)" : "#fff",
              color: m.role === "user" ? "#fff" : "#0e1524",
              border: `1px solid ${m.role === "user" ? "var(--accent)" : "#e2e7f0"}`,
              borderRadius: 12,
              padding: "8px 12px",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div style={{ alignSelf: "flex-start", color: "#7a8699", fontSize: 13, padding: "4px 2px" }}>
            <span style={{ animation: "blink 1.2s infinite" }}>●</span>{" "}
            <span style={{ animation: "blink 1.2s .2s infinite" }}>●</span>{" "}
            <span style={{ animation: "blink 1.2s .4s infinite" }}>●</span>
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          disabled={busy}
          placeholder="e.g. Event booking: name, date, guests, meal preference…"
          style={{
            fontSize: 13.5,
            border: "1px solid #d5dce8",
            borderRadius: 9,
            padding: "10px 12px",
            resize: "vertical",
            background: busy ? "#f6f8fb" : "#fff",
            transition: "background .2s ease",
          }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: busy || !input.trim() ? "default" : "pointer",
              opacity: busy || !input.trim() ? 0.55 : 1,
              transition: "opacity .2s ease",
            }}
          >
            {busy ? "Drafting…" : "Send to creator"}
          </button>
          <label
            className="dashed"
            style={{
              fontSize: 12.5,
              color: "#3a4a63",
              border: "1px dashed #b9c3d4",
              borderRadius: 9,
              padding: "9px 12px",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
              transition: "opacity .2s ease",
            }}
          >
            Upload brief
            <input
              type="file"
              accept=".pdf,.txt,.md,.docx,.doc"
              disabled={busy}
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void send(file);
              }}
            />
          </label>
          <div style={{ fontSize: 11.5, color: "#9aa5b6", marginLeft: "auto" }}>Enter to send · Shift+Enter for newline</div>
        </div>
        {error && <div style={{ fontSize: 12.5, color: "#c0392b" }}>{error}</div>}
      </div>
    </div>
  );
}
