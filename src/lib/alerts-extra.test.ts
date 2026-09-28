import assert from "node:assert/strict";
import { test } from "node:test";
import { crossedZero, isItm, itmShouldFire, legIsManage } from "./alerts-extra.ts";
import { optionPackages } from "./packages.ts";
import type { Contract } from "./book.ts";

function c(partial: Partial<Contract> & Pick<Contract, "key" | "und" | "exp" | "strike" | "right" | "side" | "qty" | "open" | "mark">): Contract {
  return {
    source: "demo",
    desk: "premium",
    ivr: null,
    delta: null,
    kind: "option",
    ...partial,
  };
}

test("ITM call uses spot vs strike", () => {
  assert.equal(isItm({ kind: "option", right: "C", strike: 230, spot: 231 }), true);
  assert.equal(isItm({ kind: "option", right: "C", strike: 230, spot: 229 }), false);
  assert.equal(isItm({ kind: "option", right: "P", strike: 200, spot: 199 }), true);
  assert.equal(isItm({ kind: "share", right: "C", strike: 0, spot: 10 }), null);
});

test("ITM fires once on entry and stays quiet while inside", () => {
  assert.deepEqual(itmShouldFire(undefined, true), { fire: false, next: true });
  assert.deepEqual(itmShouldFire(false, true), { fire: true, next: true });
  assert.deepEqual(itmShouldFire(true, true), { fire: false, next: true });
  assert.deepEqual(itmShouldFire(true, false), { fire: false, next: false });
  assert.deepEqual(itmShouldFire(false, true), { fire: true, next: true });
});

test("breakeven is a sign change through 0%", () => {
  assert.equal(crossedZero(12, -3), true);
  assert.equal(crossedZero(-8, 4), true);
  assert.equal(crossedZero(12, 5), false);
  assert.equal(crossedZero(null, 0), false);
});

test("package P/L nets a credit strangle", () => {
  const rows = [
    c({ key: "a", und: "X", exp: "2026-10-16", strike: 130, right: "C", side: "S", qty: 1, open: 320, mark: 9.1 }),
    c({ key: "b", und: "X", exp: "2026-10-16", strike: 105, right: "P", side: "S", qty: 1, open: 280, mark: 0.85 }),
  ];
  const pkgs = optionPackages(rows);
  assert.equal(pkgs.length, 1);
  assert.equal(pkgs[0]?.structure, "strangle");
  assert.ok(pkgs[0] && pkgs[0].pl === 320 - 910 + 280 - 85);
});

test("leg manage is only a short at −100% of credit", () => {
  const short = c({ key: "s", und: "X", exp: "2026-10-16", strike: 130, right: "C", side: "S", qty: 1, open: 320, mark: 9.1 });
  assert.equal(legIsManage(short, -184), true);
  assert.equal(legIsManage(short, -40), false);
});
