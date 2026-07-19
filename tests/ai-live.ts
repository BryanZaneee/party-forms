import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  aiCallMetrics,
  chatTurn,
  clearAiCallMetrics,
  draftFormTurn,
  extractAnswers,
  generateForm,
} from "../lib/ai.ts";
import { formatSuiteCostLine, rollupSuiteTotals } from "../lib/ai-metrics.ts";
import { listForms } from "../lib/db.ts";
import { normalizeQuestions } from "../lib/validate.ts";
import { scoreAnswers } from "./ai-score.ts";

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY required for npm run test:ai (opt-in live suite)");
}

clearAiCallMetrics();

const form = listForms().find((f) => f.title === "Event Booking Request");
assert.ok(form, "seeded Event Booking Request form exists");

const expected = JSON.parse(readFileSync("fixtures/expected-event-booking.json", "utf8")) as {
  answers: Record<string, string>;
  missing: string[];
};

function assertExtract(label: string, extracted: Awaited<ReturnType<typeof extractAnswers>>) {
  console.log(`${label}:`, JSON.stringify(extracted, null, 2));
  const { accuracy, details } = scoreAnswers(form!.questions, expected.answers, extracted.answers);
  console.log(`${label} scorecard:`, details, `accuracy=${accuracy.toFixed(2)}`);
  assert.ok(accuracy >= 0.8, `${label}: field accuracy ${accuracy} < 0.8`);
  assert.equal(extracted.answers.q4, "Vegan", `${label}: meal preference exact`);
  assert.ok(extracted.missing.includes("q5"), `${label}: special requests missing`);
}

test("TXT extract against fixture ground truth", async () => {
  const text = readFileSync("fixtures/sample-document.txt", "utf8");
  assertExtract("txt extract", await extractAnswers(form!, text));
});

test("PDF extract against fixture ground truth", async () => {
  const pdfBytes = new Uint8Array(readFileSync("fixtures/sample-document.pdf"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  assert.ok(text.trim().length > 0);
  assertExtract("pdf extract", await extractAnswers(form!, text.trim()));
});

test("chat updates extracted answer without losing others", async () => {
  const text = readFileSync("fixtures/sample-document.txt", "utf8");
  const fromTxt = await extractAnswers(form!, text);
  const turn = await chatTurn(
    form!,
    [{ role: "user", content: "Actually, change the guest count to 30 please." }],
    fromTxt.answers
  );
  console.log("chat reply:", turn.reply);
  assert.equal(turn.answers.q3, "30");
  assert.equal(turn.answers.q4, "Vegan");
});

test("generateForm returns normalizable schema", async () => {
  const drafted = await generateForm(
    "A short RSVP form for a company picnic: guest name, attending yes/no, meal choice, and dietary notes."
  );
  assert.ok(drafted.title.trim());
  assert.ok(drafted.questions.length >= 3);
  const normalized = normalizeQuestions(drafted.questions);
  assert.ok(normalized);
  assert.equal(normalized!.length, drafted.questions.length);
});

test("creator draftFormTurn from brief document", async () => {
  const brief = readFileSync("fixtures/creator-brief.txt", "utf8");
  const drafted = await draftFormTurn(
    [{ role: "user", content: "Please draft a form from the attached brief." }],
    { title: "", description: "", questions: [] },
    brief
  );
  console.log("creator draft:", JSON.stringify(drafted, null, 2));
  assert.ok(drafted.reply.trim());
  assert.ok(drafted.title.trim());
  assert.ok(drafted.questions.length >= 3);
  assert.ok(normalizeQuestions(drafted.questions));
});

test("partial document leaves most fields missing", async () => {
  const text = readFileSync("fixtures/partial-booking.txt", "utf8");
  const extracted = await extractAnswers(form!, text);
  console.log("partial:", JSON.stringify(extracted, null, 2));
  assert.ok(extracted.missing.length >= 3);
  if (extracted.answers.q4) assert.equal(extracted.answers.q4, "Vegan");
});

test.after(() => {
  const totals = rollupSuiteTotals(aiCallMetrics);
  const report = {
    generated_at: new Date().toISOString(),
    model: "deepseek-v4-flash",
    calls: aiCallMetrics,
    suite_totals: totals,
  };
  writeFileSync(path.join("tests", "last-run-metrics.json"), JSON.stringify(report, null, 2));
  console.log("\n--- Live AI metrics ---");
  for (const c of aiCallMetrics) {
    console.log(
      `${c.label}: ttft=${c.ttft_ms ?? "n/a"}ms latency=${c.latency_ms}ms ` +
        `tokens=${c.total_tokens} tps=${c.tokens_per_second.toFixed(1)} cost=$${c.cost_usd.toFixed(6)}`
    );
  }
  console.log(formatSuiteCostLine(totals));
});
