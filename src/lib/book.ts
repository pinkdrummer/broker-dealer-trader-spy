export type Side = "S" | "L";
export type Right = "C" | "P";
export type Source = "demo" | "tasty" | "manual";
export type DeskKind = "premium" | "zero";
export type Filter = "all" | "S" | "L" | "neg" | "pos";

export type Contract = {
  key: string;
  und: string;
  exp: string;
  strike: number;
  right: Right;
  side: Side;
  qty: number;
  /** Total dollars of credit (short) or debit (long) at open. */
  open: number;
  /** Mark per share. */
  mark: number;
  source: Source;
  desk: DeskKind;
  /** Underlying IV rank 0–100. */
  ivr: number | null;
  /** Signed delta per contract (short flips the sign). */
  delta: number | null;
};

export type AlertSettings = {
  enabled: boolean;
  profit: number[];
  loss: number[];
};

export const PROFIT_CHIPS = [20, 30, 40, 50, 60, 70, 80, 90, 100];
export const LOSS_CHIPS = [50, 100, 150, 200, 250, 300, 400, 500, 600];

export const DEFAULT_ALERTS: AlertSettings = {
  enabled: true,
  profit: [...PROFIT_CHIPS],
  loss: [...LOSS_CHIPS],
};

export function cloneAlerts(src: AlertSettings): AlertSettings {
  return {
    enabled: src.enabled,
    profit: [...src.profit],
    loss: [...src.loss],
  };
}

export function defaultAlerts(_desk?: DeskKind): AlertSettings {
  return cloneAlerts(DEFAULT_ALERTS);
}

export function contractKey(c: {
  und: string;
  exp: string;
  strike: number;
  right: Right;
}): string {
  return `${c.und}|${c.exp}|${c.strike}|${c.right}`;
}

export function formatExp(exp: string): string {
  const t = Date.parse(`${exp}T12:00:00Z`);
  if (!Number.isFinite(t)) return exp;
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function contractLabel(c: Pick<Contract, "und" | "exp" | "strike" | "right">): string {
  const strike = Number.isInteger(c.strike) ? String(c.strike) : c.strike.toFixed(2);
  return `${c.und}  ${formatExp(c.exp)}  ${strike}${c.right}`;
}

export function strikeLabel(c: Pick<Contract, "strike" | "right">): string {
  const strike = Number.isInteger(c.strike) ? String(c.strike) : c.strike.toFixed(2);
  return `${strike}${c.right}`;
}

export function nyDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dte(exp: string, now: Date = new Date()): number {
  const today = nyDate(now);
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${exp}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function tenorLabel(exp: string, now: Date = new Date()): string {
  const d = dte(exp, now);
  if (d <= 0) return "0 DTE";
  return `${d} DTE`;
}

export function classifyDesk(und: string, exp: string, now: Date = new Date()): DeskKind {
  const u = und.replace(/[^A-Za-z]/g, "").toUpperCase();
  const index = u === "SPX" || u === "SPXW" || u === "XSP";
  if (index && dte(exp, now) <= 1) return "zero";
  return "premium";
}

/** Map SPXW/XSP onto SPX for tasty metrics and index quotes. */
export function metricUnderlying(und: string): string {
  const u = und.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (u === "SPXW" || u === "XSP") return "SPX";
  return und.toUpperCase();
}

export function isIndexRoot(und: string): boolean {
  const u = und.replace(/[^A-Za-z]/g, "").toUpperCase();
  return u === "SPX" || u === "SPXW" || u === "XSP" || u === "NDX" || u === "RUT" || u === "VIX";
}

export function metrics(c: Contract) {
  const markDollars = c.mark * c.qty * 100;
  const pl = c.side === "S" ? c.open - markDollars : markDollars - c.open;
  const pct = c.open > 0 ? (pl / c.open) * 100 : null;
  const vs = c.side === "S" ? "credit" : "debit";
  const openPerShare = c.qty > 0 ? c.open / (c.qty * 100) : 0;
  return { markDollars, pl, pct, vs, openPerShare };
}

/** Mark that realizes `targetPct` of credit (short) or debit (long). */
export function targetMark(c: Contract, targetPct: number): number {
  const { openPerShare } = metrics(c);
  if (c.side === "S") return Math.max(0, openPerShare * (1 - targetPct / 100));
  return openPerShare * (1 + targetPct / 100);
}

export function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function pctLabel(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.round(Math.abs(n))}%`;
}

export function moneyMark(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

export function ivrLabel(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(Math.round(n));
}

export function deltaLabel(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}${Math.abs(n).toFixed(2)}`;
}

export function nextTone(next: string | null): "up" | "down" | "fg" {
  if (!next || next === "max") return "fg";
  if (next.startsWith("+")) return "up";
  return "down";
}

export type Status = "—" | "through" | "working" | "20%+" | "50%+" | "100%";

export function statusOf(pct: number | null): Status {
  if (pct == null) return "—";
  if (pct < 0) return "through";
  if (pct >= 100) return "100%";
  if (pct >= 50) return "50%+";
  if (pct >= 20) return "20%+";
  return "working";
}

export function nextRung(pct: number | null, st: AlertSettings): string | null {
  if (pct == null || !st.enabled) return null;
  if (pct >= 0) {
    const n = [...st.profit].sort((a, b) => a - b).find((r) => pct < r);
    return n != null ? `+${n}%` : "max";
  }
  const n = [...st.loss].sort((a, b) => a - b).find((r) => pct > -r);
  return n != null ? `−${n}%` : null;
}

/** Standard-normal CDF (Abramowitz–Stegun). */
export function cdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-x * x) / 2);
  return 0.5 * (1 + sign * y);
}

