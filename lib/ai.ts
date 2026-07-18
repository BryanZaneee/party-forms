import OpenAI from "openai";
import type { Answers, Form, Question } from "./types.ts";
import { validateAnswers } from "./validate.ts";

const MODEL = "deepseek-v4-flash";

// ponytail: thinking mode deliberately off — per-turn latency for no gain here.
function client(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set — AI features are unavailable");
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

/**
 * JSON-mode call with shape validation and one retry: if the response fails
 * to parse or `check` rejects it, the error is appended and the model gets
 * one more attempt.
 */
async function jsonCall<T>(
  messages: ChatMessage[],
  temperature: number,
  check: (parsed: unknown) => T | null
): Promise<T> {
  const c = client();
  let msgs = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await c.chat.completions.create({
      model: MODEL,
      messages: msgs,
      temperature,
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content ?? "";
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
        (q.required ? ", required" : ", optional") +
        ")"
    )
    .join("\n");
}

/** Keep only known question ids with string values; drop choice answers outside options. */
function cleanAnswers(questions: Question[], raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object") return out;
  for (const q of questions) {
    const v = (raw as Record<string, unknown>)[q.id];
    if (typeof v !== "string") continue;
    if (q.options && v.trim() && !q.options.includes(v.trim())) continue;
    out[q.id] = v.trim();
  }
  return out;
}

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

Current answers (by question id): ${JSON.stringify(current)}
Required questions still missing: ${missing.length ? missing.join(", ") : "none"}

Rules:
- Extract any answers the user supplies naturally, even several in one message.
- If the user changes an earlier answer, update it.
- For multiple_choice/dropdown questions the answer must be EXACTLY one of the listed options; map the user's wording to the matching option.
- Ask for the missing required questions, one or two at a time. Mention optional ones once but do not insist.
- When no required questions are missing, present a short summary of every answer and ask the user to confirm, setting ready_to_submit to true.
- Never claim the form has been submitted — the respondent submits with a button after your summary.
- Keep replies brief and conversational.

Respond with ONLY JSON:
{"reply": string, "answers": {question ids answered or changed THIS turn, {} if none}, "ready_to_submit": boolean}`;

  const result = await jsonCall(
    [{ role: "system", content: system }, ...history],
    0.2,
    (parsed) => {
      const p = parsed as { reply?: unknown; answers?: unknown; ready_to_submit?: unknown };
      if (typeof p?.reply !== "string") return null;
      return {
        reply: p.reply,
        turnAnswers: cleanAnswers(form.questions, p.answers),
        ready: Boolean(p.ready_to_submit),
      };
    }
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
export async function extractAnswers(form: Form, text: string): Promise<{ answers: Answers; missing: string[] }> {
  const system = `You extract form answers from a document. The form is "${form.title}".

Questions:
${schemaText(form.questions)}

Rules:
- Only include an answer when the document actually supports it; never guess.
- For multiple_choice/dropdown questions the answer must be EXACTLY one of the listed options.

Respond with ONLY JSON: {"answers": {question id: answer string, for every question the document answers}}`;

  const answers = await jsonCall(
    [
      { role: "system", content: system },
      { role: "user", content: `Document:\n${text}` },
    ],
    0,
    (parsed) => {
      const p = parsed as { answers?: unknown };
      if (!p || typeof p !== "object" || !("answers" in p)) return null;
      return cleanAnswers(form.questions, p.answers);
    }
  );

  const missing = form.questions.filter((q) => !answers[q.id]?.trim()).map((q) => q.id);
  return { answers, missing };
}
