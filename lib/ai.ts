import OpenAI from "openai";
import type { Answers, Form, Question } from "./types.ts";
import { coerceAnswers, isAnswered, normalizeQuestions, validateAnswers } from "./validate.ts";
import {
  buildCallMetrics,
  type CallMetrics,
  type DeepSeekModel,
  type TokenUsage,
} from "./ai-metrics.ts";

const MODEL: DeepSeekModel = "deepseek-v4-flash";

/** Accumulates per-call metrics for opt-in live AI tests. */
export const aiCallMetrics: CallMetrics[] = [];

export function clearAiCallMetrics(): void {
  aiCallMetrics.length = 0;
}

// ponytail: thinking mode deliberately off — per-turn latency for no gain here.
function client(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set — AI features are unavailable");
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

async function streamCompletion(
  messages: ChatMessage[],
  temperature: number,
  label: string
): Promise<{ raw: string; usage: TokenUsage; ttft_ms: number | null; latency_ms: number }> {
  const c = client();
  const started = Date.now();
  let ttft_ms: number | null = null;
  let raw = "";
  let usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const stream = await c.chat.completions.create({
    model: MODEL,
    messages,
    temperature,
    response_format: { type: "json_object" },
    stream: true,
    stream_options: { include_usage: true },
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      if (ttft_ms === null) ttft_ms = Date.now() - started;
      raw += delta;
    }
    if (chunk.usage) {
      const u = chunk.usage as TokenUsage & {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        prompt_cache_hit_tokens?: number;
        prompt_cache_miss_tokens?: number;
      };
      usage = {
        prompt_tokens: u.prompt_tokens,
        completion_tokens: u.completion_tokens,
        total_tokens: u.total_tokens,
        prompt_cache_hit_tokens: u.prompt_cache_hit_tokens,
        prompt_cache_miss_tokens: u.prompt_cache_miss_tokens,
      };
    }
  }

  const latency_ms = Date.now() - started;
  aiCallMetrics.push(
    buildCallMetrics({ label, model: MODEL, usage, latency_ms, ttft_ms })
  );
  return { raw, usage, ttft_ms, latency_ms };
}

/**
 * JSON-mode call with shape validation and one retry: if the response fails
 * to parse or `check` rejects it, the error is appended and the model gets
 * one more attempt. Streams for TTFT; records metrics on each attempt.
 */
async function jsonCall<T>(
  messages: ChatMessage[],
  temperature: number,
  check: (parsed: unknown) => T | null,
  label: string
): Promise<T> {
  let msgs = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { raw } = await streamCompletion(msgs, temperature, `${label}${attempt ? `:retry` : ""}`);
    try {
      const value = check(JSON.parse(raw));
      if (value !== null) return value;
    } catch {
      // fall through to retry
    }
    msgs = [
      ...msgs,
      { role: "assistant", content: raw },
      { role: "user", content: "That was not valid JSON in the required shape. Reply again with ONLY the required JSON." },
    ];
  }
  throw new Error("AI returned invalid JSON twice");
}

function schemaText(questions: Question[]): string {
  return questions
    .map(
      (q) =>
        `- ${q.id}: "${q.label}" (${q.type}` +
        (q.options ? `, options: ${q.options.join(" | ")}` : "") +
        (q.type === "rating" ? `, scale 1-${q.max ?? 5}` : "") +
        (q.required ? ", required" : ", optional") +
        ")"
    )
    .join("\n");
}

const TYPE_MEANINGS = `Type meanings: text/textarea = free text; multiple_choice/dropdown = EXACTLY one of the listed options; checkbox = a JSON array containing any subset of the listed options; rating = an integer from 1 to the question's scale max; date = a "YYYY-MM-DD" string.`;

export interface ChatTurnResult {
  reply: string;
  answers: Answers;
  ready_to_submit: boolean;
}

export async function chatTurn(
  form: Form,
  history: { role: "user" | "assistant"; content: string }[],
  current: Answers
): Promise<ChatTurnResult> {
  const { missing } = validateAnswers(form.questions, current);
  const system = `You are a friendly assistant helping a respondent complete the form "${form.title}".

Questions:
${schemaText(form.questions)}

${TYPE_MEANINGS}

Current answers (by question id): ${JSON.stringify(current)}
Required questions still missing: ${missing.length ? missing.join(", ") : "none"}

Rules:
- Extract any answers the user supplies naturally, even several in one message.
- If the user changes an earlier answer, update it.
- Answers must match the question's type meaning above; map the user's wording to the matching option(s).
- Ask for the missing required questions, one or two at a time. Mention optional ones once but do not insist.
- When no required questions are missing, present a short summary of every answer and ask the user to confirm, setting ready_to_submit to true.
- Never claim the form has been submitted — the respondent submits with a button after your summary.
- Keep replies brief and conversational.

Respond with ONLY JSON:
{"reply": string, "answers": {question ids answered or changed THIS turn (checkbox values as arrays), {} if none}, "ready_to_submit": boolean}`;

  const result = await jsonCall(
    [{ role: "system", content: system }, ...history],
    0.2,
    (parsed) => {
      const p = parsed as { reply?: unknown; answers?: unknown; ready_to_submit?: unknown };
      if (typeof p?.reply !== "string") return null;
      return {
        reply: p.reply,
        turnAnswers: coerceAnswers(form.questions, p.answers),
        ready: Boolean(p.ready_to_submit),
      };
    },
    "chatTurn"
  );

  const answers: Answers = { ...current, ...result.turnAnswers };
  // Server owns readiness: never ready while required answers are missing.
  const after = validateAnswers(form.questions, answers);
  return { reply: result.reply, answers, ready_to_submit: result.ready && after.missing.length === 0 };
}

