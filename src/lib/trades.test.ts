import assert from "node:assert/strict";
import { test } from "node:test";
import { syncTrades, type DeskTrade } from "./trades.ts";
import type { Contract } from "./book.ts";

function opt(
  und: string,
  exp: string,
  strike: number,
  right: "C" | "P",
  open = 300,
  mark = 1.5,
): Contract {
  return {
    key: `${und}|${exp}|${strike}|${right}`,
    und,
    exp,
    strike,
    right,
    side: "S",
    qty: 1,
    open,
    mark,
    source: "demo",
    desk: "premium",
    ivr: null,
    delta: null,
    kind: "option",
  };
}

test("a new book opens one trade per package", () => {
  const book = [opt("HOOD", "2026-10-16", 130, "C"), opt("HOOD", "2026-10-16", 105, "P")];
  const next = syncTrades([], book, new Date("2026-09-27T12:00:00Z"));
  assert.equal(next.filter((t) => t.status === "open").length, 1);
  assert.equal(next[0]?.structure, "strangle");
  assert.equal(next[0]?.notes, "");
});

test("a roll out keeps the trade id and notes", () => {
  const first = syncTrades([], [opt("HOOD", "2026-10-16", 130, "C")], new Date("2026-09-01T12:00:00Z"));
  const open = first[0] as DeskTrade;
  const noted: DeskTrade[] = [{ ...open, notes: "roll if tested" }];
  const rolled = syncTrades(
    noted,
    [opt("HOOD", "2026-11-20", 140, "C")],
    new Date("2026-09-27T12:00:00Z"),
  );
  assert.equal(rolled.filter((t) => t.status === "open").length, 1);
  assert.equal(rolled[0]?.id, open.id);
  assert.equal(rolled[0]?.notes, "roll if tested");
  assert.equal(rolled[0]?.exp, "2026-11-20");
});

test("a vanished package is archived, not deleted", () => {
  const first = syncTrades([], [opt("DELL", "2026-10-16", 420, "P")], new Date("2026-09-01T12:00:00Z"));
  const next = syncTrades(first, [], new Date("2026-09-27T12:00:00Z"));
  assert.equal(next.length, 1);
  assert.equal(next[0]?.status, "closed");
  assert.ok(next[0]?.closedAt);
});

test("two expiries on one name stay two trades", () => {
  const book = [opt("OKTA", "2026-11-20", 230, "C"), opt("OKTA", "2026-12-18", 190, "P")];
  const next = syncTrades([], book);
  assert.equal(next.filter((t) => t.status === "open").length, 2);
});
