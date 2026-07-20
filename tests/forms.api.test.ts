import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { coerceAnswers, normalizeQuestions, validateAnswers } from "../lib/validate.ts";
import { readUpload } from "../lib/upload.ts";

const dir = mkdtempSync(path.join(tmpdir(), "party-te-api-"));
process.env.PARTY_TE_DB = path.join(dir, "api.db");
const prevKey = process.env.MOONSHOT_API_KEY;
delete process.env.MOONSHOT_API_KEY;
const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

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
  if (prevKey !== undefined) process.env.MOONSHOT_API_KEY = prevKey;
  else delete process.env.MOONSHOT_API_KEY;
  if (prevAnthropicKey !== undefined) process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  else delete process.env.ANTHROPIC_API_KEY;
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
  await assert.rejects(() => chatTurn(form, [{ role: "user", content: "hi" }], {}), /ANTHROPIC_API_KEY/);
  await assert.rejects(() => generateForm("RSVP"), /ANTHROPIC_API_KEY/);
  await assert.rejects(
    () => draftFormTurn([{ role: "user", content: "hi" }], { title: "", description: "", questions: [] }),
    /ANTHROPIC_API_KEY/
  );
});

test("upload guard rejects unsupported type (415)", async () => {
  const res = await readUpload(new File(["x"], "data.zip", { type: "application/zip" }));
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 415);
});

test("upload guard rejects image when caller does not opt in (415)", async () => {
  const res = await readUpload(new File(["x"], "photo.png", { type: "image/png" }));
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 415);
});

test("upload guard returns image kind when allowed", async () => {
  const res = await readUpload(
    new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" }),
    { image: true }
  );
  assert.ok(res.ok && res.kind === "image", "expected ok image result");
  if (res.ok && res.kind === "image") assert.match(res.dataUrl, /^data:image\/png;base64,/);
});

test("docx without API key maps to 503 (file extraction unavailable)", async () => {
  const res = await readUpload(new File(["x"], "brief.docx"));
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 503);
    assert.match(res.error, /MOONSHOT_API_KEY/);
  }
});

test("upload guard reads sample txt", async () => {
  const res = await readUpload(new File(["Hello Bryan"], "note.txt", { type: "text/plain" }));
  assert.ok(res.ok && res.kind === "text", "expected ok text result");
  if (res.ok && res.kind === "text") assert.match(res.text, /Bryan/);
});
