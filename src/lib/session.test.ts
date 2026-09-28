import assert from "node:assert/strict";
import { test } from "node:test";
import { zeroWindow } from "./session.ts";

test("Sunday evening is weekend closed", () => {
  const w = zeroWindow(new Date("2026-09-27T20:20:00-07:00"));
  assert.equal(w.state, "weekend");
  assert.match(w.label, /closed/i);
});

test("weekday 10:00 ET is open", () => {
  const w = zeroWindow(new Date("2026-09-28T10:00:00-04:00"));
  assert.equal(w.state, "open");
});

test("weekday 11:01 ET is closed", () => {
  const w = zeroWindow(new Date("2026-09-28T11:01:00-04:00"));
  assert.equal(w.state, "closed");
});

test("weekday 9:00 ET is before open", () => {
  const w = zeroWindow(new Date("2026-09-28T09:00:00-04:00"));
  assert.equal(w.state, "before");
});
