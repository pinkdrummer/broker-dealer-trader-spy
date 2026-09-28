import { metrics, money, type Contract } from "./book";
import { structureOf } from "./classify";

export type OptionPackage = {
  id: string;
  und: string;
  exp: string;
  structure: ReturnType<typeof structureOf>;
  legs: Contract[];
  pl: number;
  pct: number | null;
  vs: "credit" | "debit";
  label: string;
};

export function packageId(und: string, exp: string): string {
  return `pkg|${und}|${exp}`;
}

export function optionPackages(book: Contract[]): OptionPackage[] {
  const buckets = new Map<string, Contract[]>();
  for (const c of book) {
    if (c.kind === "share") continue;
    const id = packageId(c.und, c.exp);
    const list = buckets.get(id) ?? [];
    list.push(c);
    buckets.set(id, list);
  }
  const out: OptionPackage[] = [];
  for (const [id, legs] of buckets) {
    const structure = structureOf(legs);
    const pl = legs.reduce((s, c) => s + metrics(c).pl, 0);
    const shortOpen = legs.filter((c) => c.side === "S").reduce((s, c) => s + c.open, 0);
    const longOpen = legs.filter((c) => c.side === "L").reduce((s, c) => s + c.open, 0);
    const net = shortOpen - longOpen;
    const vs: "credit" | "debit" = net >= 0 ? "credit" : "debit";
    const basis = Math.abs(net) > 0 ? Math.abs(net) : shortOpen + longOpen;
    const pct = basis > 0 ? (pl / basis) * 100 : null;
    const first = legs[0];
    if (!first) continue;
    out.push({
      id,
      und: first.und,
      exp: first.exp,
      structure,
      legs,
      pl,
      pct,
      vs,
      label: packageLabel(first.und, first.exp, structure, legs),
    });
  }
  return out;
}

export function packageLabel(
  und: string,
  exp: string,
  structure: ReturnType<typeof structureOf>,
  legs: Contract[],
): string {
  const when = exp ? exp.slice(5) : "";
  if (structure === "strangle") return `${und} ${when} strangle`;
  if (structure === "vertical") return `${und} ${when} vertical`;
  if (structure === "condor") return `${und} ${when} iron condor`;
  if (legs.length === 1) {
    const c = legs[0]!;
    return `${und} ${when} ${c.strike}${c.right}`;
  }
  return `${und} ${when} package`;
}

export function packageMoneyLine(pkg: OptionPackage): string {
  const pct = pkg.pct == null ? "—" : `${pkg.pct >= 0 ? "+" : "−"}${Math.round(Math.abs(pkg.pct))}%`;
  return `${pkg.label}  ${pct} of ${pkg.vs}  P/L ${money(pkg.pl)}`;
}
