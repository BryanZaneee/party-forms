# 📦 Party Forms

## 🌟 Highlights

- Build forms on a dashboard with seven question types, drag reorder, and a
  creator agent that drafts or refines the schema from chat or a brief
- Share a fill link — respondents use traditional controls, a filler agent
  chat, or both, backed by one shared answers state
- Upload a document (`.pdf`/`.txt`/`.md`); the filler agent extracts answers
  with a paper-shader reveal and reports what's still missing
- Everything persists in a single SQLite file; no external services except
  the AI API
- AI output is never trusted: answers are validated and coerced against the
  form definition on both client and server

## ℹ️ Overview

Party Forms is an AI-powered form builder built as a take-home assignment
(~2–3 hour scope, spec in `docs/assignment-text.md`). Form creators get a
dashboard to create forms and review responses; respondents get a shareable
link where they can answer with familiar form controls or chat with an AI
assistant that extracts answers from natural language, tracks what's
answered, asks for missing required fields, and shows a summary before
submission — it never submits on its own.

Product design lives in `docs/prd.md`; the full build order and append-only
Decision & Prompt Log are in `docs/roadmap.md`. The UI uses plain inline CSS
(no Tailwind).

## ✍️ Authors

Bryan Zane.

## 🚀 Usage

- `/` — dashboard: form cards with fill/responses links, copy-share-link and
  delete actions, and a New form button.
- `/new` — builder: row-based question editor (seven types: short/long text,
  multiple choice, checkboxes, dropdown, rating, date) with drag reorder,
  plus a "Draft with AI" panel that prefills the rows from a description.
- `/fill/[id]` — the shareable respondent link. Traditional controls on the
  left; a sticky AI assistant on the right with per-question status chips,
  chat, and document upload. Both sides read and write one shared answers
  state, so switching modes never loses data. The AI presents a summary and
  a Ready-to-submit card — the respondent always clicks submit.
- `/forms/[id]` — responses table (submitted time, via form/AI, first four
  answers) with a click-to-open detail card.

A sample "Event Booking Request" form is seeded on first run, and
`fixtures/` has sample documents to try the upload flow.

## ⬇️ Installation

Requires Node.js 22.6+ (tests use `--experimental-strip-types`).

```bash
npm install
cp .env.example .env.local   # add your DEEPSEEK_API_KEY
npm run dev                  # http://localhost:3000
```

Forms and responses persist in `data.db` (SQLite, created and seeded on
first run).

> [!NOTE]
> Without an API key the dashboard, builder, and traditional fill mode work
> fully; the AI chat, document extraction, and AI drafting return a graceful
> 503.

### Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` / `npm start` — production build and serve
- `npm test` — deterministic unit, API/lib integration, and regression
  tests (no AI calls, `$0` cost)
- `npm run test:e2e` — Playwright browser tests on port 3001 (AI routes
  stubbed or skipped; needs `npx playwright install chromium` once)
- `npm run test:ai` — opt-in live DeepSeek suite: extract/chat/generate/
  creator draft against fixtures with a scorable rubric; prints TTFT,
  tokens/s, tokens, per-call cost, and **suite total cost** (needs
  `DEEPSEEK_API_KEY`, never mocks model output)
- `npm run test:ai:e2e` — opt-in live AI Playwright (`AI_E2E=1`)
- `npm run test:all` — `test` → `test:e2e` → `test:ai` → `test:ai:e2e`
- `npm run lint` — ESLint

### Engineering notes

- **Stack**: Next.js 16 (App Router) + TypeScript, better-sqlite3, DeepSeek
  V4 Flash via the OpenAI-compatible API (JSON mode, streaming for TTFT
  metrics, one validation retry).
- **Dual agents**: creator agent on `/new` (`POST /api/forms/draft`, chat +
  brief upload) drafts the schema; filler agent on `/fill/[id]` chats and
  extracts from documents, with a paper-shader stagger reveal into fields.
- **Reads** happen in server components straight from `lib/db.ts`; **writes**
  go through API routes. `lib/validate.ts` is the single source of truth for
  answer validity on both server and client.
- AI output is never trusted: `coerceAnswers` matches options
  case-insensitively against the defined options and drops anything
  unmatched; `ready_to_submit` is re-gated server-side on actual required
  completeness.
- Live AI metrics land in `tests/ai/last-run-metrics.json` (gitignored).

## 💭 Feedback and Contributing

This is a take-home assignment, so there's no formal contribution process —
questions and feedback are welcome as GitHub issues. Start with
`docs/roadmap.md` for the reasoning behind every decision.