/** Years to expiry. 0DTE uses a ~6.5h stub so delta does not blow up. */
export function yearsToExpiry(exp: string, now: Date = new Date()): number {
  const days = Math.max(dte(exp, now), 0.27);
  return days / 365;
}

/**
 * Black–Scholes delta, unsigned by side. `iv` is a decimal (0.25 = 25%).
 * Returns null if inputs are unusable.
 */
export function bsDelta(args: {
  spot: number;
  strike: number;
  years: number;
  iv: number;
  right: Right;
}): number | null {
  const { spot, strike, years, iv, right } = args;
  if (!(spot > 0) || !(strike > 0) || !(years > 0) || !(iv > 0) || !Number.isFinite(iv)) {
    return null;
  }
  const sqrtT = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (0.045 + (iv * iv) / 2) * years) / (iv * sqrtT);
  if (!Number.isFinite(d1)) return null;
  const nd1 = cdf(d1);
  return right === "C" ? nd1 : nd1 - 1;
}

export function signedDelta(raw: number, side: Side): number {
  return side === "S" ? -raw : raw;
}

export type BookSummary = {
  pl: number;
  credit: number;
  debit: number;
  negative: number;
  positive: number;
  n: number;
};

export function summarize(rows: Contract[]): BookSummary {
  const out: BookSummary = {
    pl: 0,
    credit: 0,
    debit: 0,
    negative: 0,
    positive: 0,
    n: rows.length,
  };
  for (const c of rows) {
    const m = metrics(c);
    out.pl += m.pl;
    if (c.side === "S") out.credit += c.open;
    else out.debit += c.open;
    if (m.pct == null) continue;
    if (m.pct < 0) out.negative += 1;
    else out.positive += 1;
  }
  return out;
}

export type UndGroup = { und: string; items: Contract[]; pl: number; ivr: number | null };

export function grouped(rows: Contract[]): UndGroup[] {
  const order: string[] = [];
  const map = new Map<string, Contract[]>();
  for (const c of rows) {
    const list = map.get(c.und);
    if (!list) {
      map.set(c.und, [c]);
      order.push(c.und);
    } else {
      list.push(c);
    }
  }
  return order.map((und) => {
    const items = map.get(und) ?? [];
    const pl = items.reduce((s, c) => s + metrics(c).pl, 0);
    const ivr = items.find((c) => c.ivr != null)?.ivr ?? null;
    return { und, items, pl, ivr };
  });
}

function c(
  und: string,
  exp: string,
  strike: number,
  right: Right,
  side: Side,
  qty: number,
  openPerShare: number,
  mark: number,
  desk: DeskKind = "premium",
  ivr: number | null = null,
  delta: number | null = null,
): Contract {
  const row = { und, exp, strike, right, side, qty, mark, source: "demo" as const, desk, ivr, delta };
  return {
    ...row,
    key: contractKey(row),
    open: openPerShare * qty * 100,
  };
}

/** Sample 45 DTE short-premium book plus two TSLA LEAPs. */
export const DEMO_BOOK: Contract[] = [
  c("HOOD", "2026-10-16", 130, "C", "S", 1, 3.2, 9.1, "premium", 64, -0.48),
  c("HOOD", "2026-10-16", 105, "P", "S", 1, 2.8, 0.85, "premium", 64, 0.22),
  c("DELL", "2026-10-16", 620, "C", "S", 1, 8.5, 24.0, "premium", 41, -0.55),
  c("DELL", "2026-10-16", 420, "P", "S", 1, 9.2, 1.1, "premium", 41, 0.18),
  c("META", "2026-10-16", 700, "C", "S", 1, 6.4, 18.5, "premium", 28, -0.52),
  c("META", "2026-10-16", 570, "P", "S", 1, 7.1, 0.95, "premium", 28, 0.16),
  c("ARM", "2026-10-16", 300, "C", "S", 1, 5.2, 18.2, "premium", 72, -0.61),
  c("ARM", "2026-10-16", 200, "P", "S", 1, 4.8, 1.4, "premium", 72, 0.21),
  c("CRM", "2026-10-16", 290, "C", "S", 1, 4.0, 5.2, "premium", 33, -0.31),
  c("CRM", "2026-10-16", 230, "P", "S", 1, 3.6, 2.5, "premium", 33, 0.28),
  c("OKTA", "2026-10-16", 195, "C", "S", 1, 2.1, 1.68, "premium", 47, -0.24),
  c("LOW", "2026-10-16", 190, "P", "S", 1, 3.4, 2.72, "premium", 22, 0.26),
  c("TSLA", "2027-01-15", 250, "C", "L", 1, 40.0, 48.0, "premium", 55, 0.62),
  c("TSLA", "2027-06-18", 200, "C", "L", 1, 55.0, 52.25, "premium", 55, 0.71),
];

