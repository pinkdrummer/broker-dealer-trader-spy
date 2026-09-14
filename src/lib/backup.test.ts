import assert from "node:assert/strict";
import { test } from "node:test";
import { makeBackup, parseBackup } from "./backup.ts";
import { isBlankSnapshot } from "./persist-storage.ts";
import { cloneAlerts, DEFAULT_ALERTS } from "./book.ts";

const sample = {
  book: [
    {
      key: "HOOD|2026-10-16|130|C",
      und: "HOOD",
      exp: "2026-10-16",
      strike: 130,
      right: "C" as const,
      side: "S" as const,
      qty: 1,
      open: 320,
      mark: 9.1,
      source: "tasty" as const,
      desk: "premium" as const,
      ivr: 64,
      delta: -0.48,
    },
  ],
  alerts: {},
  defaultRungs: cloneAlerts(DEFAULT_ALERTS),
  lastPct: { "HOOD|2026-10-16|130|C": -184 },
  desk: "premium" as const,
  tastySecret: "sec",
  tastyToken: "tok",
  tastyAccount: "5WT12345",
  ntfyTopic: "premium-alerts-secret",
  watching: true,
};

test("backup round-trips Tasty keys and the book", () => {
  const raw = makeBackup(sample);
  const parsed = parseBackup(JSON.parse(JSON.stringify(raw)));
  assert.ok(parsed);
  assert.equal(parsed.tastySecret, "sec");
  assert.equal(parsed.tastyToken, "tok");
  assert.equal(parsed.book[0]?.und, "HOOD");
  assert.equal(parsed.watching, true);
  assert.deepEqual(parsed.defaultRungs.profit, [20, 30, 40, 50, 60, 70, 80, 90, 100]);
});

test("parseBackup rejects junk", () => {
  assert.equal(parseBackup(null), null);
  assert.equal(parseBackup({ v: 1, book: "nope" }), null);
  assert.equal(parseBackup({ v: 99, book: [] }), null);
});

test("blank snapshot is demo or empty without creds", () => {
  const wrap = (state: object) => JSON.stringify({ state, version: 0 });
  assert.equal(isBlankSnapshot(wrap({ book: [], tastySecret: "", tastyToken: "" })), true);
  assert.equal(
    isBlankSnapshot(
      wrap({
        book: [{ source: "demo" }],
        tastySecret: "",
        tastyToken: "",
      }),
    ),
    true,
  );
  assert.equal(
    isBlankSnapshot(
      wrap({
        book: [{ source: "tasty" }],
        tastySecret: "",
        tastyToken: "",
      }),
    ),
    false,
  );
  assert.equal(
    isBlankSnapshot(
      wrap({
        book: [],
        tastySecret: "sec",
        tastyToken: "tok",
      }),
    ),
    false,
  );
});
