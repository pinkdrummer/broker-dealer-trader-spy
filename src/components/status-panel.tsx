import {
  DEFAULT_ACCOUNT_SETTINGS,
  DEMO_SNAPSHOT,
  accountRungs,
  bpUsedPct,
  capPctFor,
  capStatus,
  delta1x,
  dollarsPerSpyPercent,
  laneTarget,
  mixTilt,
  multiple,
  nearestRungPct,
  nextVixRow,
  sleeves,
  thetaBand,
  viewDelta,
  vixRowOf,
  type CapStatus,
  type Lane,
  type MarginType,
  type RiskProfile,
} from "@/lib/account";
import { bookMix } from "@/lib/classify";
import { money } from "@/lib/book";
import { useBook } from "@/lib/store";
import { cn } from "@/lib/utils";

export function StatusPanel() {
  const book = useBook((s) => s.book);
  const settings = useBook((s) => s.accountSettings);
  const snapshot = useBook((s) => s.snapshot) ?? DEMO_SNAPSHOT;
  const cfg = { ...DEFAULT_ACCOUNT_SETTINGS, ...settings };

  const shareDelta = book
    .filter((c) => c.kind === "share")
    .reduce((s, c) => s + (c.delta ?? (c.side === "S" ? -c.qty : c.qty)), 0);
  const optionDelta = book
    .filter((c) => c.kind !== "share")
    .reduce((s, c) => s + (c.delta ?? 0) * c.qty, 0);
  const optionTheta = book
    .filter((c) => c.kind !== "share")
    .reduce((s, c) => s + (c.theta ?? 0) * c.qty, 0);

  const g = sleeves({ shareDelta, optionDelta, optionTheta });
  const vix = snapshot.vix ?? 16.4;
  const spy = snapshot.spy ?? 570;
  const capPct = capPctFor(vix, cfg.profile, snapshot.margin ?? cfg.margin);
  const usedPct = bpUsedPct(snapshot.bpUsed, snapshot.bpAvailable);
  const status = capStatus(usedPct, capPct);
  const den = snapshot.bpUsed + snapshot.bpAvailable || snapshot.netLiq;
  const capDollars = (capPct / 100) * den;
  const usedPctOfLiq = snapshot.netLiq > 0 ? (snapshot.bpUsed / snapshot.netLiq) * 100 : null;
  const oneX = delta1x(snapshot.netLiq, spy);
  const shown = viewDelta(g, cfg.view);
  const target = laneTarget({
    lane: cfg.lane,
    viewDelta: shown,
    netLiq: snapshot.netLiq,
    oneX,
    leverage: cfg.bullishLeverage,
    optionsTheta: g.optionTheta,
  });
  const theta = thetaBand(g.optionTheta, snapshot.netLiq);
  const rungs = accountRungs(snapshot.netLiq);
  const usedRung = nearestRungPct(snapshot.bpUsed, snapshot.netLiq);
  const mix = mixTilt(bookMix(book));
  const nextRow = nextVixRow(vix);
  const nextCap = nextRow ? capPctFor(rowMid(nextRow), cfg.profile, snapshot.margin ?? cfg.margin) : null;
  const mostStock = (g.sharePctOfDelta ?? 0) >= 60;

  return (
    <div className="flex flex-col gap-4 px-4 pb-24">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Chip label="Net liq" value={money(snapshot.netLiq)} />
        <Chip label="VIX" value={snapshot.vix != null ? `${snapshot.vix.toFixed(1)} · ${vixRowOf(vix)}` : "—"} />
        <Chip label="Profile" value={`${capLabel(cfg.profile)} · ${cfg.margin === "pm" ? "PM" : "Reg-T"}`} />
        <Chip label="Lane" value={capLabel(cfg.lane)} />
      </div>

      <SettingsRow />

      {book.length === 0 ? (
        <p className="text-sm text-muted text-pretty">
          Numbers below use the $135k sample snapshot until you pull tasty or load the sample book in
          Settings.
        </p>
      ) : null}

      {mostStock ? (
        <p className="text-sm text-fg text-pretty">
          Most delta is stock. The overlay is a sleeve, not the whole book.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-subtle">Buying power</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Used" value={money(snapshot.bpUsed)} />
          <Stat label="Available" value={money(snapshot.bpAvailable)} />
          <Stat label="Used %" value={usedPct != null ? `${usedPct.toFixed(1)}%` : "—"} className={statusTone(status)} />
          <Stat label={`${capLabel(cfg.profile)} cap`} value={`${capPct.toFixed(0)}% · ${money(capDollars)}`} />
        </div>
        <p className={cn("mt-3 text-sm text-pretty", statusTone(status))}>
          {statusLine(status, usedPct, capPct, vix, cfg.profile)}
          {nextCap != null ? ` Next VIX row cap ${nextCap.toFixed(0)}%.` : ""}
        </p>
        <p className="mt-2 text-xs text-subtle text-pretty">
          Status only. It does not block a trade and it does not flatten anything.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-subtle">
                <th className="pb-2 font-medium">Rung</th>
                <th className="pb-2 text-right font-medium">$ of net liq</th>
                <th className="pb-2 text-right font-medium">vs available BP</th>
              </tr>
            </thead>
            <tbody>
              {rungs.map((r) => {
                const mark = usedRung === r.pct;
                return (
                  <tr key={r.pct} className={mark ? "bg-elevated" : undefined}>
                    <td className="py-1.5 font-mono">{r.pct}%</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{money(r.dollars)}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-subtle">
                      {snapshot.bpAvailable > 0
                        ? `${((r.dollars / snapshot.bpAvailable) * 100).toFixed(0)}% of avail`
                        : "—"}
                      {mark && usedPctOfLiq != null ? ` · used ~${usedPctOfLiq.toFixed(0)}%` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-subtle">Greeks</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total Δ / θ" value={`${fmtDelta(g.totalDelta)} / ${fmtTheta(g.totalTheta)}`} />
          <Stat label="Shares Δ / θ" value={`${fmtDelta(g.shareDelta)} / ${fmtTheta(g.shareTheta)}`} />
          <Stat label="Options Δ / θ" value={`${fmtDelta(g.optionDelta)} / ${fmtTheta(g.optionTheta)}`} />
          <Stat
            label="Mix"
            value={`${g.sharePctOfDelta != null ? `${Math.round(g.sharePctOfDelta)}% Δ stock` : "—"}`}
          />
        </div>
        <p className="mt-3 text-xs text-subtle text-pretty">
          Share multiple {fmtMult(multiple(g.shareDelta, oneX))} vs SPY. Whole-account{" "}
          {fmtMult(multiple(g.totalDelta, oneX))}. $ per 1% SPY {money(dollarsPerSpyPercent(g.totalDelta, spy))}{" "}
          total, {money(dollarsPerSpyPercent(g.shareDelta, spy))} stock.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-subtle">
          Lane · {capLabel(cfg.lane)} · {cfg.view}
        </h2>
        <p className="text-sm text-pretty">
          Current {fmtDelta(shown)} vs {target.label} target {fmtDelta(target.target)}. Gap{" "}
          {fmtDelta(target.gap)} {target.gap > 0 ? "to add" : target.gap < 0 ? "to cut" : ""}.
        </p>
        <p className="mt-2 text-xs text-subtle">
          One lane only. Theta grade is on the overlay, not the stock book.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-subtle">Overlay theta</h2>
        <p className="text-sm">
          {fmtTheta(g.optionTheta)} vs {money(theta.floor)}–{money(theta.ceil)} ({theta.band}).
        </p>
        <p className="mt-2 text-xs text-subtle text-pretty">
          Whole-account θ {theta.pct != null ? `${theta.pct.toFixed(2)}%` : "—"} of net liq (footnote).
          {g.optionTheta && snapshot.bpUsed
            ? ` θ per $1,000 BP ${((g.optionTheta / snapshot.bpUsed) * 1000).toFixed(2)}.`
            : ""}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-subtle">Defined vs undefined</h2>
        <p className="text-sm text-pretty">
          {mixLabel(mix.label)} — defined {Math.round(mix.definedPct)}% · undefined{" "}
          {Math.round(mix.undefinedPct)}% · covered {Math.round(mix.coveredPct)}%.
        </p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-elevated">
          <div className="bg-up" style={{ width: `${mix.definedPct}%` }} />
          <div className="bg-accent" style={{ width: `${mix.coveredPct}%` }} />
          <div className="bg-down" style={{ width: `${mix.undefinedPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-subtle text-pretty">
          Low-vol lean: heavier defined. This meter is from open legs today, not ticket history yet.
        </p>
      </section>
    </div>
  );
}

function SettingsRow() {
  const cfg = useBook((s) => s.accountSettings);
  return (
    <div className="flex flex-wrap gap-2">
      {(["conservative", "moderate", "aggressive"] as RiskProfile[]).map((p) => (
        <Toggle
          key={p}
          on={cfg.profile === p}
          onClick={() => useBook.getState().setAccountSettings({ profile: p })}
        >
          {capLabel(p)}
        </Toggle>
      ))}
      {(["regt", "pm"] as MarginType[]).map((m) => (
        <Toggle
          key={m}
          on={cfg.margin === m}
          onClick={() => useBook.getState().setAccountSettings({ margin: m })}
        >
          {m === "pm" ? "PM" : "Reg-T"}
        </Toggle>
      ))}
      {(["neutral", "bullish", "bearish"] as Lane[]).map((l) => (
        <Toggle
          key={l}
          on={cfg.lane === l}
          onClick={() => useBook.getState().setAccountSettings({ lane: l })}
        >
          {capLabel(l)}
        </Toggle>
      ))}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-full border px-3 text-sm",
        on ? "border-accent bg-elevated text-fg" : "border-border text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs text-subtle">{label}</p>
      <p className="font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className={cn("font-mono text-base tabular-nums", className)}>{value}</p>
    </div>
  );
}

function capLabel(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function statusTone(s: CapStatus) {
  if (s === "over") return "text-down";
  if (s === "near") return "text-fg";
  return "text-up";
}

function statusLine(
  status: CapStatus,
  usedPct: number | null,
  capPct: number,
  vix: number,
  profile: RiskProfile,
) {
  const used = usedPct != null ? `${usedPct.toFixed(0)}%` : "—";
  const word = status === "over" ? "Over" : status === "near" ? "Near" : "Under";
  return `${word} cap. Used ${used} vs ${capPct.toFixed(0)}% ${profile} cap at VIX ${vix.toFixed(1)}.`;
}

function fmtDelta(n: number) {
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}${Math.abs(n).toFixed(0)}`;
}

function fmtTheta(n: number) {
  if (!n) return "—";
  return money(n);
}

function fmtMult(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}×`;
}

function mixLabel(label: ReturnType<typeof mixTilt>["label"]) {
  if (label === "defined-heavy") return "Tipped defined";
  if (label === "undefined-heavy") return "Tipped undefined";
  if (label === "covered-heavy") return "Tipped covered-call";
  return "Balanced mix";
}

function rowMid(row: ReturnType<typeof vixRowOf> | string): number {
  if (row === "10-15") return 12;
  if (row === "15-20") return 17;
  if (row === "20-30") return 25;
  if (row === "30-40") return 35;
  return 45;
}
