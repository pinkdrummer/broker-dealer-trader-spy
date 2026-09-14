import { Bell, BellOff, Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  contractLabel,
  crossedRungs,
  fireKey,
  grouped,
  metrics,
  money,
  rungIsCooling,
  summarize,
  type DeskKind,
  type Filter,
} from "@/lib/book";
import { APP_NAME } from "@/lib/brand";
import { playAlertSound, playWatchArmedSound, unlockAlertSound } from "@/lib/alert-sound";
import { pushPhone } from "@/lib/notify";
import { resolveAlerts, useBook, visibleBook } from "@/lib/store";
import { fetchTastyBook } from "@/lib/tasty";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { AddForm, SettingsForm } from "@/components/desk-dialogs";
import { ContractEditor, ContractRow, MobileCard, tone } from "@/components/contract-panel";
import { cn } from "@/lib/utils";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "S", label: "Shorts" },
  { id: "L", label: "Longs" },
  { id: "neg", label: "Negative" },
  { id: "pos", label: "Positive" },
];

function fireAlert(msg: string, hit: string) {
  const worse = hit.startsWith("<");
  playAlertSound(worse);
  if (worse) toast.error(msg);
  else toast.success(msg);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(APP_NAME, { body: msg, silent: false });
  }
  const topic = useBook.getState().ntfyTopic.trim();
  if (!topic) return;
  void pushPhone({
    data: {
      topic,
      title: APP_NAME,
      message: msg,
      priority: worse ? 4 : 3,
    },
  }).catch(() => {
    /* phone push is best-effort */
  });
}

