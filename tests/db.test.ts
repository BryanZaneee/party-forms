import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "party-te-db-"));
const dbPath = path.join(dir, "test.db");
process.env.PARTY_TE_DB = dbPath;

const {
  SEED_QUESTIONS,
  createForm,
  createSubmission,
  deleteForm,
  getForm,
  listForms,
  listSubmissions,
  resetDbForTests,
} = await import("../lib/db.ts");

test.after(() => {
  resetDbForTests();
  rmSync(dir, { recursive: true, force: true });
});

test("empty DB seeds Event Booking Request", () => {
  const forms = listForms();
  assert.equal(forms.length, 1);
  assert.equal(forms[0].title, "Event Booking Request");
  assert.deepEqual(
    forms[0].questions.map((q) => q.id),
    SEED_QUESTIONS.map((q) => q.id)
  );
  assert.equal(forms[0].submission_count, 0);
});

test("create, submit, list, and cascade delete", () => {
  const id = createForm("RSVP", [{ id: "q1", label: "Name", type: "text", required: true }], "desc");
  assert.ok(getForm(id));
  const subId = createSubmission(id, { q1: "Ada" }, "ai");
  assert.equal(listSubmissions(id).length, 1);
  assert.equal(listSubmissions(id)[0].id, subId);
  assert.equal(listSubmissions(id)[0].via, "ai");
  assert.equal(listForms().find((f) => f.id === id)?.submission_count, 1);
  assert.equal(deleteForm(id), true);
  assert.equal(getForm(id), undefined);
  assert.equal(listSubmissions(id).length, 0);
  assert.equal(deleteForm("missing"), false);
});
