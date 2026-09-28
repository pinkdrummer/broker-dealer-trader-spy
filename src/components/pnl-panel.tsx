import { money } from "@/lib/book";
import { DEMO_SNAPSHOT } from "@/lib/account";
import { dailySeries, ownerName, periodStats } from "@/lib/pnl";
import { OWNERS } from "@/lib/trades";
import { useBook } from "@/lib/store";
import { OwnerBadge } from "@/components/owner-badge";
import { tone } from "@/components/contract-panel";
import { cn } from "@/lib/utils";

function cards(s: ReturnType<typeof periodStats>) {
  return [
    ["Trades", String(s.trades), ""],
    ["Net P/L", money(s.net), tone(s.net)],
    ["Wins", String(s.wins), "text-up"],
    ["Losses", String(s.losses), "text-down"],
    ["Win rate", s.winRate == null ? "—" : `${s.winRate.toFixed(1)}%`, ""],
    ["Avg win", s.avgWin == null ? "—" : money(s.avgWin), "text-up"],
    ["Avg loss", s.avgLoss == null ? "—" : money(s.avgLoss), "text-down"],
    ["Gain % liq", s.gainPctLiq == null ? "—" : `${s.gainPctLiq.toFixed(2)}%`, tone(s.gainPctLiq)],
  ] as const;
}

export function PnlPanel() {
  const trades = useBook((s) => s.trades);
  const netLiq = useBook((s) => s.snapshot)?.netLiq ?? DEMO_SNAPSHOT.netLiq;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const monthFrom = `${y}-${m}-01`;
  const monthTo = new Date(y, now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const ytdFrom = `${y}-01-01`;
  const ytdTo = now.toISOString().slice(0, 10);
  const month = periodStats(trades, netLiq, monthFrom, monthTo);
  const ytd = periodStats(trades, netLiq, ytdFrom, ytdTo);
  const series = dailySeries(trades, monthFrom, monthTo);
  const records = useBook((s) => s.records);

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 pt-4">
      <p className="text-sm text-muted text-pretty">
        Closed tickets only. Tag J / A / P on the ticket so we know who put the P/L on the account.
      </p>

      <section>
        <h2 className="mb-3 text-sm font-medium">This month</h2>
        <StatGrid items={cards(month)} />
        <OwnerSplit stats={month} />
        <Spark series={series} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">{y} year to date</h2>
        <StatGrid items={cards(ytd)} />
        <OwnerSplit stats={ytd} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Records</h2>
        <ul className="grid gap-2">
          {(["trade", "day", "week", "month", "year"] as const).map((k) => {
            const r = records[k];
            return (
              <li key={k} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                <span className="text-sm capitalize">{k}</span>
                <span className={cn("font-mono text-sm tabular-nums", r ? "text-up" : "text-subtle")}>
                  {r ? `${money(r.pl)} · ${r.label}` : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function StatGrid({ items }: { items: readonly (readonly [string, string, string])[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map(([label, value, cls]) => (
        <div key={label} className="rounded-lg border border-border bg-surface px-3 py-3">
          <p className="text-xs text-subtle">{label}</p>
          <p className={cn("font-mono text-lg tabular-nums", cls)}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function OwnerSplit({ stats }: { stats: ReturnType<typeof periodStats> }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {OWNERS.map((o) => {
        const row = stats.byOwner[o.id];
        return (
          <div key={o.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <OwnerBadge owner={o.id} />
            <div className="min-w-0">
              <p className="truncate text-xs text-subtle">{ownerName(o.id)}</p>
              <p className={cn("font-mono text-sm tabular-nums", tone(row.net))}>
                {money(row.net)} · {row.trades}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Spark({ series }: { series: ReturnType<typeof dailySeries> }) {
  if (series.every((p) => p.count === 0)) {
    return <p className="mt-3 text-xs text-subtle">No closed tickets this month yet.</p>;
  }
  const ys = series.map((p) => p.cum);
  const min = Math.min(0, ...ys);
  const max = Math.max(0, ...ys);
  const span = max - min || 1;
  const w = 320;
  const h = 80;
  const pts = series
    .map((p, i) => {
      const x = (i / Math.max(1, series.length - 1)) * w;
      const y = h - ((p.cum - min) / span) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-20 w-full text-accent" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts} />
    </svg>
  );
}
