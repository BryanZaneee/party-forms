# Roadmap — AI-Powered Form Builder

Build order for the app described in [prd.md](prd.md). One milestone = one
commit (conventional prefix, subject ≤ 50 chars, body wrapped at 72).

## Milestones

| # | Commit subject | Delivers |
|---|----------------|----------|
| M0 | `docs: add assignment spec, PRD, and roadmap` | Repo init, spec/PRD/roadmap docs, CLAUDE.md commit rules, .gitignore |
| M1 | `chore: scaffold Next.js app with TypeScript` | Runnable empty app (`npm run dev`) |
| M2 | `feat: add SQLite persistence and forms API` | `db.ts` with seeded sample form, forms + submissions tables, create/submit routes with validation, `node --test` validation test |
| M3 | `feat: add dashboard with submissions view` | `/` row-based builder + list forms, `/forms/[id]` submissions |
| M4 | `feat: add respondent fill route and submit` | `/fill/[id]` traditional form controls, shared answers state, submission POST |
| M5 | `feat: add AI chat assistant fill mode` | Chat UI + `/api/forms/[id]/chat`, all six AI behaviors, `.env.example` |
| M6 | `feat: add document upload with AI extraction` | Upload control + `/api/forms/[id]/extract`, `fixtures/sample-document.txt` + PDF twin, AI smoke script |
| M7 | `feat: add AI form generation to dashboard` | "Describe your form" box + `/api/forms/generate`, prefills builder rows |
| M8 | `docs: add README with setup instructions` | README, CLAUDE.md run/build commands |

## Functionality, prioritization, engineering decisions

- **Traditional path first (M2–M4), AI second (M5–M6).** M4 is already a
  complete, demoable form product; the AI layers on top of a working
  submission pipeline instead of being built against a mock. If time runs
  out, the app still satisfies the non-AI half of the spec.
- **One stateless chat endpoint** instead of server-side conversation state:
  the client holds history + answers, so there is no session store to build
  and the endpoint is trivially restartable — persistence stays where the
  spec requires it (forms, submissions) and nowhere else.
- **JSON columns over normalized answer rows.** Questions and answers are
  read and written as whole documents; nothing queries individual answers.
  Normalization would add joins for zero features at this scope.
- **No RAG/embeddings.** Form schemas and uploaded documents fit whole in
  the model's context window, so every AI call stuffs the full schema (and
  full document text) into context — the model sees 100% of the evidence.
  Retrieval would add a top-k miss risk and vector-store infrastructure for
  negative accuracy gain. Revisit only for a multi-document corpus or
  documents larger than the context window, and then via chunked multi-pass
  extraction merged in code. Accuracy comes from determinism instead:
  code-computed missing-field lists injected each turn, submission-boundary
  validation, JSON-mode output validated with one retry (see PRD
  "Accuracy").
- **Shared answers state on the fill page.** Form tab, chat tab, and the
  document upload all read/write one `answers` object, so respondents can
  mix modes freely and nothing is lost switching — one React state object,
  zero extra cost, strongest demo moment.
- **The AI never submits.** `ready_to_submit` only makes the client render
  a summary and a real Submit button; both modes post through the same
  validated submissions endpoint.
- **Graceful degradation.** No API key / API outage → chat, extract, and
  generate return clear errors; the dashboard and traditional mode never
  touch the AI, so the non-AI half of the spec always works.
- **Reads via server components, writes via API routes.** Pages query
  SQLite directly; only browser-time calls (create, generate, submit, chat,
  extract) get endpoints. Fewer files, no client fetch for static reads.
- **Fixtures double as test data.** The seeded form and sample document are
  both the instant demo and the ground truth the validation tests and AI
  smoke script assert against.
- **Thinking mode off** for DeepSeek calls — per-turn latency for no
  accuracy gain at this schema size (easyagent enables it; this app does
  not).
- **Deliberately skipped** (and when to add): form edit/delete (add when the
  dashboard is more than a demo), streaming chat responses (add if turn
  latency annoys), image-document upload (add by swapping in a
  vision-capable model), tests beyond the validation unit test and AI smoke
  script (add with the first regression).

## Tooling justifications

