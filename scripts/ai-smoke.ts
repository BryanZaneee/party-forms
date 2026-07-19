// On-demand AI smoke test (costs tokens): npm run test:ai
// Seeded form + fixtures through TXT/PDF extract, one chat update, and form
// generate — asserts contracts against live DeepSeek output.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chatTurn, extractAnswers, generateForm } from "../lib/ai.ts";
import { listForms } from "../lib/db.ts";
import { normalizeQuestions } from "../lib/validate.ts";

const form = listForms().find((f) => f.title === "Event Booking Request");
assert.ok(form, "seeded Event Booking Request form exists");

function assertExtract(label: string, extracted: Awaited<ReturnType<typeof extractAnswers>>) {
  console.log(`${label}:`, JSON.stringify(extracted, null, 2));
  assert.ok(Object.keys(extracted.answers).length >= 4, `${label}: extracts at least 4 answers`);
  assert.equal(extracted.answers.q4, "Vegan", `${label}: meal preference mapped to exact option`);
  assert.ok(extracted.missing.includes("q5"), `${label}: special requests reported missing`);
}

const text = readFileSync("fixtures/sample-document.txt", "utf8");
const fromTxt = await extractAnswers(form, text);
assertExtract("txt extract", fromTxt);

const pdfBytes = new Uint8Array(readFileSync("fixtures/sample-document.pdf"));
const { extractText, getDocumentProxy } = await import("unpdf");
const pdf = await getDocumentProxy(pdfBytes);
const { text: pdfText } = await extractText(pdf, { mergePages: true });
assert.ok(pdfText.trim().length > 0, "PDF yields readable text via unpdf");
const fromPdf = await extractAnswers(form, pdfText.trim());
assertExtract("pdf extract", fromPdf);

const turn = await chatTurn(
  form,
  [{ role: "user", content: "Actually, change the guest count to 30 please." }],
  fromTxt.answers
);
console.log("chat reply:", turn.reply);
assert.equal(turn.answers.q3, "30", "chat updates a previously extracted answer");
assert.equal(turn.answers.q4, "Vegan", "untouched answers survive the merge");

const drafted = await generateForm(
  "A short RSVP form for a company picnic: guest name, attending yes/no, meal choice, and dietary notes."
);
console.log("generated:", JSON.stringify(drafted, null, 2));
assert.ok(drafted.title.trim().length > 0, "generate returns a non-empty title");
assert.ok(drafted.questions.length >= 3, "generate returns at least 3 questions");
const normalized = normalizeQuestions(drafted.questions);
assert.ok(normalized, "generated questions normalize to a valid schema");
assert.equal(normalized!.length, drafted.questions.length, "all generated questions normalize");
for (const q of drafted.questions) {
  assert.ok(typeof q.label === "string" && q.label.trim(), "each question has a label");
  assert.ok(typeof q.type === "string" && q.type.trim(), "each question has a type");
}

console.log("\nAI smoke passed ✓");
