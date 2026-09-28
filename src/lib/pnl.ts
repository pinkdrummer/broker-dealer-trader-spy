import { OWNERS, type DeskTrade, type OwnerId } from "./trades";

export type PeriodStats = {
  trades: number;
  net: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  gainPctLiq: number | null;
  byOwner: Record<OwnerId, { trades: number; net: number }>;
};

export type RecordKind = "day" | "trade" | "week" | "month" | "year";

export type PlRecord = {
  kind: RecordKind;
  key: string;
  pl: number;
  label: string;
};

export type RecordBook = Record<RecordKind, PlRecord | null>;

export const EMPTY_RECORDS: RecordBook = {
  day: null,
  trade: null,
  week: null,
  month: null,
  year: null,
};

function closedOf(trades: DeskTrade[], from?: string, to?: string): DeskTrade[] {
  return trades.filter((t) => {
    if (t.status !== "closed") return false;
    const d = (t.closedAt || t.openedAt).slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export function periodStats(trades: DeskTrade[], netLiq: number, from?: string, to?: string): PeriodStats {
  const rows = closedOf(trades, from, to);
  const wins = rows.filter((t) => t.lastPl > 0);
  const losses = rows.filter((t) => t.lastPl < 0);
  const net = rows.reduce((n, t) => n + t.lastPl, 0);
  const byOwner = {
    J: { trades: 0, net: 0 },
    A: { trades: 0, net: 0 },
    P: { trades: 0, net: 0 },
  } as Record<OwnerId, { trades: number; net: number }>;
  for (const t of rows) {
    if (!t.owner) continue;
    byOwner[t.owner].trades += 1;
    byOwner[t.owner].net += t.lastPl;
  }
  return {
    trades: rows.length,
    net,
    wins: wins.length,
    losses: losses.length,
    winRate: rows.length ? (wins.length / rows.length) * 100 : null,
    avgWin: wins.length ? wins.reduce((n, t) => n + t.lastPl, 0) / wins.length : null,
    avgLoss: losses.length ? losses.reduce((n, t) => n + t.lastPl, 0) / losses.length : null,
    gainPctLiq: netLiq > 0 ? (net / netLiq) * 100 : null,
    byOwner,
  };
}

export function isoWeekKey(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function sumBy(trades: DeskTrade[], keyFn: (t: DeskTrade) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of closedOf(trades)) {
    const k = keyFn(t);
    m.set(k, (m.get(k) || 0) + t.lastPl);
  }
  return m;
}

export function detectRecords(
  trades: DeskTrade[],
  prev: RecordBook,
): { next: RecordBook; hits: PlRecord[] } {
  const next: RecordBook = { ...prev };
  const hits: PlRecord[] = [];

  const consider = (kind: RecordKind, key: string, pl: number, label: string) => {
    if (!(pl > 0)) return;
    const old = next[kind];
    if (old && pl <= old.pl + 0.009) return;
    const rec: PlRecord = { kind, key, pl, label };
    next[kind] = rec;
    hits.push(rec);
  };

  for (const t of closedOf(trades)) {
    consider("trade", t.id, t.lastPl, t.label);
  }
  for (const [key, pl] of sumBy(trades, (t) => (t.closedAt || t.openedAt).slice(0, 10))) {
    consider("day", key, pl, key);
  }
  for (const [key, pl] of sumBy(trades, (t) => isoWeekKey(t.closedAt || t.openedAt))) {
    consider("week", key, pl, key);
  }
  for (const [key, pl] of sumBy(trades, (t) => (t.closedAt || t.openedAt).slice(0, 7))) {
    consider("month", key, pl, key);
  }
  for (const [key, pl] of sumBy(trades, (t) => (t.closedAt || t.openedAt).slice(0, 4))) {
    consider("year", key, pl, key);
  }
  return { next, hits };
}

export function dailySeries(trades: DeskTrade[], from: string, to: string): { date: string; pl: number; cum: number; count: number }[] {
  const by = new Map<string, { pl: number; count: number }>();
  for (const t of closedOf(trades, from, to)) {
    const d = (t.closedAt || t.openedAt).slice(0, 10);
    const cur = by.get(d) || { pl: 0, count: 0 };
    cur.pl += t.lastPl;
    cur.count += 1;
    by.set(d, cur);
  }
  const out: { date: string; pl: number; cum: number; count: number }[] = [];
  let cum = 0;
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const hit = by.get(date) || { pl: 0, count: 0 };
    cum += hit.pl;
    out.push({ date, pl: hit.pl, cum, count: hit.count });
  }
  return out;
}

export function ownerName(id: OwnerId | null): string {
  return OWNERS.find((o) => o.id === id)?.name ?? "Unassigned";
}