export function Desk() {
  const book = useBook((s) => s.book);
  const filter = useBook((s) => s.filter);
  const desk = useBook((s) => s.desk);
  const selectedKey = useBook((s) => s.selectedKey);
  const watching = useBook((s) => s.watching);
  const lastSync = useBook((s) => s.lastSync);
  const lastCheck = useBook((s) => s.lastCheck);
  const tastyConnected = useBook((s) => s.tastyConnected);
  const pullError = useBook((s) => s.pullError);
  const rows = useMemo(() => visibleBook(book, desk, filter), [book, desk, filter]);
  const groups = useMemo(() => grouped(rows), [rows]);
  const stats = useMemo(() => summarize(rows), [rows]);
  const selected = rows.find((r) => r.key === selectedKey) ?? book.find((r) => r.key === selectedKey);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    void useBook.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!watching) return;
    const arm = () => unlockAlertSound();
    window.addEventListener("pointerdown", arm);
    return () => window.removeEventListener("pointerdown", arm);
  }, [watching]);

  useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    let inflight = false;

    const check = () => {
      const { book: live, lastPct, markSeen, lastFired, alertCooldownMin, markFired } =
        useBook.getState();
      const now = Date.now();
      for (const c of live) {
        const st = resolveAlerts(c.key);
        const { pct, pl, vs } = metrics(c);
        const hits = crossedRungs(lastPct[c.key], pct, st);
        const isFirst = lastPct[c.key] == null;
        markSeen(c.key, pct);
        if (isFirst) continue;
        for (const hit of hits) {
          const key = fireKey(c.key, hit);
          if (rungIsCooling(lastFired?.[key], now, alertCooldownMin)) continue;
          markFired(key, now);
          fireAlert(`${contractLabel(c)}  ${hit} of ${vs}  P/L ${money(pl)}`, hit);
        }
      }
      useBook.getState().setLastCheck(new Date().toISOString());
    };

    const tick = async () => {
      if (inflight || cancelled) return;
      if (!useBook.persist.hasHydrated()) return;
      inflight = true;
      try {
        const { tastySecret, tastyToken, tastyAccount } = useBook.getState();
        if (tastySecret && tastyToken) {
          try {
            const res = await fetchTastyBook({
              data: { clientSecret: tastySecret, refreshToken: tastyToken, account: tastyAccount },
            });
            if (!cancelled) useBook.getState().applyTasty(res.rows);
          } catch (e) {
            if (!cancelled) {
              useBook.getState().setPullError(e instanceof Error ? e.message : "Pull failed");
            }
          }
        }
        if (!cancelled) check();
      } finally {
        inflight = false;
      }
    };

    void tick();
    const ms = desk === "zero" ? 15_000 : 30_000;
    const id = window.setInterval(() => void tick(), ms);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [watching, desk]);

  const sourceLine = tastyConnected && lastSync
    ? `Tasty  ·  ${new Date(lastSync).toLocaleTimeString()}`
    : "Sample book  ·  edit or connect Tasty";
  const watchLine = watching && lastCheck
    ? `Watching  ·  ${desk === "zero" ? "15s" : "30s"}  ·  ${new Date(lastCheck).toLocaleTimeString()}`
    : watching
      ? `Watching  ·  ${desk === "zero" ? "15s" : "30s"}`
      : sourceLine;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Desk</p>
            <h1 className="text-lg font-medium tracking-tight">{APP_NAME}</h1>
            <p className="truncate font-mono text-xs text-subtle">{watchLine}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add
            </Button>
            <WatchButton />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <Settings2 />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex gap-2 px-4 pt-3">
        {([
          ["premium", "Premium"],
          ["zero", "0DTE"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => useBook.getState().setDesk(id)}
            className={cn(
              "h-11 flex-1 rounded-full border px-4 text-sm md:flex-none",
              desk === id ? "border-accent bg-elevated text-fg" : "border-border text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <SummaryStrip stats={stats} desk={desk} />

      {pullError ? (
        <p className="px-4 pb-2 text-sm text-down">{pullError}</p>
      ) : null}

      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => useBook.getState().setFilter(f.id)}
            className={cn(
              "h-11 shrink-0 rounded-full border px-4 text-sm",
              filter === f.id
                ? f.id === "neg"
                  ? "border-down bg-down/10 text-down"
                  : f.id === "pos"
                    ? "border-up bg-up/10 text-up"
                    : "border-accent bg-elevated text-fg"
                : "border-border text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto px-4 pb-24 md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="pb-3 pr-3 font-medium"> </th>
                  <th className="pb-3 pr-3 font-medium">Contract</th>
                  <th className="pb-3 pr-3 text-right font-medium">Qty</th>
                  <th className="pb-3 pr-3 text-right font-medium">Mark</th>
                  <th className="pb-3 pr-3 text-right font-medium">Δ</th>
                  <th className="pb-3 pr-3 text-right font-medium">IVR</th>
                  <th className="pb-3 pr-3 text-right font-medium">%</th>
                  <th className="pb-3 pr-3 font-medium"> </th>
                  <th className="pb-3 pr-3 text-right font-medium">Next</th>
                  <th className="pb-3 font-medium">Alerts</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.und}>
                  <tr>
                    <td colSpan={10} className="pt-4 pb-1">
                      <div className="flex items-baseline gap-3">
                        <span className="text-sm font-medium tracking-tight">{g.und}</span>
                        <span className={cn("font-mono text-sm tabular-nums", tone(g.pl))}>
                          {money(g.pl)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {g.items.map((c) => (
                    <ContractRow
                      key={c.key}
                      c={c}
                      active={c.key === selectedKey}
                      onClick={() => useBook.getState().select(c.key)}
                    />
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <div className="flex flex-col gap-2 px-4 pb-24 md:hidden">
            {groups.map((g) => (
              <div key={g.und} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2 px-1 pt-2">
                  <span className="text-sm font-medium">{g.und}</span>
                  <span className={cn("font-mono text-sm tabular-nums", tone(g.pl))}>{money(g.pl)}</span>
                </div>
                {g.items.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => useBook.getState().select(c.key)}
                    className="rounded-lg border border-border bg-surface p-4 text-left"
                  >
                    <MobileCard c={c} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty desk={desk} onAdd={() => setAddOpen(true)} />
      )}

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) useBook.getState().select(null);
        }}
      >
        {selected ? <ContractEditor c={selected} /> : null}
      </Sheet>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        {settingsOpen ? <SettingsForm onClose={() => setSettingsOpen(false)} /> : null}
      </Dialog>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        {addOpen ? <AddForm desk={desk} onClose={() => setAddOpen(false)} /> : null}
      </Dialog>
    </div>
  );
}

function WatchButton() {
  const watching = useBook((s) => s.watching);
  return (
    <Button
      variant={watching ? "default" : "secondary"}
      size="sm"
      onClick={async () => {
        const next = !watching;
        if (next) {
          unlockAlertSound();
          playWatchArmedSound();
          if (typeof Notification !== "undefined" && Notification.permission === "default") {
            await Notification.requestPermission();
          }
        }
        useBook.getState().setWatching(next);
        toast(next ? "Watch on" : "Watch off");
      }}
    >
      {watching ? <Bell /> : <BellOff />}
      {watching ? "Watching" : "Watch"}
    </Button>
  );
}

function SummaryStrip({
  stats,
  desk,
}: {
  stats: ReturnType<typeof summarize>;
  desk: DeskKind;
}) {
  return (
    <section className="px-4 py-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-4">
        <Kpi label="Book P/L" value={money(stats.pl)} className={tone(stats.pl)} />
        <Kpi label={desk === "zero" ? "Credit" : "Credit out"} value={money(stats.credit)} />
        <Kpi
          label="Negative"
          value={String(stats.negative)}
          className={stats.negative ? "text-down" : undefined}
        />
        <Kpi
          label="Positive"
          value={String(stats.positive)}
          className={stats.positive ? "text-up" : undefined}
        />
      </div>
      {desk === "zero" ? (
        <p className="mt-2 text-xs text-subtle text-pretty">
          SPX credit spreads. Target: expire worthless. Morning window 9:30–11 ET.
        </p>
      ) : null}
    </section>
  );
}

function Kpi({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-md bg-elevated px-3 py-2">
      <p className="text-xs text-subtle">{label}</p>
      <p className={cn("font-mono text-lg tabular-nums", className)}>{value}</p>
    </div>
  );
}

function Empty({ desk, onAdd }: { desk: DeskKind; onAdd: () => void }) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-sm text-muted text-pretty">
        {desk === "zero"
          ? "No 0DTE contracts. Add an SPX leg, or pull from Tasty in Settings."
          : "No contracts on this book. Add one, or pull from Tasty in Settings."}
      </p>
      <Button className="mt-4" onClick={onAdd}>
        Add contract
      </Button>
    </div>
  );
}
