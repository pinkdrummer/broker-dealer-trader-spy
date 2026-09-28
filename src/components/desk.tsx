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
  type Filter,
} from "@/lib/book";
import { crossedZero, isItm, itmShouldFire, legIsManage } from "@/lib/alerts-extra";
import { optionPackages, packageMoneyLine } from "@/lib/packages";
import { zeroWindow } from "@/lib/session";
import { APP_NAME } from "@/lib/brand";
import { playAlertSound, playWatchArmedSound, unlockAlertSound, type AlertKind } from "@/lib/alert-sound";
import { pushPhone } from "@/lib/notify";
import { resolveAlerts, useBook, visibleBook } from "@/lib/store";
import { fetchTastyBook } from "@/lib/tasty";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { AddForm, SettingsForm } from "@/components/desk-dialogs";
import { ContractEditor, ContractRow, MobileCard, tone } from "@/components/contract-panel";
import { StatusPanel } from "@/components/status-panel";
import { cn } from "@/lib/utils";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "S", label: "Shorts" },
  { id: "L", label: "Longs" },
  { id: "neg", label: "Negative" },
  { id: "pos", label: "Positive" },
];

function fireAlert(msg: string, kind: AlertKind, title = APP_NAME) {
  playAlertSound(kind);
  if (kind === "profit" || kind === "breakeven") toast.success(msg);
  else toast.error(msg);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body: msg, silent: false });
  }
  const topic = useBook.getState().ntfyTopic.trim();
  if (!topic) return;
  const priority = kind === "manage" || kind === "itm" ? 5 : kind === "loss" ? 4 : 3;
  void pushPhone({
    data: {
      topic,
      title,
      message: msg,
      priority,
    },
  }).catch(() => {
    /* phone push is best-effort */
  });
}

function kindFromHit(hit: string): AlertKind {
  if (hit.includes("−") || hit.startsWith("<")) return "loss";
  return "profit";
}

