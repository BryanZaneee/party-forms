# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Take-home assignment (~2-3 hours scope): an AI-powered form builder web app.
Full spec: `docs/PartyPlaceEngAssignment.pdf` (transcribed in
`docs/assignment-text.md`). Product design: `docs/prd.md`. Build order,
tooling rationale, and the append-only Decision & Prompt Log:
`docs/roadmap.md`. **Every prompt-level request or decision gets appended to
that log, in chronological order.** `docs/` is kept on disk but gitignored —
these files are not in the repo.

Explicitly out of scope: auth, user accounts, advanced config, visual polish
(UI is plain inline CSS, no Tailwind).

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` / `npm start` — production build and serve
- `npm run lint` — ESLint
- `npm test` — deterministic unit/API/regression tests, no AI calls
- Single test file: `node --experimental-strip-types --test tests/validate.test.ts`
  (Node 22.6+ required; tests run TS directly via `--experimental-strip-types`)
- `npm run test:e2e` — Playwright on port 3001 (builds prod, temp DB, blanks
  the AI keys so routes 503 deterministically)
- `npm run test:ai` — opt-in live Claude Sonnet 5 scorer + suite total
  cost (`AI_MODEL=kimi-k3` / `kimi-k2.6` runs the same suite on the Kimi
  alternates)
- `npm run test:ai:e2e` — opt-in live AI Playwright (`AI_E2E=1`, `@ai` grep)
- `npm run test:all` — all of the above in order

## Architecture

Next.js 16 (App Router) + TypeScript, better-sqlite3, Claude Sonnet 5
(`claude-sonnet-5`, official Anthropic SDK, thinking disabled,
`ANTHROPIC_API_KEY` in `.env.local`). Moonshot Kimi K3/K2.6 are kept as
A/B alternates via `AI_MODEL` (OpenAI-compatible API, `MOONSHOT_API_KEY` —
also used for .docx file-extract regardless of model). Without keys
everything works except AI features, which return a graceful 503.

### Read/write contract

Server components (`app/*/page.tsx`) read straight from `lib/db.ts`. Client
components (`components/*.tsx`) write only through the API routes under
`app/api/forms/`: create, generate (AI draft from description), draft
(creator-agent chat), and per-form chat, extract, submissions, DELETE.

### Persistence (`lib/db.ts`)

Singleton better-sqlite3 connection; `PARTY_TE_DB` env var overrides the db
path (`var/data.db` by default, `:memory:` supported) — this is the test seam,
with `resetDbForTests()` to force a re-open. Questions and answers are
stored as JSON text columns, not normalized rows. Three sample forms are
seeded per-title whenever absent (so existing DBs self-heal): "Event Booking
Request" (`SEED_QUESTIONS`), "Restaurant Venue Profile"
(`RESTAURANT_SEED_QUESTIONS`, all 7 question types), and "Event Vendor
Application" (`VENDOR_SEED_QUESTIONS`, 20 questions — the long-form demo);
they double as AI-test fixtures.

### Validation trust boundary (`lib/validate.ts`)

Browser-safe, the single source of truth on both sides:

- `coerceAnswers` sanitizes ALL inbound answers (AI output and human
  submissions): keeps only known question ids, matches options
  case-insensitively against the defined options, drops anything unmatched —
  never guesses.
- `validateAnswers` gates submission; the chat route re-computes
  `ready_to_submit` server-side from actual required completeness, ignoring
  the model's claim.
- `normalizeQuestions` sanitizes untrusted form definitions (builder POST
  and AI generation): ids reassigned `q1..qn`, unknown types fall back to
  text, choice types need ≥2 options.

Seven question types (`lib/types.ts`): text, textarea, multiple_choice,
dropdown, checkbox (the only array answer), rating (stored as string "4"),
date (`YYYY-MM-DD`).

### AI layer (`lib/ai.ts`)

All three AI features (`chatTurn`, `extractAnswers`,
`draftFormTurn`) go through one `jsonCall` helper: JSON mode, streamed for
TTFT, shape-checked, one retry on invalid output, per-call metrics pushed to
`aiCallMetrics` (consumed by the live test scorer). Chat is stateless — the
client holds history + answers and sends both each turn; the server injects
the code-computed missing-required list into the prompt. No RAG: full schema
and document text always go in context. `lib/upload.ts` is the shared
PDF/TXT/MD text extraction (unpdf, 5 MB / 50k char caps) for both the filler
extract route and the creator draft route.

### Dual agents

Creator agent on `/new` (`CreatorAgentPanel` → `/api/forms/draft`) drafts or
refines the form schema; human saves via POST `/api/forms`. Filler agent on
`/fill/[id]` (`FillClient`) chats and extracts from documents; form controls
and chat share one answers state, and the respondent always clicks submit.

### Testing layout

Everything lives under `tests/` (no separate e2e/api/ai folders):

- `tests/*.test.ts` — deterministic unit/integration/regression (node:test)
- `tests/smoke.spec.ts` — Playwright; live-AI cases tagged `@ai`
- `tests/ai-live.ts` + `tests/ai-score.ts` — opt-in live AI scorer
  (never mocks model output; suite cost → `tests/last-run-metrics.json`)

## Commit messages

Conventional-commit style, 50/72 rule:

- **Subject ≤ 50 chars**, imperative mood, no trailing period: `<prefix>: <what>`
- Blank line, then **body wrapped at 72 chars** — explain what and why, not how
- Prefixes: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:` `perf:` `style:` `ci:` `build:` `revert:`
- One logical change per commit; body optional for trivial changes
- One milestone from `docs/roadmap.md` = one commit
