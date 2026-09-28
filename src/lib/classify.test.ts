import assert from "node:assert/strict";
import { test } from "node:test";
import { bookMix, pairCoveredCalls } from "./classify.ts";
import type { Contract } from "./book.ts";

function row(partial: Partial<Contract> & Pick<Contract, "key" | "und" | "side" | "qty">): Contract {
  return {
    exp: partial.exp ?? "",
    strike: partial.strike ?? 0,
    right: partial.right ?? "C",
    open: partial.open ?? 0,
    mark: partial.mark ?? 0,
    source: "demo",
    desk: "premium",
    ivr: null,
    delta: null,
    kind: partial.kind ?? "option",
    ...partial,
  };
}

test("100 shares + 1 short call is a covered call; leftover short call stays naked", () => {
  const rows = [
    row({ key: "OKTA|stock", und: "OKTA", side: "L", qty: 100, kind: "share", mark: 210 }),
    row({ key: "OKTA|230C", und: "OKTA", side: "S", qty: 1, right: "C", exp: "2026-11-20", strike: 230, open: 435, mark: 11 }),
  ];
  const paired = pairCoveredCalls(rows);
  assert.equal(paired.get("OKTA|230C")?.shape, "covered");
  assert.equal(paired.get("OKTA|230C")?.coveredLots, 1);
  assert.equal(paired.get("OKTA|230C")?.nakedShortCalls, 0);
});

test("100 shares + 2 short calls covers one and leaves one naked", () => {
  const rows = [
    row({ key: "X|stock", und: "X", side: "L", qty: 100, kind: "share" }),
    row({ key: "X|c1", und: "X", side: "S", qty: 1, right: "C", exp: "2026-10-16", strike: 50 }),
    row({ key: "X|c2", und: "X", side: "S", qty: 1, right: "C", exp: "2026-11-20", strike: 55 }),
  ];
  const paired = pairCoveredCalls(rows);
  assert.equal(paired.get("X|c1")?.shape, "covered");
  assert.equal(paired.get("X|c1")?.nakedShortCalls, 0);
  assert.equal(paired.get("X|c2")?.nakedShortCalls, 1);
});

test("short put + stock is not treated as a covered call", () => {
  const rows = [
    row({ key: "Y|stock", und: "Y", side: "L", qty: 100, kind: "share" }),
    row({ key: "Y|p", und: "Y", side: "S", qty: 1, right: "P", exp: "2026-10-16", strike: 40 }),
  ];
  const paired = pairCoveredCalls(rows);
  assert.equal(paired.get("Y|p")?.shape, "undefined");
});

test("a vertical counts as defined on the mix meter", () => {
  const rows = [
    row({ key: "Z|s", und: "Z", side: "S", qty: 1, right: "P", exp: "2026-10-16", strike: 40 }),
    row({ key: "Z|l", und: "Z", side: "L", qty: 1, right: "P", exp: "2026-10-16", strike: 35 }),
  ];
  const mix = bookMix(rows);
  assert.equal(mix.defined, 1);
  assert.equal(mix.undefined, 0);
});
