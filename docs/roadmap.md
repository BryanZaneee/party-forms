# Roadmap — AI-Powered Form Builder

Build order for the app described in [prd.md](prd.md). One milestone = one
commit (conventional prefix, subject ≤ 50 chars, body wrapped at 72).

## Milestones

| # | Commit subject | Delivers |
|---|----------------|----------|
| M0 | `docs: add assignment spec, PRD, and roadmap` | Repo init, spec/PRD/roadmap docs, CLAUDE.md commit rules, .gitignore |
| M1 | `chore: scaffold Next.js app with TypeScript` | Runnable empty app (`npm run dev`) |
| M2 | `feat: add SQLite persistence and forms API` | `db.ts`, forms + submissions tables, forms API routes |
| M3 | `feat: add dashboard with submissions view` | `/` create + list forms, `/forms/[id]` submissions |
| M4 | `feat: add respondent fill route and submit` | `/fill/[id]` traditional form controls, submission POST |
| M5 | `feat: add AI chat assistant fill mode` | Chat UI + `/api/forms/[id]/chat`, all six AI behaviors |
| M6 | `feat: add document upload with AI extraction` | Upload control + `/api/forms/[id]/extract` |
| M7 | `docs: add README with setup instructions` | README, `.env.example`, CLAUDE.md run/build commands |

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
- **Deliberately skipped** (and when to add): form edit/delete (add when the
  dashboard is more than a demo), streaming chat responses (add if turn
  latency annoys), image-document upload (add by swapping in a
  vision-capable model), tests beyond a couple of endpoint smoke checks (add
  with the first regression).

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
