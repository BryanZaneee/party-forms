# PRD — AI-Powered Form Builder

## Overview

A small web app where a creator builds forms on a dashboard and respondents
complete them via a share link — either with traditional form controls or by
talking to an AI assistant. Respondents can also upload a document and have
the AI derive answers from it. Built to the take-home spec in
[assignment-text.md](assignment-text.md), sized to a ~2-3 hour scope.

## Goals

1. Dashboard: create a form, list existing forms, view submissions per form.
2. Forms and submissions persist across restarts.
3. Share link (`/fill/[id]`) with two completion modes: form controls and AI
   chat.
4. AI assistant covers all six required behaviors (conversation, natural
   answer extraction, answer updates, answered/unanswered tracking, asking
   for missing required fields, pre-submit summary).
5. Document upload: AI derives answers from the document text and reports
   what is still missing.

## Non-goals (per spec)

Authentication, user accounts, advanced form configuration, visual polish,
deployment. Also deliberately out: form editing/deletion after creation,
image-document uploads (the chosen model is text-only), multi-page forms.

## Personas

- **Creator** — uses the dashboard to build forms and read submissions.
- **Respondent** — opens the share link and completes the form either way.

## Question types

`text` (short answer), `textarea` (long answer), `multiple_choice` (radio),
`dropdown` (select) — each with a `required` flag. Enough variety to exercise
every AI behavior without bloating the builder.

Question shape:

```json
{ "id": "q1", "label": "Your name", "type": "text", "required": true }
{ "id": "q2", "label": "Meal", "type": "dropdown", "options": ["Veg", "Meat"], "required": false }
```

## Data model (SQLite, `data.db`)

| Table | Columns |
|-------|---------|
| `forms` | `id` TEXT PK, `title` TEXT, `questions` TEXT (JSON array), `created_at` |
| `submissions` | `id` TEXT PK, `form_id` TEXT FK, `answers` TEXT (JSON object keyed by question id), `created_at` |

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard: create-form UI + list of forms with share links |
| `/forms/[id]` | Submissions for one form |
| `/fill/[id]` | Respondent page: toggle between form controls and AI chat |

## API

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/forms` | List / create forms |
| `GET /api/forms/[id]` | Fetch one form (used by fill page) |
| `GET/POST /api/forms/[id]/submissions` | List / create submissions |
| `POST /api/forms/[id]/chat` | AI assistant turn |
| `POST /api/forms/[id]/extract` | Document upload → derived answers |

## AI design

One **stateless chat endpoint**. The client sends the full message history and
the current answers object; the server prompts DeepSeek with the form schema
and requires a JSON response:

```json
{ "reply": "...", "answers": { "q1": "Bryan" }, "ready_to_submit": false }
```

- The model merges new/changed answers into `answers` — this single contract
  covers natural extraction, answer updates, and tracking.
- The system prompt instructs the model to ask for missing required fields
  and, once none remain, to summarize all answers and set
  `ready_to_submit: true`; the client then shows a summary with a Submit
  button.
- The client renders an answered/unanswered checklist directly from the
  `answers` object — no extra bookkeeping.

**Document extraction** reuses the shape: the server extracts text locally
(`unpdf` for PDFs, `.txt`/`.md` read as-is), sends it with the form schema,
and gets back `{ "answers": {...}, "missing": ["q3", ...] }`. The result
pre-fills answers in either mode and the chat reports what is still missing.

Model: **DeepSeek V4 Flash** (`deepseek-v4-flash`) via the OpenAI-compatible
API (`https://api.deepseek.com`, `DEEPSEEK_API_KEY`), called with the `openai`
npm SDK using a custom `baseURL`.

## Tech stack

- **Next.js (App Router) + TypeScript** — one app serves UI and API.
- **better-sqlite3** — real persistence in one file, no ORM, no config.
- **openai SDK + DeepSeek V4 Flash** — chat + extraction.
- **unpdf** — PDF → text, since DeepSeek cannot ingest PDFs natively.

Rationale for each choice lives in [roadmap.md](roadmap.md).
