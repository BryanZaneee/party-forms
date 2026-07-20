import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeQuestions } from "../lib/validate.ts";

const dir = mkdtempSync(path.join(tmpdir(), "party-te-db-"));
const dbPath = path.join(dir, "test.db");
process.env.PARTY_TE_DB = dbPath;

const {
  RESTAURANT_SEED_QUESTIONS,
  SEED_QUESTIONS,
  VENDOR_SEED_QUESTIONS,
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

test("empty DB seeds all sample forms", () => {
  const forms = listForms();
  assert.equal(forms.length, 3);
  const event = forms.find((f) => f.title === "Event Booking Request");
  assert.ok(event);
  assert.deepEqual(
    event.questions.map((q) => q.id),
    SEED_QUESTIONS.map((q) => q.id)
  );
  assert.equal(event.submission_count, 0);
  const venue = forms.find((f) => f.title === "Restaurant Venue Profile");
  assert.ok(venue);
  assert.deepEqual(venue.questions, RESTAURANT_SEED_QUESTIONS);
  assert.equal(venue.submission_count, 0);
  const vendor = forms.find((f) => f.title === "Event Vendor Application");
  assert.ok(vendor);
  assert.deepEqual(vendor.questions, VENDOR_SEED_QUESTIONS);
});

test("vendor seed is long, covers all 7 types, and normalizes cleanly", () => {
  assert.ok(VENDOR_SEED_QUESTIONS.length >= 20);
  assert.equal(new Set(VENDOR_SEED_QUESTIONS.map((q) => q.type)).size, 7);
  assert.deepEqual(normalizeQuestions(VENDOR_SEED_QUESTIONS), VENDOR_SEED_QUESTIONS);
});

test("restaurant seed covers all 7 types and normalizes cleanly", () => {
  assert.equal(new Set(RESTAURANT_SEED_QUESTIONS.map((q) => q.type)).size, 7);
  assert.deepEqual(normalizeQuestions(RESTAURANT_SEED_QUESTIONS), RESTAURANT_SEED_QUESTIONS);
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
