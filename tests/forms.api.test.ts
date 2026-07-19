import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { coerceAnswers, normalizeQuestions, validateAnswers } from "../lib/validate.ts";
import { readUploadText } from "../lib/upload.ts";

const dir = mkdtempSync(path.join(tmpdir(), "party-te-api-"));
process.env.PARTY_TE_DB = path.join(dir, "api.db");
const prevKey = process.env.DEEPSEEK_API_KEY;
delete process.env.DEEPSEEK_API_KEY;

const {
  resetDbForTests,
  listForms,
  getForm,
  createForm,
  deleteForm,
  createSubmission,
  listSubmissions,
} = await import("../lib/db.ts");

test.after(() => {
  resetDbForTests();
  rmSync(dir, { recursive: true, force: true });
  if (prevKey !== undefined) process.env.DEEPSEEK_API_KEY = prevKey;
  else delete process.env.DEEPSEEK_API_KEY;
});

test("create form pipeline mirrors POST /api/forms", () => {
  const questions = normalizeQuestions([{ label: "Name", type: "text", required: true }]);
  assert.ok(questions);
  const id = createForm("API Form", questions, "");
  assert.ok(getForm(id));
});

test("bad questions rejected like 400", () => {
  assert.equal(normalizeQuestions([]), null);
});

test("submission validation mirrors POST .../submissions", () => {
  const form = listForms().find((f) => f.title === "Event Booking Request");
  assert.ok(form);
  const bad = validateAnswers(form.questions, { q1: "A" });
  assert.equal(bad.ok, false);

  const answers = coerceAnswers(form.questions, {
    q1: "Ada",
    q2: "2026-08-02",
    q3: "10",
    q4: "vegan",
  });
  const ok = validateAnswers(form.questions, answers);
  assert.equal(ok.ok, true);
  const subId = createSubmission(form.id, answers, "form");
  assert.ok(listSubmissions(form.id).some((s) => s.id === subId && s.via === "form"));
});

test("delete cascades like DELETE /api/forms/[id]", () => {
  const id = createForm("Temp", [{ id: "q1", label: "A", type: "text", required: false }]);
  createSubmission(id, { q1: "x" });
  assert.equal(deleteForm(id), true);
  assert.equal(getForm(id), undefined);
  assert.equal(listSubmissions(id).length, 0);
  assert.equal(deleteForm(id), false);
});

test("AI helpers throw without API key (routes map to 503)", async () => {
  const { chatTurn, generateForm, draftFormTurn } = await import("../lib/ai.ts");
  const form = listForms()[0];
  await assert.rejects(() => chatTurn(form, [{ role: "user", content: "hi" }], {}), /DEEPSEEK_API_KEY/);
  await assert.rejects(() => generateForm("RSVP"), /DEEPSEEK_API_KEY/);
  await assert.rejects(
    () => draftFormTurn([{ role: "user", content: "hi" }], { title: "", description: "", questions: [] }),
    /DEEPSEEK_API_KEY/
  );
});

test("upload guard rejects unsupported type (415)", async () => {
  const res = await readUploadText(new File(["x"], "photo.png", { type: "image/png" }));
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 415);
});

test("upload guard reads sample txt", async () => {
  const res = await readUploadText(new File(["Hello Bryan"], "note.txt", { type: "text/plain" }));
  assert.equal(res.ok, true);
  if (res.ok) assert.match(res.text, /Bryan/);
});
