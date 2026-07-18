# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Take-home assignment (~2-3 hours scope): an AI-powered form builder web app.
Full spec: `docs/PartyPlaceEngAssignment.pdf` (transcribed in
`docs/assignment-text.md`). Product design: `docs/prd.md`. Build order,
tooling rationale, and the append-only decision/prompt log: `docs/roadmap.md`.

## Requirements summary

- **Dashboard**: create forms, list existing forms, view submitted answers per form.
- **Persistence**: forms and answers survive restarts (approach is open).
- **Form completion** via a shareable link/route, two modes:
  1. Traditional form controls.
  2. AI assistant that conducts a conversation, extracts answers from natural
     language, updates changed answers, tracks answered/unanswered questions,
     asks for missing required fields, and shows a summary before submission.
- **Document upload**: AI interprets an uploaded document, derives form answers,
  and reports what's still missing.
- Explicitly out of scope: auth, user accounts, advanced config, visual polish.
  Evaluation focuses on functionality, prioritization, and engineering decisions.

## Current state

- Repo initialized; docs complete (M0 in `docs/roadmap.md`). No application
  code yet — the build starts at M1.
- Stack (decided): Next.js (App Router) + TypeScript, better-sqlite3 for
  persistence, DeepSeek V4 Flash (`deepseek-v4-flash`, OpenAI-compatible API,
  `DEEPSEEK_API_KEY`) for the AI assistant and document extraction.
- Once the app is scaffolded, update this file with build/run/test commands.
- Every prompt-level request or decision gets appended to the Decision &
  Prompt Log in `docs/roadmap.md`, in chronological order.

## Commit messages

Conventional-commit style, 50/72 rule:

- **Subject ≤ 50 chars**, imperative mood, no trailing period: `<prefix>: <what>`
- Blank line, then **body wrapped at 72 chars** — explain what and why, not how
- Prefixes: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:` `perf:` `style:` `ci:` `build:` `revert:`
- One logical change per commit; body optional for trivial changes
- One milestone from `docs/roadmap.md` = one commit
