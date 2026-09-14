import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  contractLabel,
  deltaLabel,
  formatExp,
  ivrLabel,
  LOSS_CHIPS,
  metrics,
  money,
  moneyMark,
  nextRung,
  nextTone,
  pctLabel,
  PROFIT_CHIPS,
  statusOf,
  strikeLabel,
  targetMark,
  tenorLabel,
  type AlertSettings,
  type Contract,
  type Side,
} from "@/lib/book";
import { useBook } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function tone(n: number | null | undefined) {
  if (n == null) return "text-muted";
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-muted";
}

export function nextClass(next: string | null) {
  const t = nextTone(next);
  if (t === "up") return "text-up";
  if (t === "down") return "text-down";
  return "text-fg";
}

function useResolvedAlerts(key: string): AlertSettings {
  const stored = useBook((s) => s.alerts[key]);
  const defaults = useBook((s) => s.defaultRungs);
  return stored ?? defaults;
}

export function SideMark({ side }: { side: Side }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-xs font-mono text-xs",
        side === "S" ? "bg-elevated text-muted" : "bg-elevated text-accent",
      )}
    >
      {side}
    </span>
  );
}

export function PctBar({ pct }: { pct: number | null }) {
  if (pct == null) return <div className="h-1.5 w-20 rounded-full bg-elevated" />;
  if (pct < 0) {
    const w = Math.min(100, (Math.abs(pct) / 600) * 100);
    return (
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-elevated" title={pctLabel(pct)}>
        <div className="h-full bg-down" style={{ width: `${w}%` }} />
      </div>
    );
  }
  const w = Math.min(100, pct);
  return (
    <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-elevated" title={pctLabel(pct)}>
      <div className="h-full bg-up" style={{ width: `${w}%` }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-fg/50" />
    </div>
  );
}

export function ContractRow({
  c,
  active,
  onClick,
}: {
  c: Contract;
  active: boolean;
  onClick: () => void;
}) {
  const { pct, pl } = metrics(c);
  const st = useResolvedAlerts(c.key);
  const next = nextRung(pct, st);
  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      className={cn(
        "cursor-pointer border-t border-border/80 hover:bg-elevated/60 focus-visible:bg-elevated focus-visible:outline-none",
        active && "bg-elevated",
      )}
    >
      <td className="py-3 pr-3">
        <SideMark side={c.side} />
      </td>
      <td className="py-3 pr-3">
        <p className="flex items-baseline gap-2 font-mono text-sm">
          <span>
            {formatExp(c.exp)} {strikeLabel(c)}
          </span>
          <span className={cn("tabular-nums", tone(pl))}>{money(pl)}</span>
        </p>
        <p className="text-xs text-subtle">{tenorLabel(c.exp)}</p>
      </td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums">{c.qty}</td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums">{moneyMark(c.mark)}</td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums text-fg">{deltaLabel(c.delta)}</td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums text-fg">{ivrLabel(c.ivr)}</td>
      <td className={cn("py-3 pr-3 text-right font-mono tabular-nums", tone(pct))}>{pctLabel(pct)}</td>
      <td className="py-3 pr-3">
        <PctBar pct={pct} />
      </td>
      <td className={cn("py-3 pr-3 text-right font-mono text-sm font-medium tabular-nums", nextClass(next))}>
        {next ?? "—"}
      </td>
      <td className="py-3 text-xs text-muted">{st.enabled ? "On" : "Off"}</td>
    </tr>
  );
}

export function MobileCard({ c }: { c: Contract }) {
  const { pct, pl } = metrics(c);
  const st = useResolvedAlerts(c.key);
  const next = nextRung(pct, st);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SideMark side={c.side} />
            <span className="font-mono text-sm">{contractLabel(c)}</span>
            <span className={cn("font-mono text-sm tabular-nums", tone(pl))}>{money(pl)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Qty {c.qty} · Δ {deltaLabel(c.delta)} · IVR {ivrLabel(c.ivr)} · {tenorLabel(c.exp)}
          </p>
        </div>
        <p className={cn("shrink-0 font-mono text-base tabular-nums", tone(pct))}>{pctLabel(pct)}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <PctBar pct={pct} />
        <p className={cn("font-mono text-sm font-medium tabular-nums", nextClass(next))}>
          {next ? `next ${next}` : statusOf(pct)}
        </p>
      </div>
    </div>
  );
}

