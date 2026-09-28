import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountRungs,
  bpUsedPct,
  capPctFor,
  capStatus,
  delta1x,
  laneTarget,
  mixTilt,
  nearestRungPct,
  sleeves,
  thetaBand,
  vixRowOf,
} from "./account.ts";

test("VIX 16.4 is the 15–20 row; moderate Reg-T cap is 39%", () => {
  assert.equal(vixRowOf(16.4), "15-20");
  assert.equal(capPctFor(16.4, "conservative", "regt"), 30);
  assert.equal(capPctFor(16.4, "moderate", "regt"), 39);
  assert.equal(capPctFor(16.4, "aggressive", "regt"), 50);
});

test("Reg-T caps floor at 50% once VIX is 20+", () => {
  assert.equal(capPctFor(22, "moderate", "regt"), 45.5);
  assert.equal(capPctFor(22, "aggressive", "regt"), 50);
  assert.equal(capPctFor(35, "moderate", "regt"), 50);
  assert.equal(capPctFor(45, "conservative", "regt"), 50);
});

test("PM uses the band ends, not the Reg-T columns", () => {
  assert.equal(capPctFor(16.4, "conservative", "pm"), 20);
  assert.equal(capPctFor(16.4, "moderate", "pm"), 25);
  assert.equal(capPctFor(16.4, "aggressive", "pm"), 30);
});

test("BP used % is used / (used + available)", () => {
  assert.equal(bpUsedPct(38_000, 97_000), (38_000 / 135_000) * 100);
  assert.equal(capStatus(28, 30), "near");
  assert.equal(capStatus(22, 30), "under");
  assert.equal(capStatus(31, 30), "over");
});

test("$135k example rungs and 1x SPY delta", () => {
  const r = accountRungs(135_000);
  assert.equal(r[0]?.dollars, 1_350);
  assert.equal(r[2]?.dollars, 4_050);
  assert.equal(r[6]?.dollars, 9_450);
  assert.equal(nearestRungPct(8_200, 135_000), 6);
  const one = delta1x(135_000, 570);
  assert.ok(one != null && Math.abs(one - 135_000 / 570) < 1e-9);
});

test("theta band on a $135k book is $135–$675", () => {
  const t = thetaBand(400, 135_000);
  assert.equal(t.floor, 135);
  assert.equal(t.ceil, 675);
  assert.equal(t.band, "in");
  assert.equal(thetaBand(80, 135_000).band, "light");
  assert.equal(thetaBand(800, 135_000).band, "hot");
});

test("sleeves never treat total delta as an options book", () => {
  const s = sleeves({ shareDelta: 180, optionDelta: 12, optionTheta: 40 });
  assert.equal(s.totalDelta, 192);
  assert.ok(s.sharePctOfDelta != null && s.sharePctOfDelta > 90);
  assert.equal(s.optionPctOfTheta, 100);
});

test("bearish target is −θ/2 on the options sleeve only", () => {
  const t = laneTarget({
    lane: "bearish",
    viewDelta: 10,
    netLiq: 135_000,
    oneX: 236,
    leverage: 1,
    optionsTheta: 40,
  });
  assert.equal(t.target, -20);
  assert.equal(t.gap, -30);
});

test("mix tilt names the heavy sleeve past 50%", () => {
  assert.equal(mixTilt({ defined: 2, undefined: 8, covered: 1 }).label, "undefined-heavy");
  assert.equal(mixTilt({ defined: 6, undefined: 3, covered: 1 }).label, "defined-heavy");
  assert.equal(mixTilt({ defined: 2, undefined: 2, covered: 2 }).label, "balanced");
});
