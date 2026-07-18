import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuestions, validateAnswers } from "../lib/validate.ts";
import type { Question } from "../lib/types.ts";

const questions: Question[] = [
  { id: "q1", label: "Your name", type: "text", required: true },
  { id: "q2", label: "Meal", type: "dropdown", options: ["Veg", "Meat"], required: true },
  { id: "q3", label: "Notes", type: "textarea", required: false },
];

test("valid full submission passes", () => {
  const v = validateAnswers(questions, { q1: "Bryan", q2: "Veg", q3: "none" });
  assert.deepEqual(v, { missing: [], invalid: [], ok: true });
});

test("optional questions may be omitted", () => {
  assert.equal(validateAnswers(questions, { q1: "Bryan", q2: "Meat" }).ok, true);
});

test("missing required fields are reported", () => {
  const v = validateAnswers(questions, { q1: "  " });
  assert.deepEqual(v.missing, ["q1", "q2"]);
  assert.equal(v.ok, false);
});

test("choice answer outside options is invalid", () => {
  const v = validateAnswers(questions, { q1: "Bryan", q2: "Fish" });
  assert.deepEqual(v.invalid, ["q2"]);
  assert.equal(v.ok, false);
});

test("normalizeQuestions coerces ids, types, and required", () => {
  const qs = normalizeQuestions([
    { label: " Name ", type: "text", required: 1 },
    { label: "Meal", type: "dropdown", options: ["Veg", "Meat", ""] },
    { label: "Odd", type: "banana" },
  ]);
  assert.ok(qs);
  assert.deepEqual(
    qs.map((q) => [q.id, q.label, q.type, q.required]),
    [
      ["q1", "Name", "text", true],
      ["q2", "Meal", "dropdown", false],
      ["q3", "Odd", "text", false],
    ]
  );
  assert.deepEqual(qs[1].options, ["Veg", "Meat"]);
});

test("normalizeQuestions rejects unusable input", () => {
  assert.equal(normalizeQuestions([]), null);
  assert.equal(normalizeQuestions([{ label: "" }]), null);
  assert.equal(normalizeQuestions([{ label: "Meal", type: "dropdown", options: ["only-one"] }]), null);
  assert.equal(normalizeQuestions("nope"), null);
});
