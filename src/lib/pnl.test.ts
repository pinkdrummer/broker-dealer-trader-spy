import assert from "node:assert/strict";
import { test } from "node:test";
import { detectRecords, periodStats, EMPTY_RECORDS } from "./pnl.ts";
import type { DeskTrade } from "./trades.ts";

function closed(partial: Partial<DeskTrade> & Pick<DeskTrade, "id" | "lastPl" | "closedAt">): DeskTrade {
  return {
    und: "X",
    kind: "option",
    status: "closed",
    structure: "short",
    notes: "",
    owner: partial.owner ?? "J",
    openedAt: partial.closedAt,
    exp: "",
    legKeys: [],
    lastPct: 50,
    vs: "credit",
    label: partial.label ?? "X short",
    ...partial,
  };
}

test("win rate and owner split", () => {
  const rows = [
    closed({ id: "1", lastPl: 100, closedAt: "2026-09-10", owner: "J" }),
    closed({ id: "2", lastPl: -50, closedAt: "2026-09-11", owner: "A" }),
    closed({ id: "3", lastPl: 20, closedAt: "2026-09-12", owner: "J" }),
  ];
  const s = periodStats(rows, 10000, "2026-09-01", "2026-09-30");
  assert.equal(s.trades, 3);
  assert.equal(s.wins, 2);
  assert.equal(s.net, 70);
  assert.equal(s.byOwner.J.net, 120);
  assert.equal(s.byOwner.A.net, -50);
});

test("a new day high is a record hit", () => {
  const rows = [closed({ id: "1", lastPl: 200, closedAt: "2026-09-10T16:00:00Z", label: "HOOD" })];
  const { hits, next } = detectRecords(rows, EMPTY_RECORDS);
  assert.ok(hits.some((h) => h.kind === "day"));
  assert.ok(hits.some((h) => h.kind === "trade"));
  assert.equal(next.trade?.pl, 200);
});
