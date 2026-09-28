import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ACCOUNT_SETTINGS, DEMO_SNAPSHOT } from "./account.ts";
import { composeBrief } from "./brief.ts";
import { DEMO_TAPE } from "./tape.ts";
import type { Contract } from "./book.ts";

const hood: Contract = {
  key: "HOOD|2026-10-16|130|C",
  und: "HOOD",
  exp: "2026-10-16",
  strike: 130,
  right: "C",
  side: "S",
  qty: 1,
  open: 320,
  mark: 9.1,
  source: "demo",
  desk: "premium",
  ivr: 64,
  delta: -0.48,
  kind: "option",
};

test("brief names a manage ticket in the headline", () => {
  const b = composeBrief({
    book: [hood],
    snapshot: DEMO_SNAPSHOT,
    settings: DEFAULT_ACCOUNT_SETTINGS,
    trades: [],
    tape: DEMO_TAPE,
    now: new Date("2026-09-27T20:30:00-07:00"),
  });
  assert.match(b.headline, /manage/i);
  assert.match(b.window, /Monday|weekend|shut|open/i);
  assert.match(b.market, /VIX/);
});

test("an empty book still writes a market paragraph", () => {
  const b = composeBrief({
    book: [],
    snapshot: DEMO_SNAPSHOT,
    settings: DEFAULT_ACCOUNT_SETTINGS,
    trades: [],
    tape: DEMO_TAPE,
    now: new Date("2026-09-28T06:00:00-07:00"),
  });
  assert.ok(b.market.length > 20);
  assert.match(b.book, /under|near|over/i);
});
