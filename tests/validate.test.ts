import test from "node:test";
import assert from "node:assert/strict";
import { coerceAnswers, isAnswered, normalizeQuestions, validateAnswers } from "../lib/validate.ts";
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

const extQuestions: Question[] = [
  { id: "q1", label: "Toppings", type: "checkbox", options: ["Cheese", "Olives", "Ham"], required: true },
  { id: "q2", label: "Rating", type: "rating", max: 5, required: true },
  { id: "q3", label: "Date", type: "date", required: false },
];

test("checkbox validation: subset ok, unmatched invalid, empty array missing", () => {
  assert.equal(validateAnswers(extQuestions, { q1: ["Cheese", "Ham"], q2: "4" }).ok, true);
  assert.deepEqual(validateAnswers(extQuestions, { q1: ["Cheese", "Pineapple"], q2: "4" }).invalid, ["q1"]);
  assert.deepEqual(validateAnswers(extQuestions, { q1: [], q2: "4" }).missing, ["q1"]);
});

test("rating validation: in-range string ok, out of range or junk invalid", () => {
  assert.equal(validateAnswers(extQuestions, { q1: ["Cheese"], q2: "5" }).ok, true);
  assert.deepEqual(validateAnswers(extQuestions, { q1: ["Cheese"], q2: "6" }).invalid, ["q2"]);
  assert.deepEqual(validateAnswers(extQuestions, { q1: ["Cheese"], q2: "abc" }).invalid, ["q2"]);
});

test("date validation requires YYYY-MM-DD", () => {
  assert.equal(validateAnswers(extQuestions, { q1: ["Cheese"], q2: "3", q3: "2026-08-02" }).ok, true);
  assert.deepEqual(validateAnswers(extQuestions, { q1: ["Cheese"], q2: "3", q3: "Aug 2" }).invalid, ["q3"]);
});

test("normalizeQuestions handles checkbox and rating", () => {
  assert.equal(normalizeQuestions([{ label: "Pick", type: "checkbox", options: ["a"] }]), null);
  const qs = normalizeQuestions([
    { label: "Pick", type: "checkbox", options: ["a", "b"] },
    { label: "Rate", type: "rating", max: 7 },
    { label: "Rate odd", type: "rating", max: 4 },
    { label: "Rate none", type: "rating" },
  ]);
  assert.ok(qs);
  assert.deepEqual(qs[0].options, ["a", "b"]);
  assert.deepEqual(qs.slice(1).map((q) => q.max), [7, 5, 5]);
});

test("coerceAnswers matches options case-insensitively and drops junk", () => {
  const a = coerceAnswers(extQuestions, {
    q1: ["cheese", "HAM", "pineapple"],
    q2: 4.4,
    q3: "2026-08-02",
    qX: "unknown id",
  });
  assert.deepEqual(a, { q1: ["Cheese", "Ham"], q2: "4", q3: "2026-08-02" });
  // lone string wrapped for checkbox; out-of-range rating and bad date dropped
  assert.deepEqual(coerceAnswers(extQuestions, { q1: "olives", q2: 9, q3: "next friday" }), { q1: ["Olives"] });
});

test("isAnswered treats blanks and empty arrays as unanswered", () => {
  assert.equal(isAnswered(undefined), false);
  assert.equal(isAnswered("  "), false);
  assert.equal(isAnswered([]), false);
  assert.equal(isAnswered("x"), true);
  assert.equal(isAnswered(["x"]), true);
});

test("multiple_choice validates like dropdown", () => {
  const qs: Question[] = [
    { id: "q1", label: "Hear", type: "multiple_choice", options: ["Friend", "Other"], required: true },
  ];
  assert.equal(validateAnswers(qs, { q1: "Friend" }).ok, true);
  assert.deepEqual(validateAnswers(qs, { q1: "Radio" }).invalid, ["q1"]);
  assert.deepEqual(coerceAnswers(qs, { q1: "friend" }), { q1: "Friend" });
});

test("rating max variants accept only their scale", () => {
  const qs: Question[] = [{ id: "q1", label: "Rate", type: "rating", max: 10, required: true }];
  assert.equal(validateAnswers(qs, { q1: "10" }).ok, true);
  assert.deepEqual(validateAnswers(qs, { q1: "11" }).invalid, ["q1"]);
});
