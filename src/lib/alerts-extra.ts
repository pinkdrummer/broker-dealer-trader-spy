import type { Contract } from "./book";

export function isItm(c: Pick<Contract, "kind" | "right" | "strike" | "spot">): boolean | null {
  if (c.kind === "share") return null;
  if (!(c.spot != null && c.spot > 0) || !(c.strike > 0)) return null;
  if (c.right === "C") return c.spot >= c.strike;
  return c.spot <= c.strike;
}

/** First look records state and does not fire. Later: fire only on OTM → ITM. */
export function itmShouldFire(prev: boolean | undefined, now: boolean | null): {
  fire: boolean;
  next: boolean | undefined;
} {
  if (now == null) return { fire: false, next: prev };
  if (prev == null) return { fire: false, next: now };
  if (now && !prev) return { fire: true, next: true };
  return { fire: false, next: now };
}

export function crossedZero(prev: number | null | undefined, now: number | null): boolean {
  if (prev == null || now == null) return false;
  if (prev === 0 || now === 0) return prev !== 0 && now === 0 ? true : prev * now < 0;
  return prev * now < 0;
}

export function legIsManage(c: Contract, pct: number | null): boolean {
  return c.kind !== "share" && c.side === "S" && pct != null && pct <= -100;
}