/**
 * Derive answers from document text. `missing` lists every question
 * (required or optional) the document did not answer.
 */
export async function extractAnswers(
  form: Form,
  text: string
): Promise<{ answers: Answers; missing: string[] }> {
  const system = `You extract form answers from a document. The form is "${form.title}".

Questions:
${schemaText(form.questions)}

${TYPE_MEANINGS}

Rules:
- Only include an answer when the document actually supports it; never guess.

Respond with ONLY JSON: {"answers": {question id: answer (checkbox values as arrays), for every question the document answers}}`;

  const answers = await jsonCall(
    [
      { role: "system", content: system },
      { role: "user", content: `Document:\n${text}` },
    ],
    0,
    (parsed) => {
      const p = parsed as { answers?: unknown };
      if (!p || typeof p !== "object" || !("answers" in p)) return null;
      return coerceAnswers(form.questions, p.answers);
    },
    "extractAnswers"
  );

  const missing = form.questions.filter((q) => !isAnswered(answers[q.id])).map((q) => q.id);
  return { answers, missing };
}

/** Draft a form from a creator's description; result prefills the builder for review. */
export async function generateForm(
  description: string
): Promise<{ title: string; description: string; questions: Question[] }> {
  const system = `You design forms. From the user's description, produce a concise form.

Question types: text (short answer), textarea (long answer), multiple_choice, dropdown, checkbox, rating, date.
multiple_choice, dropdown, and checkbox questions need an "options" array of 2-6 strings.
rating questions should include "max": 3, 5, 7, or 10.
Mark a question "required" only when the form clearly needs it.

Respond with ONLY JSON:
{"title": string, "description": string (one sentence), "questions": [{"label": string, "type": string, "options"?: string[], "max"?: number, "required": boolean}]}`;

  return jsonCall(
    [
      { role: "system", content: system },
      { role: "user", content: description },
    ],
    0,
    (parsed) => {
      const p = parsed as { title?: unknown; description?: unknown; questions?: unknown };
      if (typeof p?.title !== "string" || !p.title.trim()) return null;
      const questions = normalizeQuestions(p.questions);
      const desc = typeof p.description === "string" ? p.description.trim() : "";
      return questions && { title: p.title.trim(), description: desc, questions };
    },
    "generateForm"
  );
}

export interface DraftFormTurnResult {
  reply: string;
  title: string;
  description: string;
  questions: Question[];
}

/**
 * Creator-agent turn: refine a form draft from chat (and optional document text).
 * Returns a full draft the builder can preview; human still saves via POST /api/forms.
 */
export async function draftFormTurn(
  history: { role: "user" | "assistant"; content: string }[],
  current: { title: string; description: string; questions: Question[] },
  documentText?: string
): Promise<DraftFormTurnResult> {
  const system = `You are a form-design assistant (creator agent). Help the user design a form.

Current draft:
Title: ${current.title || "(empty)"}
Description: ${current.description || "(empty)"}
Questions: ${current.questions.length ? schemaText(current.questions) : "(none yet)"}

${TYPE_MEANINGS}

Question types: text, textarea, multiple_choice, dropdown, checkbox, rating, date.
multiple_choice/dropdown/checkbox need 2-6 options; rating max is 3, 5, 7, or 10.

Rules:
- Update the draft based on the latest user message${documentText ? " and the attached document" : ""}.
- Prefer concise forms; mark required only when clearly needed.
- Reply briefly about what you changed.
- Always return the FULL updated draft (not a delta).

Respond with ONLY JSON:
{"reply": string, "title": string, "description": string, "questions": [{"label": string, "type": string, "options"?: string[], "max"?: number, "required": boolean}]}`;

  const userExtra = documentText
    ? `\n\nDocument to derive the form from:\n${documentText}`
    : "";

  return jsonCall(
    [
      { role: "system", content: system },
      ...history.slice(0, -1),
      ...(history.length
        ? [{ role: history[history.length - 1].role, content: history[history.length - 1].content + userExtra } as ChatMessage]
        : [{ role: "user" as const, content: `Start a form draft.${userExtra}` }]),
    ],
    0.2,
    (parsed) => {
      const p = parsed as {
        reply?: unknown;
        title?: unknown;
        description?: unknown;
        questions?: unknown;
      };
      if (typeof p?.reply !== "string") return null;
      if (typeof p?.title !== "string" || !p.title.trim()) return null;
      const questions = normalizeQuestions(p.questions);
      if (!questions) return null;
      const desc = typeof p.description === "string" ? p.description.trim() : "";
      return { reply: p.reply, title: p.title.trim(), description: desc, questions };
    },
    "draftFormTurn"
  );
}
