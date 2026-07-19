# Party Forms

An AI-powered form builder: create forms on a dashboard, share a fill link,
and let respondents answer with traditional controls, a conversational AI
assistant, or a document upload the AI extracts answers from.

## Setup

```bash
npm install
cp .env.example .env.local   # add your DEEPSEEK_API_KEY
npm run dev                  # http://localhost:3000
```

Forms and responses persist in `data.db` (SQLite, created and seeded with a
sample "Event Booking Request" form on first run). Without an API key the
dashboard, builder, and traditional fill mode work fully; only the AI chat,
document extraction, and AI drafting return a graceful error.

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` / `npm start` — production build and serve
- `npm test` — deterministic unit tests (validation/coercion, no AI calls)
- `npm run test:ai` — AI smoke test against seeded fixtures (needs
  `DEEPSEEK_API_KEY`, costs tokens)
- `npm run lint` — ESLint

## Screens

- `/` — dashboard: form cards with fill/responses links, copy-share-link and
  delete actions, and a New form button.
- `/new` — builder: row-based question editor (seven types: short/long text,
  multiple choice, checkboxes, dropdown, rating, date) with drag reorder,
  plus a "Draft with AI" panel that prefills the rows from a description.
- `/fill/[id]` — the shareable respondent link. Traditional controls on the
  left; a sticky AI assistant on the right with per-question status chips,
  chat, and document upload (`.pdf`/`.txt`/`.md`). Both sides read and write
  one shared answers state, so switching modes never loses data. The AI
  presents a summary and a Ready-to-submit card — it never submits itself.
- `/forms/[id]` — responses table (submitted time, via form/AI, first four
  answers) with a click-to-open detail card.

## Engineering notes

- **Stack**: Next.js 16 (App Router) + TypeScript, better-sqlite3, DeepSeek
  V4 Flash via the OpenAI-compatible API (JSON mode, one validation retry).
- **Reads** happen in server components straight from `lib/db.ts`; **writes**
  go through five POST endpoints plus one DELETE. `lib/validate.ts` is the
  single source of truth for answer validity on both server and client.
- AI output is never trusted: `coerceAnswers` matches options
  case-insensitively against the defined options and drops anything
  unmatched; `ready_to_submit` is re-gated server-side on actual required
  completeness.
- The UI is a faithful port of the design handoff in
  `design_handoff_slate_forms/` (see its README for the visual spec).
- Full decision history: `docs/roadmap.md` (append-only Decision & Prompt
  Log); product design: `docs/prd.md`.
