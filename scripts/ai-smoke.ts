// On-demand AI smoke test (costs tokens): npm run test:ai
// Runs the seeded fixture form + sample document through extraction and one
// chat update, asserting the pipeline's contracts hold with real AI output.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chatTurn, extractAnswers } from "../lib/ai.ts";
import { listForms } from "../lib/db.ts";

const form = listForms().find((f) => f.title === "Event Booking Request");
assert.ok(form, "seeded Event Booking Request form exists");

const text = readFileSync("fixtures/sample-document.txt", "utf8");
const extracted = await extractAnswers(form, text);
console.log("extracted:", JSON.stringify(extracted, null, 2));
assert.ok(Object.keys(extracted.answers).length >= 4, "extracts at least 4 answers from the document");
assert.equal(extracted.answers.q4, "Vegan", "meal preference mapped to the exact dropdown option");
assert.ok(extracted.missing.includes("q5"), "special requests (absent from the document) reported missing");

const turn = await chatTurn(
  form,
  [{ role: "user", content: "Actually, change the guest count to 30 please." }],
  extracted.answers
);
console.log("chat reply:", turn.reply);
assert.equal(turn.answers.q3, "30", "chat updates a previously extracted answer");
assert.equal(turn.answers.q4, "Vegan", "untouched answers survive the merge");

console.log("\nAI smoke passed ✓");
