# Handoff: Slate Forms — Form builder with AI assistant

## Overview
A lightweight forms product (working name "Party Forms") with four views: a dashboard of forms, a form builder with an "Draft with AI" sidebar, a public fill page with a conversational AI assistant that fills answers live, and a responses table with a detail view. Data persists locally; AI features call an LLM completion endpoint.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, NOT production code to ship. Your task is to **recreate this design in the target codebase's existing environment** (React, Vue, etc.) using its established patterns and libraries — or, if no codebase exists yet, choose an appropriate framework and implement it there. The prototype's logic (in the <script data-dc-script> block of `Slate Forms.dc.html`) is a faithful behavioral spec: routing, state shapes, AI prompts, and validation are all real and worth porting.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interactions are final. Recreate pixel-perfectly.

## Design Tokens
- Accent: **#e11d74** (pink) — primary buttons, focus rings, selected states, checked inputs (`accent-color`), chat user bubbles, status chips
- Accent soft: rgba(225,29,116,.09) — selected-option backgrounds, "ready to submit" card, checked chips, selected table rows
- Link hover: #b91560
- Page background: #eef1f6 · Card background: #fff
- Header/hero background: #070d1a (near-black) with an animated "paper shader" overlay (see Assets)
- Text: primary #0e1524 · headings-on-card #22304a · secondary #3a4a63 / #5c6b82 · muted #7a8699 / #9aa5b6
- Borders: card #e2e7f0 · inputs #d5dce8 · dashed affordances #b9c3d4 · row dividers #edf0f6
- Error/destructive: #c0392b (missing-required card border: #e08579)
- Font: "Helvetica Neue", Helvetica, Arial, sans-serif; body letter-spacing -0.01em
- Radii: cards 12px · panels 14px · inputs/small buttons 7–9px · pills 99px
- Shadows: cards 0 1px 2px rgba(15,25,50,.05) · sticky panels 0 6px 24px rgba(10,20,50,.07) · menus 0 10px 30px rgba(10,20,50,.14)
- Focus: 2px solid accent outline, offset 1px, on all inputs/textareas/selects

## Screens / Views
Hash routing: `#/` dashboard · `#/new` + `#/edit/:id` builder · `#/fill/:id` fill page · `#/responses/:id` responses.

Every screen shares a dark hero header: #070d1a background, animated shader layer (accent-pink #e11d74 on #070d1a, speed 0.65), content max-width 1100px (builder hero 860px), white title (24–32px, weight 700, letter-spacing -0.02em), 75%-opacity white back-link.

### 1. Dashboard (`#/`)
- Hero: "P" logo chip (22px, white, radius 6) + "Party Forms" label; "Your forms" 32px title + form count; white "＋ New form" button right-aligned.
- Body: responsive card grid `repeat(auto-fill, minmax(320px, 1fr))`, gap 16px.
- Form card: title 17px/600 (click → edit), created date 12px muted right, description 13.5px, question-count meta 12.5px, then a button row: accent "Fill out", outlined "Responses (n)", spacer, "⋯" overflow. Overflow opens an absolute menu (Edit / Copy share link / Duplicate / Delete-in-red) anchored bottom-right of the card.
- Empty state: centered "No forms yet" copy.

### 2. Builder (`#/new`, `#/edit/:id`)
Two-column flex (1.6 / 1, gaps 20px, wraps under ~760px).
- Left: title/description card (title = borderless input with 2px bottom border), then one card per question:
  - Row: drag handle "⠿" (cursor grab), number, question-label input (flex), type select (Short text, Long text, Multiple choice, Checkboxes, Dropdown, Rating, Date).
  - Choice types show option rows: glyph (○ / ☐ / A.) + input + ✕ remove; dashed "＋ Add option" button.
  - Rating shows a scale select (1–3/5/7/10).
  - Footer: "Required" checkbox (accent) + red "Remove".
  - Drag-and-drop reorder: dragged card at 0.45 opacity; drop-target card border turns accent.
- "＋ Add question" full-width dashed button opens a 2-column popover of the 7 types.
- "Save form" accent button + "Cancel" link. Save trims empty questions/options, defaults title to "Untitled form", returns to dashboard.
- Right (sticky, top 16px): "Draft with AI" panel — accent dot + heading, explainer copy, textarea, accent "✦ Draft form with AI" button ("Drafting…" while busy), inline red error. Generated questions PREFILL the builder rows (title/description only filled if still empty) for review before saving.

