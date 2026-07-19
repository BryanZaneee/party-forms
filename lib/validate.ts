import type { AnswerValue, Answers, Question, QuestionType } from "./types.ts";

const QUESTION_TYPES: QuestionType[] = [
  "text",
  "textarea",
  "multiple_choice",
  "dropdown",
  "checkbox",
  "rating",
  "date",
];

const OPTION_TYPES: QuestionType[] = ["multiple_choice", "dropdown", "checkbox"];
const RATING_SCALES = [3, 5, 7, 10];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** An answer counts once it is a non-blank string or a non-empty array. */
export function isAnswered(v: AnswerValue | undefined): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === "string" && v.trim() !== "";
}

function isValid(q: Question, v: AnswerValue): boolean {
  switch (q.type) {
    case "multiple_choice":
    case "dropdown":
      return typeof v === "string" && (q.options ?? []).includes(v.trim());
    case "checkbox":
      return Array.isArray(v) && v.every((o) => (q.options ?? []).includes(o));
    case "rating": {
      const n = Number(v);
      return typeof v === "string" && Number.isInteger(n) && n >= 1 && n <= (q.max ?? 5);
    }
    case "date":
      return typeof v === "string" && DATE_RE.test(v.trim());
    default:
      return typeof v === "string";
  }
}

// Single source of truth for answer validity: the submissions route rejects
// on it, chat injects `missing` into the prompt, extract drops `invalid`.
export function validateAnswers(questions: Question[], answers: Answers) {
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const q of questions) {
    const v = answers[q.id];
    if (!isAnswered(v)) {
      if (q.required) missing.push(q.id);
      continue;
    }
    if (!isValid(q, v!)) invalid.push(q.id);
  }
  return { missing, invalid, ok: missing.length === 0 && invalid.length === 0 };
}

/** Case-insensitive match of a raw value to a defined option; returns the exact option string. */
function matchOption(options: string[], v: unknown): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).trim().toLowerCase();
  return options.find((o) => o.toLowerCase() === s);
}

/**
 * The one inbound-answer sanitizer (AI output, submissions route, chat route).
 * Keeps only known question ids; coerces per type; unmatched values are
 * dropped, never guessed.
 */
export function coerceAnswers(questions: Question[], raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object") return out;
  for (const q of questions) {
    const v = (raw as Record<string, unknown>)[q.id];
    if (v === undefined || v === null) continue;
    switch (q.type) {
      case "multiple_choice":
      case "dropdown": {
        const m = matchOption(q.options ?? [], v);
        if (m) out[q.id] = m;
        break;
      }
      case "checkbox": {
        const arr = Array.isArray(v) ? v : [v];
        const matched = arr
          .map((o) => matchOption(q.options ?? [], o))
          .filter((o): o is string => o !== undefined);
        if (matched.length) out[q.id] = [...new Set(matched)];
        break;
      }
      case "rating": {
        const n = Math.round(Number(v));
        if (Number.isInteger(n) && n >= 1 && n <= (q.max ?? 5)) out[q.id] = String(n);
        break;
      }
      case "date": {
        if (typeof v === "string" && DATE_RE.test(v.trim())) out[q.id] = v.trim();
        break;
      }
      default: {
        if (typeof v === "string" || typeof v === "number") {
          const s = String(v).trim();
          if (s) out[q.id] = s;
        }
      }
    }
  }
  return out;
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
    const base = { id: `q${i + 1}`, label: q.label.trim(), type, required: Boolean(q.required) };
    if (type === "rating") {
      const max = RATING_SCALES.includes(Number(q.max)) ? Number(q.max) : 5;
      out.push({ ...base, max });
      continue;
    }
    if (!OPTION_TYPES.includes(type)) {
      out.push(base);
      continue;
    }
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === "string" && o.trim() !== "")
      : [];
    if (options.length < 2) return null;
    out.push({ ...base, options });
  }
  return out;
}
