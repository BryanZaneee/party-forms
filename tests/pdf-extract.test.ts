import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("event-booking PDF yields readable text via unpdf", async () => {
  const pdfBytes = new Uint8Array(readFileSync("fixtures/event-booking-request.pdf"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  assert.ok(text.trim().length > 0);
  assert.match(text, /Bryan Zane/i);
  assert.match(text, /vegan/i);
});

test("restaurant-venue PDF yields readable text via unpdf", async () => {
  const pdfBytes = new Uint8Array(readFileSync("fixtures/restaurant-venue-profile.pdf"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  assert.ok(text.trim().length > 0);
  assert.match(text, /Tavolino Rosso/i);
  assert.match(text, /full bar/i);
  assert.match(text, /March 14, 2026/i);
});
