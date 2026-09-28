/** Account-status math. Spec: portfolio-bias-app-spec.md. No orders. */

export type RiskProfile = "conservative" | "moderate" | "aggressive";
export type MarginType = "regt" | "pm";
export type Lane = "neutral" | "bullish" | "bearish";
export type LaneView = "options" | "shares" | "whole";
export type CapStatus = "under" | "near" | "over";
export type ThetaBand = "light" | "in" | "hot";

export type AccountSettings = {
  profile: RiskProfile;
  margin: MarginType;
  lane: Lane;
  view: LaneView;
  bullishLeverage: 1 | 1.5 | 2;
  weightSymbol: string;
};

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  profile: "moderate",
  margin: "regt",
  lane: "neutral",
  view: "options",
  bullishLeverage: 1,
  weightSymbol: "SPY",
};

export type VixRow = "10-15" | "15-20" | "20-30" | "30-40" | "40+";

const VIX_ROWS: { row: VixRow; lo: number; hi: number; cons: number; pmLo: number; pmHi: number }[] = [
  { row: "10-15", lo: 10, hi: 15, cons: 25, pmLo: 20, pmHi: 25 },
  { row: "15-20", lo: 15, hi: 20, cons: 30, pmLo: 20, pmHi: 30 },
  { row: "20-30", lo: 20, hi: 30, cons: 35, pmLo: 25, pmHi: 35 },
  { row: "30-40", lo: 30, hi: 40, cons: 40, pmLo: 30, pmHi: 40 },
  { row: "40+", lo: 40, hi: 200, cons: 50, pmLo: 35, pmHi: 45 },
];

export function vixRowOf(vix: number): VixRow {
  if (vix < 15) return "10-15";
  if (vix < 20) return "15-20";
  if (vix < 30) return "20-30";
  if (vix < 40) return "30-40";
  return "40+";
}

function bump30(n: number): number {
  return Math.min(50, n * 1.3);
}

export function capPctFor(vix: number, profile: RiskProfile, margin: MarginType): number {
  const spec = VIX_ROWS.find((r) => r.row === vixRowOf(vix)) ?? VIX_ROWS[0];
  if (margin === "pm") {
    if (profile === "conservative") return spec.pmLo;
    if (profile === "aggressive") return spec.pmHi;
    return (spec.pmLo + spec.pmHi) / 2;
  }
  if (profile === "conservative") return spec.cons;
  if (profile === "moderate") return bump30(spec.cons);
  return bump30(bump30(spec.cons));
}

