import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("sample PDF yields readable text via unpdf", async () => {
  const pdfBytes = new Uint8Array(readFileSync("fixtures/sample-document.pdf"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  assert.ok(text.trim().length > 0);
  assert.match(text, /Bryan Zane/i);
  assert.match(text, /vegan/i);
});
