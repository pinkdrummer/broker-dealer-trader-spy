import { money, pctLabel } from "@/lib/book";
import { useBook } from "@/lib/store";
import { tone } from "@/components/contract-panel";
import { OwnerBadge, OwnerPicker } from "@/components/owner-badge";

export function ArchivePanel() {
  const trades = useBook((s) => s.trades);
  const closed = trades
    .filter((t) => t.status === "closed")
    .slice()
    .sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));
  const open = trades.filter((t) => t.status === "open");

  return (
    <div className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <p className="text-sm text-muted text-pretty">
        Closed tickets land here. A roll out or up keeps the same trade — notes stay with it.
        Open book still has {open.length} live ticket{open.length === 1 ? "" : "s"}.
      </p>
      {closed.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">
          Nothing archived yet. Close or roll off a line and it will show up here.
        </p>
      ) : (
        closed.map((t) => (
          <article key={t.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <OwnerBadge owner={t.owner} />
                  {t.label}
                </p>
                <p className="text-xs text-subtle">
                  {t.structure} · opened {t.openedAt.slice(0, 10)}
                  {t.closedAt ? ` · closed ${t.closedAt.slice(0, 10)}` : ""}
                </p>
              </div>
              <p className={cn("font-mono text-sm tabular-nums", tone(t.lastPl))}>
                {money(t.lastPl)} · {pctLabel(t.lastPct)}
              </p>
            </div>
            <div className="mt-3">
              <OwnerPicker
                value={t.owner}
                onChange={(id) => useBook.getState().setTradeOwner(t.id, id)}
              />
            </div>
            <textarea
              value={t.notes}
              onChange={(e) => useBook.getState().setTradeNote(t.id, e.target.value)}
              placeholder="What happened. Why you rolled. What you want next time."
              className="mt-3 min-h-20 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-fg placeholder:text-subtle"
            />
          </article>
        ))
      )}
    </div>
  );
}
