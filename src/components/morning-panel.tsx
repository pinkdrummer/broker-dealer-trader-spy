import { composeBrief } from "@/lib/brief";
import { DEMO_SNAPSHOT, DEFAULT_ACCOUNT_SETTINGS } from "@/lib/account";
import { DEMO_TAPE } from "@/lib/tape";
import { useBook } from "@/lib/store";
import { cn } from "@/lib/utils";

export function MorningPanel() {
  const book = useBook((s) => s.book);
  const snapshot = useBook((s) => s.snapshot) ?? DEMO_SNAPSHOT;
  const settings = useBook((s) => s.accountSettings);
  const trades = useBook((s) => s.trades);
  const tape = useBook((s) => s.tape);
  const brief = composeBrief({
    book,
    snapshot,
    settings: { ...DEFAULT_ACCOUNT_SETTINGS, ...settings },
    trades,
    tape: tape?.length ? tape : DEMO_TAPE,
  });

  return (
    <div className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-subtle">Morning desk</p>
        <h2 className="text-xl font-medium text-pretty">{brief.headline}</h2>
        <p className="font-mono text-xs text-subtle">{brief.asOfLabel} PT</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-subtle">Tape</h3>
        <p className="text-sm text-pretty leading-relaxed">{brief.market}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(tape?.length ? tape : DEMO_TAPE).map((q) => (
            <div key={q.symbol} className="rounded-md bg-elevated px-3 py-2">
              <p className="text-xs text-subtle">{q.name}</p>
              <p className="font-mono text-sm tabular-nums">
                {q.last >= 1000 ? q.last.toLocaleString("en-US", { maximumFractionDigits: 0 }) : q.last.toFixed(2)}
              </p>
              <p
                className={cn(
                  "font-mono text-xs tabular-nums",
                  (q.changePct ?? 0) > 0.05 ? "text-up" : (q.changePct ?? 0) < -0.05 ? "text-down" : "text-subtle",
                )}
              >
                {q.changePct == null
                  ? "—"
                  : `${q.changePct >= 0 ? "+" : "−"}${Math.abs(q.changePct).toFixed(2)}%`}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-subtle">Your book</h3>
        <p className="text-sm text-pretty leading-relaxed">{brief.book}</p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-subtle">Watch</h3>
        <ul className="flex flex-col gap-2">
          {brief.watch.map((line) => (
            <li key={line} className="text-sm text-pretty leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted text-pretty">{brief.window}</p>
      {book.length === 0 ? (
        <p className="text-xs text-subtle text-pretty">
          Sample tape until you pull tasty or load the sample book in Settings.
        </p>
      ) : null}
    </div>
  );
}
