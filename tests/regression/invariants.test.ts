import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { coerceAnswers, normalizeQuestions, validateAnswers } from "../../lib/validate.ts";
import type { Answers, Question } from "../../lib/types.ts";

const dir = mkdtempSync(path.join(tmpdir(), "party-te-reg-"));
process.env.PARTY_TE_DB = path.join(dir, "reg.db");

const { SEED_QUESTIONS, listForms, resetDbForTests } = await import("../../lib/db.ts");

test.after(() => {
  resetDbForTests();
  rmSync(dir, { recursive: true, force: true });
});

test("seeded Event Booking Request schema is stable", () => {
  const form = listForms().find((f) => f.title === "Event Booking Request");
  assert.ok(form);
  assert.deepEqual(
    form.questions.map((q) => q.id),
    ["q1", "q2", "q3", "q4", "q5", "q6"]
  );
  assert.ok(form.questions.find((q) => q.id === "q4")?.options?.includes("Vegan"));
  assert.deepEqual(form.questions, SEED_QUESTIONS);
});

test("coerceAnswers case-insensitive option match is stable", () => {
  const qs: Question[] = [
    { id: "q4", label: "Meal", type: "dropdown", options: ["Vegetarian", "Meat", "Vegan"], required: true },
  ];
  assert.deepEqual(coerceAnswers(qs, { q4: "vegan" }), { q4: "Vegan" });
});

test("ready_to_submit gating: required missing blocks readiness", () => {
  const answers: Answers = { q1: "A", q2: "2026-01-01", q3: "2" };
  const after = validateAnswers(SEED_QUESTIONS, answers);
  const modelReady = true;
  const ready = modelReady && after.missing.length === 0;
  assert.equal(ready, false);
  assert.ok(after.missing.includes("q4"));
});

test("normalizeQuestions rewrites ids to q1..qn", () => {
  const qs = normalizeQuestions([
    { id: "custom", label: "A", type: "text", required: true },
    { label: "B", type: "text", required: false },
  ]);
  assert.ok(qs);
  assert.deepEqual(
    qs.map((q) => q.id),
    ["q1", "q2"]
  );
});
