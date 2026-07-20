import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Answers, Question } from "../lib/types.ts";
import { coerceAnswers, normalizeQuestions } from "../lib/validate.ts";

const big = JSON.parse(readFileSync("fixtures/BIG-restaurant-form.json", "utf8")) as {
  title: string;
  description: string;
  questions: Question[];
};
const expected = JSON.parse(readFileSync("fixtures/expected-BIG-restaurant-onboarding.json", "utf8")) as {
  answers: Answers;
  missing: string[];
};

// The four labels deliberately absent from the filler packet.
const GAP_LABELS = ["Events manager email", "Buyout minimum spend", "Liquor license number", "Insurance provider"];

test("BIG form fixture defines 100+ questions that survive normalization", () => {
  assert.ok(big.questions.length > 100, `only ${big.questions.length} questions`);
  const normalized = normalizeQuestions(big.questions);
  assert.ok(normalized, "normalizeQuestions accepts the fixture");
  assert.equal(normalized.length, big.questions.length, "no questions dropped");
  assert.deepEqual(
    normalized.map((q) => q.id),
    big.questions.map((q) => q.id),
    "fixture ids already match the normalized q1..qn order"
  );
});

test("BIG ground truth has 100+ answers and exactly 4 required gaps", () => {
  assert.ok(Object.keys(expected.answers).length > 100, "over 100 answers");
  assert.equal(expected.missing.length, 4, "exactly 4 gaps");
  const byId = new Map(big.questions.map((q) => [q.id, q]));
  for (const id of expected.missing) {
    const q = byId.get(id);
    assert.ok(q, `${id} exists in the form`);
    assert.ok(q.required, `${id} (${q.label}) is required so the agent must ask`);
    assert.ok(!(id in expected.answers), `${id} not also answered`);
  }
  assert.equal(
    Object.keys(expected.answers).length + expected.missing.length,
    big.questions.length,
    "answers + gaps cover every question"
  );
});

test("BIG expected answers pass coerceAnswers untouched", () => {
  // Guards option/type drift between the form fixture and the ground truth.
  assert.deepEqual(coerceAnswers(big.questions, expected.answers), expected.answers);
});

test("BIG packet PDF yields readable text without the four gaps", async () => {
  const pdfBytes = new Uint8Array(readFileSync("fixtures/BIG-restaurant-onboarding-packet.pdf"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  assert.match(text, /Casa Miravella/i);
  assert.match(text, /Wood-fired paella/i);
  assert.ok(text.length < 50_000, "under the upload extraction cap");
  for (const label of GAP_LABELS) {
    assert.ok(!text.includes(label), `packet must not mention "${label}"`);
  }
});

test("BIG brief PDF yields readable text listing 100+ questions", async () => {
  const pdfBytes = new Uint8Array(readFileSync("fixtures/BIG-restaurant-form-brief.pdf"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  assert.match(text, /Casa Miravella/i);
  assert.ok(text.length < 50_000, "under the upload extraction cap");
  const numbered = text.match(/\b\d{1,3}\.\s/g) ?? [];
  assert.ok(numbered.length >= 100, `only ${numbered.length} numbered questions in extracted text`);
  for (const label of GAP_LABELS) {
    assert.ok(text.includes(label), `brief still asks for "${label}"`);
  }
});