export function ContractEditor({ c }: { c: Contract }) {
  const st = useResolvedAlerts(c.key);
  const { pct, pl, vs, openPerShare } = metrics(c);
  const [mark, setMark] = useState(String(c.mark));
  const chipsP = [...new Set([...PROFIT_CHIPS, ...st.profit])].sort((a, b) => a - b);
  const chipsL = [...new Set([...LOSS_CHIPS, ...st.loss])].sort((a, b) => a - b);

  useEffect(() => {
    setMark(String(c.mark));
  }, [c.key, c.mark]);

  function save(next: AlertSettings) {
    useBook.getState().setAlerts(c.key, next);
  }

  return (
    <SheetContent
      title={contractLabel(c)}
      subtitle={`${c.side === "S" ? "Short · % of credit" : "Long · % of debit"} · ${c.qty} ct · ${vs} ${money(c.open)} · ${tenorLabel(c.exp)}`}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-border bg-elevated p-4">
        <Stat label="%" value={pctLabel(pct)} className={tone(pct)} />
        <Stat label="P/L" value={money(pl)} className={tone(pl)} />
        <Stat label="Delta" value={deltaLabel(c.delta)} />
        <Stat label="IVR" value={ivrLabel(c.ivr)} />
        <Stat label="Open / share" value={moneyMark(openPerShare)} />
        <Stat label="50% mark" value={moneyMark(targetMark(c, 50))} />
      </div>

      <p className="mb-4 text-xs text-muted text-pretty">
        {c.side === "S"
          ? `50% of credit is a mark of ${moneyMark(targetMark(c, 50))}.`
          : `50% of debit is a mark of ${moneyMark(targetMark(c, 50))}.`}
      </p>

      <Label htmlFor="mark">Mark (per share)</Label>
      <div className="mb-5 flex gap-2">
        <Input
          id="mark"
          inputMode="decimal"
          value={mark}
          onChange={(e) => setMark(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={() => {
            const n = Number(mark);
            if (!Number.isFinite(n) || n < 0) return;
            useBook.getState().upsert({
              ...c,
              mark: n,
              source: c.source === "tasty" ? "tasty" : "manual",
            });
            toast("Mark updated");
          }}
        >
          Save
        </Button>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="text-sm">Alerts for this contract</span>
        <Switch checked={st.enabled} onCheckedChange={(on) => save({ ...st, enabled: on })} />
      </div>

      <p className="mb-2 text-xs uppercase tracking-wide text-subtle">Take profit</p>
      <ChipRow
        kind="profit"
        all={chipsP}
        on={st.profit}
        toggle={(n) => {
          const profit = st.profit.includes(n) ? st.profit.filter((x) => x !== n) : [...st.profit, n];
          save({ ...st, profit });
        }}
      />

      <p className="mb-2 mt-5 text-xs uppercase tracking-wide text-subtle">Loss</p>
      <ChipRow
        kind="loss"
        all={chipsL}
        on={st.loss}
        toggle={(n) => {
          const loss = st.loss.includes(n) ? st.loss.filter((x) => x !== n) : [...st.loss, n];
          save({ ...st, loss });
        }}
      />

      <CustomRung
        onAdd={(n) => {
          if (n > 0) save({ ...st, profit: [...new Set([...st.profit, n])] });
          else save({ ...st, loss: [...new Set([...st.loss, Math.abs(n)])] });
        }}
      />

      <div className="mt-6 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            useBook.getState().clearAlerts(c.key);
            toast("Rungs reset to settings defaults");
          }}
        >
          Reset rungs
        </Button>
        {c.source !== "tasty" ? (
          <Button variant="danger" className="flex-1" onClick={() => useBook.getState().remove(c.key)}>
            Remove
          </Button>
        ) : null}
      </div>
    </SheetContent>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className={cn("font-mono text-xl tabular-nums", className)}>{value}</p>
    </div>
  );
}

export function ChipRow({
  kind,
  all,
  on,
  toggle,
}: {
  kind: "profit" | "loss";
  all: number[];
  on: number[];
  toggle: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((n) => {
        const active = on.includes(n);
        return (
          <button
            key={`${kind}-${n}`}
            type="button"
            onClick={() => toggle(n)}
            className={cn(
              "h-11 rounded-full border px-3 font-mono text-xs",
              active
                ? kind === "profit"
                  ? "border-up/50 bg-up/15 text-up"
                  : "border-down/50 bg-down/15 text-down"
                : "border-border text-muted",
            )}
          >
            {kind === "loss" ? "−" : "+"}
            {n}%
          </button>
        );
      })}
    </div>
  );
}

export function CustomRung({ onAdd }: { onAdd: (n: number) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-5">
      <Label htmlFor="custom">Custom % (positive profit, negative loss)</Label>
      <div className="flex gap-2">
        <Input id="custom" value={v} onChange={(e) => setV(e.target.value)} placeholder="35 or -250" />
        <Button
          variant="secondary"
          onClick={() => {
            const n = Number(v);
            if (!n) return;
            onAdd(n);
            setV("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
