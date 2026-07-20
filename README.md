# 📦 Party Forms

## 🌟 Highlights

- Build forms on a dashboard with seven question types, drag reorder, and a
  creator agent that drafts or refines the schema from chat or a brief
- Share a fill link — respondents use traditional controls, a filler agent
  chat, or both, backed by one shared answers state
- Upload a document (`.pdf`/`.txt`/`.md`/`.docx`) or an image (`.png`/`.jpg`/
  `.jpeg`/`.webp`/`.gif`, Claude vision); the filler extracts answers with a
  paper-shader reveal and reports what's still missing
- Everything persists in a single SQLite file; no external services except
  the AI API
- AI output is never trusted: answers are validated and coerced against the
  form definition on both client and server

## ℹ️ Overview

Party Forms is an AI-powered form builder built as a take-home assignment
(~2–3 hour scope). Creators get a dashboard to build forms and review
responses; respondents get a shareable link where they answer with familiar
controls or chat with an AI assistant that extracts answers, tracks what's
missing, and shows a summary before submission — it never submits on its own.

The UI uses plain inline CSS (no Tailwind).

## ✍️ Authors

[Bryan Zane](https://github.com/BryanZaneee).

## 🚀 Usage

- `/` — dashboard: form cards with fill/responses links, copy-share-link and
  delete, plus New form.
- `/new` — builder: seven question types with drag reorder, plus a
  "Draft with AI" panel that prefills rows from chat or a brief upload.
- `/fill/[id]` — shareable respondent link. Traditional controls on the left;
  sticky AI assistant on the right (status chips, chat, document upload).
  Both sides share one answers state. The AI shows a Ready-to-submit card —
  the respondent always clicks submit.
- `/forms/[id]` — responses table with click-to-open detail.

Three sample forms are seeded on first run: **Event Booking Request**,
**Restaurant Venue Profile** (all 7 question types), and **Event Vendor
Application** (20-question long form).

Try the fixtures: upload `restaurant-venue-profile.pdf` / `.docx` / `.png` or
`event-booking-request.pdf` / `.txt` on a fill page; drop
`company-picnic-rsvp-brief.txt` or `event-vendor-application-brief.txt` into
the `/new` Draft-with-AI panel. For the stress demo, drop
`BIG-restaurant-form-brief.pdf` (114 questions) into `/new`, save, then upload
`BIG-restaurant-onboarding-packet.pdf` on its fill page — 110 answers land and
the agent asks for the 4 that are deliberately missing.

## ⬇️ Installation

Requires Node.js 22.6+ (tests use `--experimental-strip-types`).

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY (+ MOONSHOT_API_KEY for docx)
npm run dev                  # http://localhost:3000
```

Forms and responses persist in `var/data.db` (SQLite, created and seeded on
first run).

> [!NOTE]
> Without an API key the dashboard, builder, and traditional fill mode work
> fully; AI chat, document extraction, and AI drafting return a graceful 503.

### Commands

- `npm run dev` — Turbopack dev server
- `npm run build` / `npm start` — production build and serve
- `npm test` — deterministic unit/API/regression tests (no AI calls)
- `npm run test:e2e` — Playwright on port 3001 (AI routes stubbed; needs
  `npx playwright install chromium` once)
- `npm run test:ai` — opt-in live Claude Sonnet 5 suite with cost rollup
  (`AI_MODEL=kimi-k3` / `kimi-k2.6` for Kimi alternates; needs API keys)
- `npm run test:ai:e2e` — opt-in live AI Playwright (`AI_E2E=1`)
- `npm run test:all` — `test` → `test:e2e` → `test:ai` → `test:ai:e2e`
- `npm run lint` — ESLint

### Engineering notes

- **Stack**: Next.js 16 (App Router) + TypeScript, better-sqlite3, Claude
  Sonnet 5 via the Anthropic SDK; Kimi K3/K2.6 as `AI_MODEL` alternates.
- **Dual agents**: creator on `/new` (`POST /api/forms/draft`); filler on
  `/fill/[id]` (chat + document extract with paper-shader reveal).
- **Reads** in server components from `lib/db.ts`; **writes** via API routes.
  `lib/validate.ts` is the single source of truth on both sides.
- AI output is never trusted: `coerceAnswers` matches options
  case-insensitively and drops unmatched values; `ready_to_submit` is
  re-gated server-side on actual required completeness.
- Live AI metrics land in `tests/last-run-metrics.json` (gitignored).

## 💭 Feedback and Contributing

This is a take-home assignment, so there's no formal contribution process —
questions and feedback are welcome as
[GitHub issues](https://github.com/BryanZaneee/party-TE/issues).
