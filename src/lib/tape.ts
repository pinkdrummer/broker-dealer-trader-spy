export type TapeType = "index" | "equity" | "crypto";

export type TapeSpec = {
  symbol: string;
  name: string;
  type: TapeType;
};

export type TapeQuote = {
  symbol: string;
  name: string;
  last: number;
  prevClose: number | null;
  changePct: number | null;
  high: number | null;
  low: number | null;
};

export const TAPE_SPECS: TapeSpec[] = [
  { symbol: "SPX", name: "S&P 500", type: "index" },
  { symbol: "NDX", name: "Nasdaq 100", type: "index" },
  { symbol: "RUT", name: "Russell 2000", type: "index" },
  { symbol: "VIX", name: "VIX", type: "index" },
  { symbol: "SPY", name: "S&P ETF", type: "equity" },
  { symbol: "QQQ", name: "Nasdaq ETF", type: "equity" },
  { symbol: "IWM", name: "Small caps", type: "equity" },
  { symbol: "TLT", name: "Long bonds", type: "equity" },
  { symbol: "GLD", name: "Gold", type: "equity" },
  { symbol: "SLV", name: "Silver", type: "equity" },
  { symbol: "USO", name: "Oil", type: "equity" },
  { symbol: "BTC/USD", name: "Bitcoin", type: "crypto" },
];

export const DEMO_TAPE: TapeQuote[] = [
  { symbol: "SPX", name: "S&P 500", last: 5712, prevClose: 5698, changePct: 0.25, high: 5724, low: 5688 },
  { symbol: "NDX", name: "Nasdaq 100", last: 20110, prevClose: 20040, changePct: 0.35, high: 20180, low: 19990 },
  { symbol: "RUT", name: "Russell 2000", last: 2218, prevClose: 2231, changePct: -0.58, high: 2236, low: 2210 },
  { symbol: "VIX", name: "VIX", last: 16.4, prevClose: 16.9, changePct: -3.0, high: 17.2, low: 16.1 },
  { symbol: "SPY", name: "S&P ETF", last: 570.1, prevClose: 568.6, changePct: 0.26, high: 571.4, low: 567.9 },
  { symbol: "QQQ", name: "Nasdaq ETF", last: 492.4, prevClose: 490.8, changePct: 0.33, high: 494.0, low: 489.5 },
  { symbol: "IWM", name: "Small caps", last: 218.2, prevClose: 219.6, changePct: -0.64, high: 220.1, low: 217.8 },
  { symbol: "TLT", name: "Long bonds", last: 91.4, prevClose: 91.8, changePct: -0.44, high: 92.0, low: 91.2 },
  { symbol: "GLD", name: "Gold", last: 246.8, prevClose: 245.1, changePct: 0.69, high: 247.4, low: 244.9 },
  { symbol: "SLV", name: "Silver", last: 29.1, prevClose: 28.6, changePct: 1.75, high: 29.3, low: 28.5 },
  { symbol: "USO", name: "Oil", last: 76.2, prevClose: 77.0, changePct: -1.04, high: 77.3, low: 75.9 },
  { symbol: "BTC/USD", name: "Bitcoin", last: 64_200, prevClose: 63_400, changePct: 1.26, high: 64_800, low: 63_050 },
];

export function changeLabel(pct: number | null): string {
  if (pct == null) return "unchanged";
  const abs = Math.abs(pct).toFixed(2);
  if (pct > 0.15) return `up ${abs}%`;
  if (pct < -0.15) return `down ${abs}%`;
  return "basically flat";
}
