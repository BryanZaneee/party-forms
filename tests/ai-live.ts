import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AI_MODEL,
  aiCallMetrics,
  chatTurn,
  clearAiCallMetrics,
  draftFormTurn,
  extractAnswers,
  extractFileText,
  generateForm,
} from "../lib/ai.ts";
import { formatSuiteCostLine, rollupSuiteTotals } from "../lib/ai-metrics.ts";
import { listForms } from "../lib/db.ts";
import { normalizeQuestions } from "../lib/validate.ts";
import { scoreAnswers } from "./ai-score.ts";

if (!process.env.MOONSHOT_API_KEY) {
  throw new Error("MOONSHOT_API_KEY required for npm run test:ai (opt-in live suite)");
}

clearAiCallMetrics();
const suiteStarted = Date.now();

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

const restaurantForm = listForms().find((f) => f.title === "Restaurant Venue Profile");
assert.ok(restaurantForm, "seeded Restaurant Venue Profile form exists");

const restaurantExpected = JSON.parse(readFileSync("fixtures/expected-restaurant.json", "utf8")) as {
  answers: Record<string, string | string[]>;
  missing: string[];
};

function assertRestaurantExtract(label: string, extracted: Awaited<ReturnType<typeof extractAnswers>>) {
  console.log(`${label}:`, JSON.stringify(extracted, null, 2));
  const { accuracy, details } = scoreAnswers(
    restaurantForm!.questions,
    restaurantExpected.answers,
    extracted.answers
  );
  console.log(`${label} scorecard:`, details, `accuracy=${accuracy.toFixed(2)}`);
  assert.ok(accuracy >= 0.8, `${label}: field accuracy ${accuracy} < 0.8`);
  assert.equal(extracted.answers.q2, "Italian", `${label}: cuisine exact`);
  assert.equal(extracted.answers.q7, "Full bar", `${label}: alcohol service exact`);
  assert.ok(extracted.missing.includes("q11"), `${label}: contact email (required) missing`);
  assert.ok(extracted.missing.includes("q5"), `${label}: table count (optional) missing`);
}

test("restaurant TXT extract against fixture ground truth", async () => {
  const text = readFileSync("fixtures/restaurant-profile.txt", "utf8");
  assertRestaurantExtract("restaurant txt", await extractAnswers(restaurantForm!, text));
});

test("restaurant PDF extract against fixture ground truth", async () => {
  const pdfBytes = new Uint8Array(readFileSync("fixtures/restaurant-profile.pdf"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  assert.ok(text.trim().length > 0);
  assertRestaurantExtract("restaurant pdf", await extractAnswers(restaurantForm!, text.trim()));
});

test("restaurant DOCX extract against fixture ground truth", async () => {
  const text = await extractFileText(
    new Uint8Array(readFileSync("fixtures/restaurant-profile.docx")),
    "restaurant-profile.docx"
  );
  assert.match(text, /Tavolino Rosso/i, "file-extract returns plain document text");
  assertRestaurantExtract("restaurant docx", await extractAnswers(restaurantForm!, text.trim()));
});

test("restaurant image extract against fixture ground truth", async () => {
  const b64 = readFileSync("fixtures/restaurant-profile.png").toString("base64");
  assertRestaurantExtract(
    "restaurant image",
    await extractAnswers(restaurantForm!, { imageDataUrl: `data:image/png;base64,${b64}` })
  );
});

test("restaurant chat asks for missing required email, then becomes ready", async () => {
  const text = readFileSync("fixtures/restaurant-profile.txt", "utf8");
  const fromTxt = await extractAnswers(restaurantForm!, text);
  assert.ok(fromTxt.missing.includes("q11"), "extract leaves contact email missing");

  const ask = "I've uploaded our venue profile - is anything still needed before we submit?";
  const turn1 = await chatTurn(restaurantForm!, [{ role: "user", content: ask }], fromTxt.answers);
  console.log("restaurant chat turn 1:", turn1.reply);
  assert.equal(turn1.ready_to_submit, false, "not ready while required contact email is missing");

  const supply =
    "Our contact email is events@tavolinorosso.com. That is everything - please summarize so I can submit.";
  const turn2 = await chatTurn(
    restaurantForm!,
    [
      { role: "user", content: ask },
      { role: "assistant", content: turn1.reply },
      { role: "user", content: supply },
    ],
    turn1.answers
  );
  console.log("restaurant chat turn 2:", turn2.reply);
  assert.equal(turn2.answers.q11, "events@tavolinorosso.com");
  assert.equal(turn2.answers.q7, "Full bar", "earlier extracted answers preserved");

  // The model may hold ready_to_submit until the user confirms its summary.
  const confirm = "Yes, everything is correct.";
  const turn3 = await chatTurn(
    restaurantForm!,
    [
      { role: "user", content: ask },
      { role: "assistant", content: turn1.reply },
      { role: "user", content: supply },
      { role: "assistant", content: turn2.reply },
      { role: "user", content: confirm },
    ],
    turn2.answers
  );
  console.log("restaurant chat turn 3:", turn3.reply);
  assert.equal(turn3.answers.q11, "events@tavolinorosso.com", "email survives confirmation turn");
  assert.equal(turn3.ready_to_submit, true, "ready once required email supplied and summary confirmed");
});

test.after(() => {
  const totals = rollupSuiteTotals(aiCallMetrics);
  const report = {
    generated_at: new Date().toISOString(),
    model: AI_MODEL,
    suite_wall_clock_ms: Date.now() - suiteStarted,
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
  console.log(`Suite wall clock: ${(report.suite_wall_clock_ms / 1000).toFixed(1)}s`);
});
