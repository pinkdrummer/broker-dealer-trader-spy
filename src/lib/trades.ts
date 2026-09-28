import { metrics, type Contract } from "./book";
import { structureOf } from "./classify";
import { optionPackages } from "./packages";

export type TradeStatus = "open" | "closed";
export type TradeKind = "option" | "share";

export type OwnerId = "J" | "A" | "P";

export const OWNERS: { id: OwnerId; name: string }[] = [
  { id: "J", name: "Jonathan" },
  { id: "A", name: "Aidan" },
  { id: "P", name: "Palo" },
];

export type DeskTrade = {
  id: string;
  und: string;
  kind: TradeKind;
  status: TradeStatus;
  structure: string;
  notes: string;
  owner: OwnerId | null;
  openedAt: string;
  closedAt: string | null;
  exp: string;
  legKeys: string[];
  lastPl: number;
  lastPct: number | null;
  vs: "credit" | "debit" | "stock";
  label: string;
};

export type LiveUnit = {
  und: string;
  kind: TradeKind;
  structure: string;
  exp: string;
  legKeys: string[];
  pl: number;
  pct: number | null;
  vs: DeskTrade["vs"];
  label: string;
};

export function newTradeId(): string {
  return `t_${Math.random().toString(36).slice(2, 10)}`;
}

export function liveUnits(book: Contract[]): LiveUnit[] {
  const units: LiveUnit[] = optionPackages(book).map((pkg) => ({
    und: pkg.und,
    kind: "option",
    structure: pkg.structure,
    exp: pkg.exp,
    legKeys: pkg.legs.map((l) => l.key),
    pl: pkg.pl,
    pct: pkg.pct,
    vs: pkg.vs,
    label: pkg.label,
  }));
  for (const c of book) {
    if (c.kind !== "share") continue;
    const { pl, pct } = metrics(c);
    units.push({
      und: c.und,
      kind: "share",
      structure: "stock",
      exp: "",
      legKeys: [c.key],
      pl,
      pct,
      vs: "stock",
      label: `${c.und} shares`,
    });
  }
  return units;
}

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.reduce((n, k) => n + (set.has(k) ? 1 : 0), 0);
}

export function syncTrades(
  prev: DeskTrade[],
  book: Contract[],
  now: Date = new Date(),
): DeskTrade[] {
  const units = liveUnits(book);
  const open = prev.filter((t) => t.status === "open");
  const archived = prev.filter((t) => t.status === "closed");
  const used = new Set<string>();
  const claimed = new Set<number>();
  const nextOpen: DeskTrade[] = [];

  const take = (trade: DeskTrade, unit: LiveUnit, idx: number) => {
    used.add(trade.id);
    claimed.add(idx);
    nextOpen.push({
      ...trade,
      structure: unit.structure,
      exp: unit.exp,
      legKeys: unit.legKeys,
      lastPl: unit.pl,
      lastPct: unit.pct,
      vs: unit.vs,
      label: unit.label,
      status: "open",
      closedAt: null,
    });
  };

  units.forEach((unit, idx) => {
    const hit = open.find(
      (t) =>
        !used.has(t.id) &&
        t.kind === unit.kind &&
        t.und === unit.und &&
        overlap(t.legKeys, unit.legKeys) > 0,
    );
    if (hit) take(hit, unit, idx);
  });

  units.forEach((unit, idx) => {
    if (claimed.has(idx)) return;
    const hit = open.find(
      (t) => !used.has(t.id) && t.kind === unit.kind && t.und === unit.und && t.exp === unit.exp,
    );
    if (hit) take(hit, unit, idx);
  });

  units.forEach((unit, idx) => {
    if (claimed.has(idx) || unit.kind !== "option") return;
    const openLeft = open.filter((t) => !used.has(t.id) && t.kind === "option" && t.und === unit.und);
    const unitLeft = units.filter(
      (u, i) => !claimed.has(i) && u.kind === "option" && u.und === unit.und,
    );
    if (openLeft.length === 1 && unitLeft.length === 1 && openLeft[0]) {
      take(openLeft[0], unit, idx);
    }
  });

  units.forEach((unit, idx) => {
    if (claimed.has(idx)) return;
    nextOpen.push({
      id: newTradeId(),
      und: unit.und,
      kind: unit.kind,
      status: "open",
      structure: unit.structure,
      notes: "",
      owner: null,
      openedAt: now.toISOString(),
      closedAt: null,
      exp: unit.exp,
      legKeys: unit.legKeys,
      lastPl: unit.pl,
      lastPct: unit.pct,
      vs: unit.vs,
      label: unit.label,
    });
  });

  const newlyClosed = open
    .filter((t) => !used.has(t.id))
    .map((t) => ({ ...t, status: "closed" as const, closedAt: now.toISOString() }));

  return [...nextOpen, ...newlyClosed, ...archived];
}

export function tradeForContract(trades: DeskTrade[], key: string): DeskTrade | undefined {
  return trades.find((t) => t.status === "open" && t.legKeys.includes(key));
}

export function setTradeNotes(trades: DeskTrade[], id: string, notes: string): DeskTrade[] {
  return trades.map((t) => (t.id === id ? { ...t, notes } : t));
}

export function setTradeOwner(trades: DeskTrade[], id: string, owner: OwnerId | null): DeskTrade[] {
  return trades.map((t) => (t.id === id ? { ...t, owner } : t));
}
