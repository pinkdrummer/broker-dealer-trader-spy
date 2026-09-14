import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bsDelta,
  classifyDesk,
  crossedRungs,
  defaultAlerts,
  dte,
  metrics,
  fireKey,
  nextRung,
  nyDate,
  parseOcc,
  rungId,
  rungIsCooling,
  signedDelta,
  summarize,
  targetMark,
} from "./book.ts";

const st = defaultAlerts();

test("factory rungs are every profit and loss chip, on by default", () => {
  assert.equal(st.enabled, true);
  assert.deepEqual(st.profit, [20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.deepEqual(st.loss, [50, 100, 150, 200, 250, 300, 400, 500, 600]);
});

test("short P/L is (credit − mark) / credit", () => {
  const m = metrics({
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
  });
  assert.equal(m.pl, 320 - 910);
  assert.equal(m.vs, "credit");
  assert.ok(m.pct != null && m.pct < -180);
});

test("long P/L is (mark − debit) / debit", () => {
  const m = metrics({
    key: "TSLA|2027-01-15|250|C",
    und: "TSLA",
    exp: "2027-01-15",
    strike: 250,
    right: "C",
    side: "L",
    qty: 1,
    open: 4000,
    mark: 48,
    source: "demo",
    desk: "premium",
    ivr: 55,
    delta: 0.62,
  });
  assert.equal(m.pl, 4800 - 4000);
  assert.equal(m.vs, "debit");
  assert.equal(m.pct, 20);
});

test("nextRung walks 20–100 then max", () => {
  assert.equal(nextRung(0, st), "+20%");
  assert.equal(nextRung(19, st), "+20%");
  assert.equal(nextRung(20, st), "+30%");
  assert.equal(nextRung(40, st), "+50%");
  assert.equal(nextRung(49, st), "+50%");
  assert.equal(nextRung(50, st), "+60%");
  assert.equal(nextRung(80, st), "+90%");
  assert.equal(nextRung(100, st), "max");
  assert.equal(nextRung(-1, st), "−50%");
  assert.equal(nextRung(-50, st), "−100%");
  assert.equal(nextRung(-149, st), "−150%");
  assert.equal(nextRung(-300, st), "−400%");
  assert.equal(nextRung(-600, st), null);
  assert.equal(nextRung(10, { ...st, enabled: false }), null);
});

test("crossedRungs first look reports the highest hit only", () => {
  assert.deepEqual(crossedRungs(null, 55, st), ["+50%"]);
  assert.deepEqual(crossedRungs(null, 25, st), ["+20%"]);
  assert.deepEqual(crossedRungs(null, -120, st), ["−100%"]);
  assert.deepEqual(crossedRungs(null, 0, st), []);
});

test("crossedRungs later ticks fire each newly crossed rung", () => {
  assert.deepEqual(crossedRungs(10, 35, st), ["> +20%", "> +30%"]);
  assert.deepEqual(crossedRungs(0, -120, st), ["< −50%", "< −100%"]);
  assert.deepEqual(crossedRungs(40, 40, st), []);
});

test("crossedRungs reports give-backs and recoveries", () => {
  assert.deepEqual(crossedRungs(35, 10, st), ["< +30%", "< +20%"]);
  assert.deepEqual(crossedRungs(-120, 0, st), ["> −100%", "> −50%"]);
  assert.deepEqual(crossedRungs(25, -60, st), ["< +20%", "< −50%"]);
  assert.deepEqual(crossedRungs(-60, 25, st), ["> −50%", "> +20%"]);
});

test("parseOcc splits root, expiry, right, strike", () => {
  assert.deepEqual(parseOcc("TSLA270115C00250000"), {
    und: "TSLA",
    exp: "2027-01-15",
    right: "C",
    strike: 250,
  });
  assert.deepEqual(parseOcc("SPXW260909P05805000"), {
    und: "SPXW",
    exp: "2026-09-09",
    right: "P",
    strike: 5805,
  });
  assert.equal(parseOcc("not-an-occ"), null);
});

test("classifyDesk sends same-day SPX to 0DTE", () => {
  const today = nyDate();
  assert.equal(classifyDesk("SPXW", today), "zero");
  assert.equal(classifyDesk("SPX", today), "zero");
  assert.equal(classifyDesk("XSP", today), "zero");
  assert.equal(classifyDesk("HOOD", "2026-10-16"), "premium");
  assert.equal(classifyDesk("TSLA", "2027-01-15"), "premium");
  assert.ok(dte("2026-10-16") >= 0);
});

test("short 50% of credit is half the open per share", () => {
  const c = {
    key: "k",
    und: "HOOD",
    exp: "2026-10-16",
    strike: 130,
    right: "C" as const,
    side: "S" as const,
    qty: 1,
    open: 320,
    mark: 9.1,
    source: "demo" as const,
    desk: "premium" as const,
    ivr: 64,
    delta: -0.48,
  };
  assert.equal(targetMark(c, 50), 1.6);
  assert.ok(Math.abs(targetMark(c, 20) - 2.56) < 1e-9);
});

test("Black–Scholes delta is ~0.5 ATM and shorts flip the sign", () => {
  const raw = bsDelta({
    spot: 100,
    strike: 100,
    years: 30 / 365,
    iv: 0.3,
    right: "C",
  });
  assert.ok(raw != null);
  assert.ok(raw > 0.45 && raw < 0.6);
  assert.equal(signedDelta(raw, "S"), -raw);
  assert.equal(signedDelta(raw, "L"), raw);
  const put = bsDelta({
    spot: 100,
    strike: 100,
    years: 30 / 365,
    iv: 0.3,
    right: "P",
  });
  assert.ok(put != null && put < 0);
});

test("summarize splits the book into negative and positive", () => {
  const rows = [
    {
      key: "neg",
      und: "HOOD",
      exp: "2026-10-16",
      strike: 130,
      right: "C" as const,
      side: "S" as const,
      qty: 1,
      open: 320,
      mark: 9.1,
      source: "demo" as const,
      desk: "premium" as const,
      ivr: 64,
      delta: -0.48,
    },
    {
      key: "pos",
      und: "HOOD",
      exp: "2026-10-16",
      strike: 105,
      right: "P" as const,
      side: "S" as const,
      qty: 1,
      open: 280,
      mark: 0.85,
      source: "demo" as const,
      desk: "premium" as const,
      ivr: 64,
      delta: 0.22,
    },
  ];
  const s = summarize(rows);
  assert.equal(s.n, 2);
  assert.equal(s.negative, 1);
  assert.equal(s.positive, 1);
});

test("rungId ignores direction so +20% is one alert", () => {
  assert.equal(rungId("> +20%"), "+20");
  assert.equal(rungId("< +20%"), "+20");
  assert.equal(rungId("< −50%"), "−50");
  assert.equal(rungId("> −50%"), "−50");
  assert.equal(fireKey("HOOD|k", "> +20%"), fireKey("HOOD|k", "< +20%"));
  assert.notEqual(fireKey("HOOD|k", "> +20%"), fireKey("HOOD|k", "< −50%"));
});

test("rungIsCooling mutes the same rung inside the window", () => {
  const t0 = 1_000_000;
  const min = 15;
  assert.equal(rungIsCooling(undefined, t0, min), false);
  assert.equal(rungIsCooling(t0, t0 + 14 * 60_000, min), true);
  assert.equal(rungIsCooling(t0, t0 + 15 * 60_000, min), false);
  assert.equal(rungIsCooling(t0, t0 + 23 * 60 * 60_000, 1440), true);
  assert.equal(rungIsCooling(t0, t0 + 24 * 60 * 60_000, 1440), false);
});