| Tool | Why |
|------|-----|
| Next.js (App Router) + TypeScript | One codebase for UI and API, one `npm run dev` for the local demo, familiar to reviewers |
| better-sqlite3 | Persistence that survives restarts with zero setup; a real DB signal without ORM/migration overhead in a 2-3h budget |
| DeepSeek V4 Flash | Model already in use in the author's `easyagent` project (same key, known behavior); cheap and fast enough for a live demo |
| openai npm SDK | DeepSeek's API is OpenAI-compatible; a custom `baseURL` is the entire integration |
| unpdf | DeepSeek is text-only, so PDFs need local text extraction; unpdf is a small serverless-friendly lib with no native deps |
| Claude Code (Fable 5) | Coding assistant; plan mode for the design phase, ponytail plugin to force minimal implementations |

## Decision & Prompt Log

Append-only, chronological. Every prompt-level request and choice made in the
project, from start to finish.

1. **2026-07-18 — Initial prompt.** Deep-analyze the assignment spec; build a
   simple dashboard (create forms, view forms, view submitted answers) with a
   respondent link offering traditional controls and an AI assistant (six
   required behaviors) plus AI document upload. Produce a PRD recording the
   general build and a roadmap with milestones for git commits, ending with
   functionality/prioritization/engineering decisions and justifications for
   frameworks, libraries, AI models, and tools. Init the repo; set 50/72
   conventional-commit style (`feat:`, `fix:`, `docs:`, …) in CLAUDE.md.
2. **2026-07-18 — Mid-planning prompt.** Also record what was asked for in
   the prompts, in order, in this decision log — this section exists because
   of that request.
3. **2026-07-18 — Planning Q&A choices.** Stack: Next.js + TypeScript.
   Persistence: SQLite via better-sqlite3. Model: DeepSeek V4 Flash, reusing
   the `easyagent` repo's setup (OpenAI-compatible API, `DEEPSEEK_API_KEY`).
   Scope: docs + repo init first, review before building.
4. **2026-07-18 — Mid-planning prompt.** Apply the ponytail (minimal-build)
   skill to planning: stdlib/platform first, fewest files, shortest working
   diff, no speculative abstraction.
5. **2026-07-18 — M0 executed.** Repo initialized, docs written, commit rules
   added to CLAUDE.md.
6. **2026-07-18 — Accuracy prompt.** User asked how to best store forms,
   guarantee complete submissions, and maximize document-extraction and
   AI-agent accuracy — and whether RAG/embeddings would help. Decision: no
   RAG/embeddings (everything fits in context; retrieval only adds a miss
   risk and infra). Accuracy via determinism: full-context stuffing,
   code-computed missing-field tracking injected each turn,
   submission-boundary validation, JSON-mode structured output with
   validation + one retry, low temperature for extraction. Storage stays
   better-sqlite3.
7. **2026-07-18 — Design-review prompt.** User asked what other aspects of
   the design should be questioned before coding. Technical defaults
   chosen: shared answers state across fill modes; AI never auto-submits
   (client Submit button through the validated endpoint); graceful
   degradation when the AI is unavailable; DeepSeek thinking mode off;
   ~5 MB upload cap with truncation and a scanned-PDF "couldn't read"
   message; reads via server components with only five POST endpoints;
   better-sqlite3 `serverExternalPackages` + node-runtime gotchas recorded;
   `crypto.randomUUID()` ids; `.env.example` moved to M5.
8. **2026-07-18 — Design-review Q&A choices.** Builder UX: row-based
   builder **plus** AI generation from a description (`/api/forms/generate`
   prefills the builder rows for review before saving) — added as M7.
   Fixtures: yes, and they double as test data — seeded "Event Booking
   Request" form and a sample document that answers most-but-not-all
   questions, asserted against by the validation tests and an on-demand AI
   smoke script.
9. **2026-07-18 — Backend/UI split prompt.** UI is being built separately
   with Claude Design; this repo's backend proceeds now on main (scaffold
   first). Ownership boundary: backend owns `package.json` deps,
   `next.config.ts`, `lib/`, `app/api/`, `fixtures/`, `scripts/`, `tests/`,
   `.env.example`, and docs; UI owns `app/` pages, components, and styling.
   The interface contract is `lib/types.ts`, the `lib/db.ts` function
   signatures, and the five POST endpoints in the PRD — UI server
   components read via `lib/db`, client components call only the POST
   routes.
