import test from "node:test";
import assert from "node:assert/strict";
import { detectTextColumn, filterValidRows, normalizeText } from "../server/lib/text.js";
import { extractAspects } from "../server/lib/aspects.js";

test("normalizeText strips links and punctuation", () => {
  assert.equal(
    normalizeText("Amazing fit! Visit https://example.com now."),
    "amazing fit visit now"
  );
});

test("detectTextColumn prefers review-like columns", () => {
  const rows = [{ Review: "Great fit", sku: "ABC123" }];
  assert.equal(detectTextColumn(rows, ["sku", "Review"]), "Review");
});

test("filterValidRows removes empty values", () => {
  const result = filterValidRows(
    [{ review: "nice" }, { review: "" }, { review: "  " }, { review: "ok" }],
    "review"
  );

  assert.equal(result.keptRows.length, 2);
  assert.equal(result.removedCount, 2);
});

test("extractAspects matches configured category keywords", () => {
  assert.deepEqual(
    extractAspects("the fit and comfort are great", "CLOTHING"),
    ["fit", "comfort"]
  );
});
