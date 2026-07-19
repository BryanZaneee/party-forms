import test from "node:test";
import assert from "node:assert/strict";
import { revealAnswerOrder } from "../lib/extract-reveal.ts";
import type { Question } from "../lib/types.ts";

const questions: Question[] = [
  { id: "q1", label: "Name", type: "text", required: true },
  { id: "q2", label: "Meal", type: "dropdown", options: ["Vegan"], required: true },
  { id: "q3", label: "Notes", type: "textarea", required: false },
];

test("revealAnswerOrder follows form order and skips unanswered", () => {
  assert.deepEqual(revealAnswerOrder(questions, { q2: "Vegan", q1: "Ada", q3: "  " }), ["q1", "q2"]);
});
