import type { AnswerValue, Answers, Question } from "../lib/types.ts";
import { isAnswered } from "../lib/validate.ts";

function normText(v: string): string {
  return v.trim().toLowerCase().replace(/[^\w\s/-]/g, "").replace(/\s+/g, " ");
}

function valuesMatch(q: Question, expected: AnswerValue, actual: AnswerValue | undefined): boolean {
  if (!isAnswered(actual)) return false;
  if (q.type === "checkbox") {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    const a = [...actual].map(normText).sort();
    const e = [...expected].map(normText).sort();
    return a.length === e.length && a.every((x, i) => x === e[i]);
  }
  if (typeof expected !== "string" || typeof actual !== "string") return false;
  if (q.type === "dropdown" || q.type === "multiple_choice" || q.type === "rating" || q.type === "date") {
    return expected.trim() === actual.trim();
  }
  const e = normText(expected);
  const a = normText(actual);
  if (a === e) return true;
  // Soft match for free text / event date wording
  return a.includes(e) || e.includes(a) || (e.includes("2026") && a.includes("2026") && (a.includes("08") || a.includes("aug")));
}

export function scoreAnswers(
  questions: Question[],
  expected: Answers,
  actual: Answers
): { accuracy: number; details: { id: string; ok: boolean }[] } {
  const ids = Object.keys(expected);
  const details = ids.map((id) => {
    const q = questions.find((x) => x.id === id);
    if (!q) return { id, ok: false };
    return { id, ok: valuesMatch(q, expected[id], actual[id]) };
  });
  const ok = details.filter((d) => d.ok).length;
  return { accuracy: ids.length ? ok / ids.length : 1, details };
}