export function Desk() {
  const book = useBook((s) => s.book);
  const filter = useBook((s) => s.filter);
  const desk = useBook((s) => s.desk);
  const bookKinds = useBook((s) => s.bookKinds);
  const selectedKey = useBook((s) => s.selectedKey);
  const watching = useBook((s) => s.watching);
  const lastSync = useBook((s) => s.lastSync);
  const lastCheck = useBook((s) => s.lastCheck);
  const tastyConnected = useBook((s) => s.tastyConnected);
  const pullError = useBook((s) => s.pullError);
  const tab = useBook((s) => s.tab);
  const rows = useMemo(() => visibleBook(book, bookKinds, filter), [book, bookKinds, filter]);
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
      const {
        book: live,
        lastPct,
        lastItm,
        markSeen,
        lastFired,
        alertCooldownMin,
        markFired,
        setItm,
      } = useBook.getState();
      const now = Date.now();
      const pkgs = optionPackages(live);

      for (const pkg of pkgs) {
        const st = resolveAlerts(pkg.id);
        const prev = lastPct[pkg.id];
        const hits = crossedRungs(prev, pkg.pct, st);
        const isFirst = prev == null;
        markSeen(pkg.id, pkg.pct);
        if (st.breakeven && !isFirst && crossedZero(prev, pkg.pct)) {
          const key = fireKey(pkg.id, "BE");
          if (!rungIsCooling(lastFired?.[key], now, alertCooldownMin)) {
            markFired(key, now);
            fireAlert(`${packageMoneyLine(pkg)}  breakeven`, "breakeven", "Breakeven");
          }
        }
        if (isFirst || !st.enabled) continue;
        for (const hit of hits) {
          const key = fireKey(pkg.id, hit);
          if (rungIsCooling(lastFired?.[key], now, alertCooldownMin)) continue;
          markFired(key, now);
          const kind = kindFromHit(hit);
          fireAlert(
            `${packageMoneyLine(pkg)}  ${hit}`,
            kind,
            kind === "profit" ? "Profit" : "Give-back",
          );
        }
      }

      for (const c of live) {
        if (c.kind === "share") continue;
        const st = resolveAlerts(c.key);
        const { pct, pl, vs } = metrics(c);
        const prev = lastPct[c.key];
        const isFirst = prev == null;
        markSeen(c.key, pct);

        if (st.itm) {
          const nowItm = isItm(c);
          const step = itmShouldFire(lastItm[c.key], nowItm);
          if (step.next != null) setItm(c.key, step.next);
          if (step.fire) {
            const key = fireKey(c.key, "ITM");
            if (!rungIsCooling(lastFired?.[key], now, alertCooldownMin)) {
              markFired(key, now);
              fireAlert(`${contractLabel(c)}  ITM`, "itm", "ITM");
            }
          }
        }

        if (st.legManage && !isFirst && legIsManage(c, pct)) {
          const key = fireKey(c.key, "LEG-100");
          if (!rungIsCooling(lastFired?.[key], now, alertCooldownMin)) {
            markFired(key, now);
            fireAlert(
              `${contractLabel(c)}  leg −100% of ${vs}  P/L ${money(pl)}`,
              "manage",
              "Manage · leg",
            );
          }
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
            if (!cancelled) useBook.getState().applyTasty(res.rows, res.snapshot);
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
    const ms = bookKinds.zero ? 15_000 : 30_000;
    const id = window.setInterval(() => void tick(), ms);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [watching, bookKinds.zero]);

  const sourceLine = tastyConnected && lastSync
    ? `Tasty  ·  ${new Date(lastSync).toLocaleTimeString()}`
    : "Sample book  ·  edit or connect Tasty";
  const watchLine = watching && lastCheck
    ? `Watching  ·  ${bookKinds.zero ? "15s" : "30s"}  ·  ${new Date(lastCheck).toLocaleTimeString()}`
    : watching
      ? `Watching  ·  ${bookKinds.zero ? "15s" : "30s"}`
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
        {(
          [
            ["status", "Account"],
            ["book", "Book"],
            ["archive", "Archive"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => useBook.getState().setTab(id)}
            className={cn(
              "h-11 flex-1 rounded-full border px-4 text-sm md:flex-none",
              tab === id ? "border-accent bg-elevated text-fg" : "border-border text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "status" ? <div className="pt-4"><StatusPanel /></div> : null}
      {tab === "archive" ? (
        <p className="px-4 py-16 text-center text-sm text-muted text-pretty">
          Archive is next. Closed trades and notes land here.
        </p>
      ) : null}
      {tab === "book" ? (
        <>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {(
          [
            ["options", "Options"],
            ["zero", "0DTE"],
            ["stocks", "Stocks"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => useBook.getState().toggleBookKind(id)}
            className={cn(
              "h-11 rounded-full border px-4 text-sm",
              bookKinds[id] ? "border-accent bg-elevated text-fg" : "border-border text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {bookKinds.zero ? <ZeroClock /> : null}

      <SummaryStrip stats={stats} zeroOn={bookKinds.zero} />

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
                  <th className="pb-3 font-medium">Shape</th>
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
        <Empty onAdd={() => setAddOpen(true)} />
      )}
        </>
      ) : null}

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

function ZeroClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const w = zeroWindow(now);
  return (
    <div className="px-4 pt-3">
      <div
        className={cn(
          "rounded-xl border px-4 py-3",
          w.state === "open"
            ? "border-up/40 bg-up/10"
            : w.state === "before"
              ? "border-accent/40 bg-elevated"
              : "border-border bg-surface",
        )}
      >
        <p className="text-xs uppercase tracking-widest text-subtle">0DTE window</p>
        <p className="text-sm font-medium">{w.label}</p>
        <p className="font-mono text-xs text-subtle">{w.detail}</p>
      </div>
    </div>
  );
}

function SummaryStrip({
  stats,
  zeroOn,
}: {
  stats: ReturnType<typeof summarize>;
  zeroOn: boolean;
}) {
  return (
    <section className="px-4 py-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-4">
        <Kpi label="Book P/L" value={money(stats.pl)} className={tone(stats.pl)} />
        <Kpi label="Credit out" value={money(stats.credit)} />
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
      {zeroOn ? (
        <p className="mt-2 text-xs text-subtle text-pretty">
          New 0DTE entries only 9:30–11:00 ET. Target: expire worthless.
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

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-sm text-muted text-pretty">
        Nothing on this filter. Flip Options / 0DTE / Stocks, add a line, or pull from Tasty in
        Settings.
      </p>
      <Button className="mt-4" onClick={onAdd}>
        Add contract
      </Button>
    </div>
  );
}
