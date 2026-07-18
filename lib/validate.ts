import type { Answers, Question, QuestionType } from "./types.ts";

const QUESTION_TYPES: QuestionType[] = ["text", "textarea", "multiple_choice", "dropdown"];

// Single source of truth for answer validity: the submissions route rejects
// on it, chat injects `missing` into the prompt, extract drops `invalid`.
export function validateAnswers(questions: Question[], answers: Answers) {
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const q of questions) {
    const a = answers[q.id]?.trim();
    if (!a) {
      if (q.required) missing.push(q.id);
      continue;
    }
    if (q.options && !q.options.includes(a)) invalid.push(q.id);
  }
  return { missing, invalid, ok: missing.length === 0 && invalid.length === 0 };
}

/**
 * Coerce untrusted question input (builder POST or AI generation) into a
 * valid Question[]: ids become q1..qn, unknown types fall back to text,
 * choice types must carry ≥2 non-empty options. Returns null if unusable.
 */
export function normalizeQuestions(input: unknown): Question[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: Question[] = [];
  for (let i = 0; i < input.length; i++) {
    const q = input[i] as Record<string, unknown>;
    if (!q || typeof q.label !== "string" || !q.label.trim()) return null;
    const type = QUESTION_TYPES.includes(q.type as QuestionType) ? (q.type as QuestionType) : "text";
    const needsOptions = type === "multiple_choice" || type === "dropdown";
    if (!needsOptions) {
      out.push({ id: `q${i + 1}`, label: q.label.trim(), type, required: Boolean(q.required) });
      continue;
    }
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === "string" && o.trim() !== "")
      : [];
    if (options.length < 2) return null;
    out.push({ id: `q${i + 1}`, label: q.label.trim(), type, options, required: Boolean(q.required) });
  }
  return out;
}