export function nextVixRow(vix: number): VixRow | null {
  const order: VixRow[] = ["10-15", "15-20", "20-30", "30-40", "40+"];
  const i = order.indexOf(vixRowOf(vix));
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function bpUsedPct(used: number, available: number): number | null {
  const den = used + available;
  if (!(den > 0)) return null;
  return (used / den) * 100;
}

export function capStatus(usedPct: number | null, capPct: number): CapStatus {
  if (usedPct == null) return "under";
  if (usedPct > capPct) return "over";
  if (capPct - usedPct <= 5) return "near";
  return "under";
}

export function delta1x(netLiq: number, spy: number): number | null {
  if (!(netLiq > 0) || !(spy > 0)) return null;
  return netLiq / spy;
}

export function multiple(delta: number, oneX: number | null): number | null {
  if (oneX == null || !(Math.abs(oneX) > 0)) return null;
  return delta / oneX;
}

export function dollarsPerSpyPoint(delta: number): number {
  return delta;
}

export function dollarsPerSpyPercent(delta: number, spy: number): number {
  return delta * spy * 0.01;
}

export function laneTarget(args: {
  lane: Lane;
  viewDelta: number;
  netLiq: number;
  oneX: number | null;
  leverage: number;
  optionsTheta: number;
}): { target: number; gap: number; label: string } {
  const { lane, viewDelta, netLiq, oneX, leverage, optionsTheta } = args;
  if (lane === "neutral") {
    const band = 0.001 * netLiq;
    const target = 0;
    const gap = viewDelta;
    return { target, gap, label: `Neutral band ±${band.toFixed(0)} Δ` };
  }
  if (lane === "bullish") {
    const target = (oneX ?? 0) * leverage;
    return { target, gap: target - viewDelta, label: `Bullish ${leverage.toFixed(1)}×` };
  }
  const target = optionsTheta !== 0 ? -optionsTheta / 2 : 0;
  return { target, gap: target - viewDelta, label: "Bearish |Δ| / θ = 0.5" };
}

export function thetaBand(optionsTheta: number, netLiq: number): {
  band: ThetaBand;
  floor: number;
  ceil: number;
  pct: number | null;
} {
  const floor = 0.001 * netLiq;
  const ceil = 0.005 * netLiq;
  const pct = netLiq > 0 ? (optionsTheta / netLiq) * 100 : null;
  let band: ThetaBand = "in";
  if (optionsTheta < floor) band = "light";
  else if (optionsTheta > ceil) band = "hot";
  return { band, floor, ceil, pct };
}

export function accountRungs(netLiq: number): { pct: number; dollars: number }[] {
  return [1, 2, 3, 4, 5, 6, 7].map((pct) => ({ pct, dollars: (pct / 100) * netLiq }));
}

export function nearestRungPct(dollars: number, netLiq: number): number | null {
  if (!(netLiq > 0)) return null;
  const pct = (dollars / netLiq) * 100;
  const rungs = [1, 2, 3, 4, 5, 6, 7];
  let best = rungs[0];
  for (const r of rungs) {
    if (Math.abs(r - pct) < Math.abs(best - pct)) best = r;
  }
  return best;
}

export type SleeveGreeks = {
  shareDelta: number;
  optionDelta: number;
  futureDelta: number;
  totalDelta: number;
  shareTheta: number;
  optionTheta: number;
  futureTheta: number;
  totalTheta: number;
  sharePctOfDelta: number | null;
  optionPctOfTheta: number | null;
};

export function sleeves(args: {
  shareDelta: number;
  optionDelta: number;
  futureDelta?: number;
  shareTheta?: number;
  optionTheta: number;
  futureTheta?: number;
}): SleeveGreeks {
  const shareDelta = args.shareDelta;
  const optionDelta = args.optionDelta;
  const futureDelta = args.futureDelta ?? 0;
  const shareTheta = args.shareTheta ?? 0;
  const optionTheta = args.optionTheta;
  const futureTheta = args.futureTheta ?? 0;
  const totalDelta = shareDelta + optionDelta + futureDelta;
  const totalTheta = shareTheta + optionTheta + futureTheta;
  return {
    shareDelta,
    optionDelta,
    futureDelta,
    totalDelta,
    shareTheta,
    optionTheta,
    futureTheta,
    totalTheta,
    sharePctOfDelta: Math.abs(totalDelta) > 1e-9 ? (shareDelta / totalDelta) * 100 : null,
    optionPctOfTheta: Math.abs(totalTheta) > 1e-9 ? (optionTheta / totalTheta) * 100 : null,
  };
}

export function viewDelta(s: SleeveGreeks, view: LaneView): number {
  if (view === "shares") return s.shareDelta;
  if (view === "whole") return s.totalDelta;
  return s.optionDelta;
}

export type MixSplit = { defined: number; undefined: number; covered: number };

export function mixTilt(mix: MixSplit): {
  label: "defined-heavy" | "undefined-heavy" | "covered-heavy" | "balanced";
  definedPct: number;
  undefinedPct: number;
  coveredPct: number;
} {
  const total = mix.defined + mix.undefined + mix.covered;
  if (!(total > 0)) {
    return { label: "balanced", definedPct: 0, undefinedPct: 0, coveredPct: 0 };
  }
  const definedPct = (mix.defined / total) * 100;
  const undefinedPct = (mix.undefined / total) * 100;
  const coveredPct = (mix.covered / total) * 100;
  const top = Math.max(definedPct, undefinedPct, coveredPct);
  if (top < 50) return { label: "balanced", definedPct, undefinedPct, coveredPct };
  if (definedPct === top) return { label: "defined-heavy", definedPct, undefinedPct, coveredPct };
  if (undefinedPct === top) return { label: "undefined-heavy", definedPct, undefinedPct, coveredPct };
  return { label: "covered-heavy", definedPct, undefinedPct, coveredPct };
}

export type AccountSnapshot = {
  account: string;
  netLiq: number;
  bpUsed: number;
  bpAvailable: number;
  margin: MarginType | null;
  vix: number | null;
  spy: number | null;
  dayPl: number | null;
  asOf: string | null;
};

export const DEMO_SNAPSHOT: AccountSnapshot = {
  account: "DEMO",
  netLiq: 135_000,
  bpUsed: 38_000,
  bpAvailable: 97_000,
  margin: "regt",
  vix: 16.4,
  spy: 570,
  dayPl: 420,
  asOf: null,
};
