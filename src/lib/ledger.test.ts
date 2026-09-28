import assert from "node:assert/strict";
import { test } from "node:test";
import { monthTotal, parseReceiptJson, type LedgerEntry } from "./ledger.ts";

test("parses a model JSON blob", () => {
  const p = parseReceiptJson('{"merchant":"Tastyworks","amount":99,"date":"2026-09-27","category":"data","notes":"live data"}');
  assert.equal(p.merchant, "Tastyworks");
  assert.equal(p.amount, 99);
  assert.equal(p.category, "data");
});

test("bad category falls back to other", () => {
  const p = parseReceiptJson('{"merchant":"X","amount":12,"category":"widgets"}');
  assert.equal(p.category, "other");
});

test("month total ignores other months", () => {
  const rows: LedgerEntry[] = [
    { id: "1", merchant: "A", amount: 10, date: "2026-09-01", category: "other", notes: "", thumb: null, loggedAt: "2026-09-01" },
    { id: "2", merchant: "B", amount: 5, date: "2026-08-01", category: "other", notes: "", thumb: null, loggedAt: "2026-08-01" },
  ];
  assert.equal(monthTotal(rows, "2026-09"), 10);
});
