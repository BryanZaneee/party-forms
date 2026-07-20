import Anthropic from "@anthropic-ai/sdk";
import OpenAI, { toFile } from "openai";
import type { Answers, Form, Question } from "./types.ts";
import { coerceAnswers, isAnswered, normalizeQuestions, validateAnswers } from "./validate.ts";
import {
  AI_PRICING,
  buildCallMetrics,
  type AiModel,
  type CallMetrics,
  type TokenUsage,
} from "./ai-metrics.ts";

/** Default kimi-k3; override for A/B runs: AI_MODEL=claude-sonnet-5 npm run test:ai. */
export const AI_MODEL: AiModel =
  process.env.AI_MODEL && process.env.AI_MODEL in AI_PRICING
    ? (process.env.AI_MODEL as AiModel)
    : "kimi-k3";

/** Accumulates per-call metrics for opt-in live AI tests. */
export const aiCallMetrics: CallMetrics[] = [];

export function clearAiCallMetrics(): void {
  aiCallMetrics.length = 0;
}

// K3 reasoning is always-on (max effort); temperature/top_p are fixed
// server-side, and we keep only delta.content — reasoning_content is ignored.
function client(): OpenAI {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set — AI features are unavailable");
  return new OpenAI({ apiKey, baseURL: "https://api.moonshot.ai/v1" });
}

function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — AI features are unavailable");
  return new Anthropic({ apiKey });
}

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

/** Translate our OpenAI-shaped messages to Anthropic's system + messages split. */
function toAnthropicMessages(messages: ChatMessage[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  let system = "";
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      system += (system ? "\n\n" : "") + (m.content as string);
      continue;
    }
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const parts: Anthropic.ContentBlockParam[] = [];
    for (const p of m.content ?? []) {
      if (p.type === "image_url") {
        const match = p.image_url.url.match(/^data:(.+?);base64,(.*)$/);
        if (!match) continue;
        parts.push({
          type: "image",
          source: {
            type: "base64",
            media_type: match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
            data: match[2],
          },
        });
      } else if (p.type === "text") {
        parts.push({ type: "text", text: p.text });
      }
    }
    out.push({ role: m.role, content: parts });
  }
  return { system, messages: out };
}

async function streamCompletion(
  messages: ChatMessage[],
  label: string
): Promise<{ raw: string; usage: TokenUsage; ttft_ms: number | null; latency_ms: number }> {
  const started = Date.now();
  let ttft_ms: number | null = null;
  let raw = "";
  let usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  if (AI_MODEL.startsWith("claude-")) {
    // Anthropic path: thinking disabled — the fast/cheap A/B configuration.
    const { system, messages: aMessages } = toAnthropicMessages(messages);
    const stream = anthropicClient().messages.stream({
      model: AI_MODEL,
      max_tokens: 8192,
      thinking: { type: "disabled" },
      system,
      messages: aMessages,
    });
    stream.on("text", (delta) => {
      if (ttft_ms === null) ttft_ms = Date.now() - started;
      raw += delta;
    });
    const final = await stream.finalMessage();
    const u = final.usage;
    const cacheRead = u.cache_read_input_tokens ?? 0;
    const cacheWrite = u.cache_creation_input_tokens ?? 0;
    usage = {
      prompt_tokens: u.input_tokens + cacheRead + cacheWrite,
      completion_tokens: u.output_tokens,
      total_tokens: u.input_tokens + cacheRead + cacheWrite + u.output_tokens,
      prompt_cache_hit_tokens: cacheRead,
      prompt_cache_miss_tokens: u.input_tokens + cacheWrite,
    };
  } else {
    const stream = await client().chat.completions.create({
      model: AI_MODEL,
      messages,
      response_format: { type: "json_object" },
      stream: true,
      stream_options: { include_usage: true },
      // K3 only supports max reasoning; k2.6 runs non-thinking for fast/cheap A/B runs.
      ...(AI_MODEL === "kimi-k2.6" ? { thinking: { type: "disabled" } } : {}),
    } as OpenAI.Chat.ChatCompletionCreateParamsStreaming);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        // TTFT = first answer token; K3 streams reasoning before any content.
        if (ttft_ms === null) ttft_ms = Date.now() - started;
        raw += delta;
      }
      if (chunk.usage) {
        const cached = chunk.usage.prompt_tokens_details?.cached_tokens;
        usage = {
          prompt_tokens: chunk.usage.prompt_tokens,
          completion_tokens: chunk.usage.completion_tokens,
          total_tokens: chunk.usage.total_tokens,
          prompt_cache_hit_tokens: cached,
          prompt_cache_miss_tokens:
            cached === undefined ? undefined : chunk.usage.prompt_tokens - cached,
        };
      }
    }
  }

  const latency_ms = Date.now() - started;
  aiCallMetrics.push(
    buildCallMetrics({ label, model: AI_MODEL, usage, latency_ms, ttft_ms })
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
  check: (parsed: unknown) => T | null,
  label: string
): Promise<T> {
  let msgs = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { raw } = await streamCompletion(msgs, `${label}${attempt ? `:retry` : ""}`);
    try {
      // Claude has no JSON mode here and may wrap output in ```json fences.
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
      const value = check(JSON.parse(cleaned));
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
 * Derive answers from a document (text, or an image data URL for K3 vision).
 * `missing` lists every question (required or optional) it did not answer.
 */
export async function extractAnswers(
  form: Form,
  source: string | { imageDataUrl: string }
): Promise<{ answers: Answers; missing: string[] }> {
  const system = `You extract form answers from a document. The form is "${form.title}".

Questions:
${schemaText(form.questions)}

${TYPE_MEANINGS}

Rules:
- Only include an answer when the document actually supports it; never guess.

Respond with ONLY JSON: {"answers": {question id: answer (checkbox values as arrays), for every question the document answers}}`;

  const userMessage: ChatMessage =
    typeof source === "string"
      ? { role: "user", content: `Document:\n${source}` }
      : {
          role: "user",
          content: [
            { type: "text", text: "Document: the attached image." },
            { type: "image_url", image_url: { url: source.imageDataUrl } },
          ],
        };

  const answers = await jsonCall(
    [{ role: "system", content: system }, userMessage],
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

/**
 * Extract text from a binary document (.docx/.doc) via Moonshot file-extract.
 * Deletes the remote file after reading (per-user storage caps).
 */
export async function extractFileText(bytes: Uint8Array, filename: string): Promise<string> {
  const c = client();
  const uploaded = await c.files.create({
    file: await toFile(bytes, filename),
    // Moonshot-specific purpose; not in the SDK's closed FilePurpose union.
    purpose: "file-extract" as unknown as OpenAI.FilePurpose,
  });
  try {
    return await (await c.files.content(uploaded.id)).text();
  } finally {
    await c.files.delete(uploaded.id).catch(() => {});
  }
}
