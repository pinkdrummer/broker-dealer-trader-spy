import {
  capPctFor,
  capStatus,
  bpUsedPct,
  mixTilt,
  type AccountSettings,
  type AccountSnapshot,
} from "./account";
import { bookMix } from "./classify";
import { eventMarks, type Contract } from "./book";
import { optionPackages } from "./packages";
import { zeroWindow, type ZeroWindow } from "./session";
import { changeLabel, type TapeQuote } from "./tape";
import type { DeskTrade } from "./trades";

export type MorningBrief = {
  asOfLabel: string;
  headline: string;
  market: string;
  book: string;
  watch: string[];
  window: string;
};

function tapeOf(tape: TapeQuote[], symbol: string): TapeQuote | undefined {
  return tape.find((t) => t.symbol === symbol);
}

export function composeBrief(args: {
  book: Contract[];
  snapshot: AccountSnapshot;
  settings: AccountSettings;
  trades: DeskTrade[];
  tape: TapeQuote[];
  now?: Date;
}): MorningBrief {
  const now = args.now ?? new Date();
  const { book, snapshot, settings, tape } = args;
  const vix = tapeOf(tape, "VIX")?.last ?? snapshot.vix ?? 16;
  const spy = tapeOf(tape, "SPY");
  const ndx = tapeOf(tape, "NDX") ?? tapeOf(tape, "QQQ");
  const rut = tapeOf(tape, "RUT") ?? tapeOf(tape, "IWM");
  const tlt = tapeOf(tape, "TLT");
  const gld = tapeOf(tape, "GLD");
  const uso = tapeOf(tape, "USO");
  const btc = tapeOf(tape, "BTC/USD");

  const cap = capPctFor(vix, settings.profile, snapshot.margin ?? settings.margin);
  const used = bpUsedPct(snapshot.bpUsed, snapshot.bpAvailable);
  const status = capStatus(used, cap);
  const mix = mixTilt(bookMix(book));
  const pkgs = optionPackages(book);
  const hot = pkgs
    .filter((p) => (p.pct ?? 0) <= -100)
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  const ripe = pkgs
    .filter((p) => (p.pct ?? 0) >= 50)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const events = book.flatMap((c) => eventMarks(c, now).map((m) => `${c.und} ${m}`));
  const uniqueEvents = [...new Set(events)];
  const win = zeroWindow(now);

  const headline = headlineOf({ status, mix: mix.label, hot: hot.length, ripe: ripe.length, vix });
  const market = marketParagraph({ spy, ndx, rut, tlt, gld, uso, btc, vix });
  const bookLine = bookParagraph({ snapshot, used, cap, status, settings, mix: mix.label, pkgs, hot, ripe });
  const watch = watchList({ hot, ripe, uniqueEvents, notes: args.trades.filter((t) => t.status === "open" && t.notes) });
  return {
    asOfLabel: now.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    headline,
    market,
    book: bookLine,
    watch,
    window: windowLine(win),
  };
}

function headlineOf(args: {
  status: ReturnType<typeof capStatus>;
  mix: string;
  hot: number;
  ripe: number;
  vix: number;
}): string {
  if (args.hot) return `${args.hot} ticket${args.hot === 1 ? "" : "s"} already at a manage level.`;
  if (args.status === "over") return "Buying power is over the cap. Size is the story this morning.";
  if (args.ripe) return `${args.ripe} package${args.ripe === 1 ? "" : "s"} sitting on 50% of credit or better.`;
  if (args.mix === "undefined-heavy") return `Book is tipped undefined with VIX at ${args.vix.toFixed(1)}.`;
  return `Quiet book. VIX ${args.vix.toFixed(1)}. Collect and stay awake.`;
}

function marketParagraph(q: {
  spy?: TapeQuote;
  ndx?: TapeQuote;
  rut?: TapeQuote;
  tlt?: TapeQuote;
  gld?: TapeQuote;
  uso?: TapeQuote;
  btc?: TapeQuote;
  vix: number;
}): string {
  const bits = [
    q.spy ? `S&P is ${changeLabel(q.spy.changePct)}` : null,
    q.ndx ? `Nasdaq ${changeLabel(q.ndx.changePct)}` : null,
    q.rut ? `small caps ${changeLabel(q.rut.changePct)}` : null,
    `VIX ${q.vix.toFixed(1)}`,
    q.tlt ? `long bonds ${changeLabel(q.tlt.changePct)}` : null,
    q.gld ? `gold ${changeLabel(q.gld.changePct)}` : null,
    q.uso ? `oil ${changeLabel(q.uso.changePct)}` : null,
    q.btc ? `bitcoin ${changeLabel(q.btc.changePct)}` : null,
  ].filter(Boolean);
  return bits.join(". ") + ".";
}

function bookParagraph(args: {
  snapshot: AccountSnapshot;
  used: number | null;
  cap: number;
  status: ReturnType<typeof capStatus>;
  settings: AccountSettings;
  mix: string;
  pkgs: ReturnType<typeof optionPackages>;
  hot: ReturnType<typeof optionPackages>;
  ripe: ReturnType<typeof optionPackages>;
}): string {
  const used = args.used != null ? `${args.used.toFixed(0)}%` : "—";
  const capWord = args.status === "over" ? "over" : args.status === "near" ? "near" : "under";
  const mixWord =
    args.mix === "undefined-heavy"
      ? "tipped undefined"
      : args.mix === "defined-heavy"
        ? "tipped defined"
        : args.mix === "covered-heavy"
          ? "tipped covered-call"
          : "a balanced mix";
  const tickets = args.pkgs.length;
  return `Net liq ${Math.round(args.snapshot.netLiq).toLocaleString("en-US")} dollars. Buying power is ${capWord} the ${args.settings.profile} cap — used ${used} vs ${args.cap.toFixed(0)}%. ${tickets} live option ticket${tickets === 1 ? "" : "s"}, ${mixWord}.`;
}

function watchList(args: {
  hot: ReturnType<typeof optionPackages>;
  ripe: ReturnType<typeof optionPackages>;
  uniqueEvents: string[];
  notes: { label: string; notes: string }[];
}): string[] {
  const out: string[] = [];
  for (const p of args.hot.slice(0, 4)) {
    out.push(`${p.label} is ${Math.round(p.pct ?? 0)}% of ${p.vs} — that is a manage look, not a hope.`);
  }
  for (const p of args.ripe.slice(0, 3)) {
    out.push(`${p.label} is +${Math.round(p.pct ?? 0)}% of ${p.vs}. 50% is fair game to take.`);
  }
  for (const e of args.uniqueEvents.slice(0, 4)) out.push(e);
  for (const t of args.notes.slice(0, 3)) {
    const first = t.notes.split("\n")[0]?.trim();
    if (first) out.push(`${t.label}: ${first}`);
  }
  if (!out.length) out.push("No earnings, no −100% legs, no ripe 50% tickets. Leave the book alone unless the tape changes that.");
  return out;
}

function windowLine(w: ZeroWindow): string {
  if (w.state === "open") return `0DTE window is open. ${w.detail}.`;
  if (w.state === "before") return `0DTE window is not open yet. ${w.detail} to 9:30 ET.`;
  if (w.state === "weekend") return `Weekend. Next 0DTE window is Monday 9:30–11:00 ET.`;
  return `0DTE entry window is shut. ${w.detail}.`;
}