/** Same-day SPX credit spreads, ~$50 net per wing. Expiry is today (ET). */
export function demoZero(now: Date = new Date()): Contract[] {
  const exp = nyDate(now);
  return [
    c("SPXW", exp, 5805, "P", "S", 1, 0.92, 0.48, "zero", 18, 0.18),
    c("SPXW", exp, 5795, "P", "L", 1, 0.41, 0.18, "zero", 18, -0.09),
    c("SPXW", exp, 5860, "C", "S", 1, 0.88, 0.22, "zero", 18, -0.16),
    c("SPXW", exp, 5870, "C", "L", 1, 0.39, 0.09, "zero", 18, 0.08),
    c("SPXW", exp, 5780, "P", "S", 1, 0.55, 0.70, "zero", 18, 0.32),
    c("SPXW", exp, 5770, "P", "L", 1, 0.22, 0.31, "zero", 18, -0.14),
  ];
}

export function fullDemo(now: Date = new Date()): Contract[] {
  return [...DEMO_BOOK, ...demoZero(now)];
}

export function crossedRungs(
  prev: number | null | undefined,
  now: number | null,
  st: AlertSettings,
): string[] {
  if (now == null || !st.enabled) return [];
  const first = prev == null;
  if (first) {
    const profits = st.profit.filter((r) => now >= r).sort((a, b) => b - a);
    if (profits[0] != null) return [`+${profits[0]}%`];
    const losses = st.loss.filter((r) => now <= -r).sort((a, b) => b - a);
    if (losses[0] != null) return [`−${losses[0]}%`];
    return [];
  }
  const hits: string[] = [];
  const profit = [...st.profit].sort((a, b) => a - b);
  const loss = [...st.loss].sort((a, b) => a - b);
  if (now >= prev) {
    for (const r of [...loss].reverse()) {
      if (prev <= -r && now > -r) hits.push(`> −${r}%`);
    }
    for (const r of profit) {
      if (prev < r && now >= r) hits.push(`> +${r}%`);
    }
  } else {
    for (const r of [...profit].reverse()) {
      if (prev >= r && now < r) hits.push(`< +${r}%`);
    }
    for (const r of loss) {
      if (prev > -r && now <= -r) hits.push(`< −${r}%`);
    }
  }
  return hits;
}

/** Discrete buffer window in minutes. 1440 = once a day. */
export const COOLDOWN_MINUTES = [1, 2, 3, 4, 5, 10, 15, 20, 30, 45, 60, 90, 120, 1440] as const;
export const DEFAULT_COOLDOWN_MIN = 15;

export function clampCooldown(min: number): number {
  const allowed: readonly number[] = COOLDOWN_MINUTES;
  if (allowed.includes(min)) return min;
  return allowed.reduce((best, n) => (Math.abs(n - min) < Math.abs(best - min) ? n : best));
}

export function cooldownLabel(min: number): string {
  const n = clampCooldown(min);
  if (n >= 1440) return "Once a day";
  if (n === 1) return "1 minute";
  return `${n} minutes`;
}

/** Rung identity, ignoring cross direction. "+20" or "−50". */
export function rungId(hit: string): string {
  const m = hit.match(/([+\-−]\d+)/);
  if (!m) return hit.trim();
  return m[1].replace(/-/g, "−");
}

export function fireKey(contractKey: string, hit: string): string {
  return `${contractKey}|${rungId(hit)}`;
}

export function rungIsCooling(
  lastFiredAt: number | undefined,
  now: number,
  cooldownMin: number,
): boolean {
  if (lastFiredAt == null) return false;
  return now - lastFiredAt < clampCooldown(cooldownMin) * 60_000;
}

export function parseOcc(symbol: string): {
  und: string;
  exp: string;
  right: Right;
  strike: number;
} | null {
  const raw = symbol.replace(/\s+/g, "");
  const m = raw.match(/^([A-Z./]+)(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const [, root, ymd, cp, strikeRaw] = m;
  const year = 2000 + Number(ymd.slice(0, 2));
  const exp = `${year}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`;
  return {
    und: root,
    exp,
    right: cp as Right,
    strike: Number(strikeRaw) / 1000,
  };
}