### 3. Fill page (`#/fill/:id`)
Hero adds a progress pill ("3 of 7 answered", white 12% bg, 99px radius) and shows form title + description.
Two-column flex (1.25 / 1).
- Left — form column: one card per question. Header row: label 15px/600, red * if required, "✓ answered" accent chip when filled. Inputs by type: text input / textarea / date input / select / radio list / checkbox list / rating buttons (42px squares; selected = accent bg, white text). Chosen radio/checkbox options get accent border + accent-soft bg. Missing required after submit attempt: card border #e08579 + "This question is required." Accent "Submit response" button.
- Right — AI assistant panel (sticky): header (accent dot, "AI assistant", "answers fill in live"), a wrap row of per-question status chips (✓ accent when answered, ○ gray otherwise, * on required), 380px scrollable chat (assistant bubbles white, user bubbles accent/white, 12px radius, auto-scrolls to bottom), blinking ●●● typing indicator, composer (textarea, Enter sends, Shift+Enter newline; accent "Send"), and a "📄 Upload a document" dashed label wrapping a hidden file input (.txt/.md/.csv/.json/.html — read client-side, truncated to 14k chars, sent to the AI).
- When AI reports all required answered: "Ready to submit" card (accent border, accent-soft bg) with its own Submit button — the AI NEVER auto-submits.
- Submitted state replaces both columns: centered card, accent-soft ✓ circle, "Response submitted", "Fill out again" + Dashboard link.

### 4. Responses (`#/responses/:id`)
- Table card: CSS grid `150px 90px repeat(min(4, questionCount), 1fr)`, min-width 760px, horizontal scroll. Uppercase 12px headers on #f8fafd. Columns: Submitted (e.g. "Jul 16, 2:05 PM"), Via ("🤖 AI" or "Form"), first 4 questions. Cells ellipsize; whole row clickable.
- Clicking a row opens a detail card ABOVE the table (accent-soft highlight on the selected row): "Response · when · via", ✕ Close, then a 280px/1fr label-value grid of every question. Arrays join with ", "; empty = "—".
- Empty state: copy + accent "Copy fill link" button.

### Global
Toast: fixed bottom-center dark pill (#0e1524, white 13.5px, 99px radius), auto-dismiss 2.2s — used for link-copied and validation nudges.

## Interactions & Behavior
- Hash-based routing; route change resets fill state and seeds the chat greeting.
- Copy share link writes `<origin>#/fill/:id` to clipboard + toast.
- Duplicate deep-copies a form with new ids and "(copy)" suffix.
- Delete confirms, removes form AND its responses.
- Manual submit validates required questions; failures set red borders + toast.
- Hover states: white buttons darken border to #aab6c9; menu items bg #f3f5f9; dashed affordances turn accent; delete hover bg #fdf0ee.
- Typing indicator: three dots with staggered 1.2s blink keyframes.

## AI Integration (behavioral spec — port the prompts verbatim)
Both features call an LLM completion API (prototype uses `window.claude.complete({system, messages, max_tokens: 2000})`; swap for your backend's LLM endpoint).
1. **Draft with AI (builder)**: system prompt asks for minified JSON `{title, description, questions:[{label,type,required,options,max?}]}`. Response is validated (type whitelist, option coercion, rating max ∈ {3,5,7,10}) before prefilling.
2. **Fill assistant**: system prompt includes the form's question JSON, type semantics, and current answers; the model returns `{reply, updates, ready_to_submit}`. Updates are coerced per type (options case-insensitively matched to the exact defined options; ratings clamped 1..max; check answers arrayed) — unmatched values are DROPPED, never guessed. `ready_to_submit` only surfaces the submit card once required questions are actually answered client-side. JSON parsing is defensive (strips fences, extracts first {...} span, falls back to plain-text reply).
Exact prompt text: see `buildSystem()` and `generateForm()` in the dc script.

## State Management
- `forms`: [{id, createdAt, title, description, questions:[{id, type, label, required, options[], max?}]}] — types: short | long | radio | check | drop | rating | date.
- `responses`: [{id, formId, submittedAt, via: 'form'|'ai', answers: {questionId: string|string[]|number}}].
- Persistence: localStorage keys `slateforms.forms.v1` / `slateforms.responses.v1`; seeds a demo "Team Offsite RSVP" form with 2 responses on first run (see `seed()`).
- Transient: route, builder draft (deep copy, committed on save), fillAnswers, missing[], chat[], busy flags, detailId, toast, drag indices, open menus.

## Assets
- `paper-shader.js` — custom `<paper-shader>` element rendering the animated hero texture. Attributes used: `color-back="#070d1a" color-front="#e11d74" shape="simplex" type="8x8" px-size="2.5" speed="0.65"`. Port or reuse as a canvas/WebGL background; a static dark header is an acceptable fallback.
- No images or icon fonts; glyphs are unicode (⠿ ○ ☐ ✕ ✓ ⋯ ＋ ✦ ●) and two emoji (📄 upload, 🤖 AI-via badge).

## Files
- `Slate Forms.dc.html` — the full prototype: markup (template between <x-dc> tags) + all logic (script at bottom)
- `paper-shader.js` — hero shader web component
- `support.js` — prototype runtime only; do NOT port
