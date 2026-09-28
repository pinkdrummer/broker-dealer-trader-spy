import type { Contract, Right, Side } from "./book";

export type InstrumentKind = "share" | "option" | "future";
export type RiskShape = "defined" | "undefined" | "covered" | "stock" | "long";

export type ClassifiedLeg = {
  key: string;
  und: string;
  kind: InstrumentKind;
  shape: RiskShape;
  coveredLots: number;
  nakedShortCalls: number;
  leftoverShares: number;
};

function isShare(c: Contract): boolean {
  return c.kind === "share" || (!c.exp && c.right !== "C" && c.right !== "P");
}

export function pairCoveredCalls(rows: Contract[]): Map<string, ClassifiedLeg> {
  const out = new Map<string, ClassifiedLeg>();
  const byUnd = new Map<string, Contract[]>();
  for (const c of rows) {
    const list = byUnd.get(c.und) ?? [];
    list.push(c);
    byUnd.set(c.und, list);
  }

  for (const [und, items] of byUnd) {
    const shares = items.filter((c) => c.kind === "share" && c.side === "L");
    const shortCalls = items
      .filter((c) => c.kind !== "share" && c.side === "S" && c.right === "C")
      .slice()
      .sort((a, b) => a.exp.localeCompare(b.exp) || a.strike - b.strike);

    const shareQty = shares.reduce((s, c) => s + c.qty, 0);
    let lotsLeft = Math.floor(shareQty / 100);

    for (const call of shortCalls) {
      const take = Math.min(call.qty, lotsLeft);
      lotsLeft -= take;
      out.set(call.key, {
        key: call.key,
        und,
        kind: "option",
        shape: take >= call.qty && call.qty > 0 ? "covered" : take > 0 ? "covered" : "undefined",
        coveredLots: take,
        nakedShortCalls: Math.max(0, call.qty - take),
        leftoverShares: 0,
      });
    }

    const leftoverShares = shareQty - Math.floor(shareQty / 100) * 100 + lotsLeft * 100;
    for (const sh of shares) {
      out.set(sh.key, {
        key: sh.key,
        und,
        kind: "share",
        shape: "stock",
        coveredLots: Math.floor(shareQty / 100) - lotsLeft,
        nakedShortCalls: 0,
        leftoverShares,
      });
    }

    for (const c of items) {
      if (out.has(c.key)) continue;
      out.set(c.key, classifyLone(c));
    }
  }
  return out;
}

function classifyLone(c: Contract): ClassifiedLeg {
  if (c.kind === "share") {
    return {
      key: c.key,
      und: c.und,
      kind: "share",
      shape: "stock",
      coveredLots: 0,
      nakedShortCalls: 0,
      leftoverShares: c.qty,
    };
  }
  if (c.side === "L") {
    return {
      key: c.key,
      und: c.und,
      kind: "option",
      shape: "long",
      coveredLots: 0,
      nakedShortCalls: 0,
      leftoverShares: 0,
    };
  }
  return {
    key: c.key,
    und: c.und,
    kind: "option",
    shape: "undefined",
    coveredLots: 0,
    nakedShortCalls: c.right === "C" ? c.qty : 0,
    leftoverShares: 0,
  };
}

/** Position-based structure guess until ticket history lands. */
export function structureOf(undRows: Contract[]): "vertical" | "strangle" | "condor" | "single" | "stock" | "mixed" {
  const opts = undRows.filter((c) => c.kind !== "share");
  const shares = undRows.filter((c) => c.kind === "share");
  if (!opts.length && shares.length) return "stock";
  const shorts = opts.filter((c) => c.side === "S");
  const longs = opts.filter((c) => c.side === "L");
  const rights = new Set(opts.map((c) => c.right));
  if (shorts.length === 2 && longs.length === 2) return "condor";
  if (shorts.length >= 1 && longs.length >= 1 && rights.size === 1) return "vertical";
  if (shorts.length >= 2 && longs.length === 0 && rights.has("C") && rights.has("P")) return "strangle";
  if (opts.length === 1) return "single";
  return "mixed";
}

export function definedFromStructure(
  structure: ReturnType<typeof structureOf>,
  shape: RiskShape,
): RiskShape {
  if (shape === "covered" || shape === "stock" || shape === "long") return shape;
  if (structure === "vertical" || structure === "condor") return "defined";
  return shape;
}

export function bookMix(rows: Contract[]): { defined: number; undefined: number; covered: number } {
  const paired = pairCoveredCalls(rows);
  const byUnd = new Map<string, Contract[]>();
  for (const c of rows) {
    const list = byUnd.get(c.und) ?? [];
    list.push(c);
    byUnd.set(c.und, list);
  }
  const mix = { defined: 0, undefined: 0, covered: 0 };
  for (const c of rows) {
    if (c.side !== "S") continue;
    if (c.kind === "share") continue;
    const structure = structureOf(byUnd.get(c.und) ?? []);
    const raw = paired.get(c.key)?.shape ?? "undefined";
    const shape = definedFromStructure(structure, raw);
    if (shape === "defined") mix.defined += 1;
    else if (shape === "covered") mix.covered += 1;
    else if (shape === "undefined") mix.undefined += 1;
  }
  return mix;
}

export type { Right, Side };
