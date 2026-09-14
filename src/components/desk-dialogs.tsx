import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  cloneAlerts,
  COOLDOWN_MINUTES,
  cooldownLabel,
  DEFAULT_ALERTS,
  LOSS_CHIPS,
  nyDate,
  PROFIT_CHIPS,
  type DeskKind,
  type Right,
  type Side,
  contractKey,
} from "@/lib/book";
import { APP_NAME } from "@/lib/brand";
import { makeBackup, parseBackup } from "@/lib/backup";
import { pushPhone, validNtfyTopic } from "@/lib/notify";
import { useBook } from "@/lib/store";
import { fetchTastyBook } from "@/lib/tasty";
import { ChipRow, CustomRung } from "@/components/contract-panel";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsForm({ onClose }: { onClose: () => void }) {
  const secret0 = useBook((s) => s.tastySecret);
  const token0 = useBook((s) => s.tastyToken);
  const account0 = useBook((s) => s.tastyAccount);
  const topic0 = useBook((s) => s.ntfyTopic);
  const defaultRungs = useBook((s) => s.defaultRungs);
  const cooldownMin = useBook((s) => s.alertCooldownMin);
  const cooldownIdx = Math.max(
    0,
    (COOLDOWN_MINUTES as readonly number[]).indexOf(cooldownMin),
  );
  const [secret, setSecret] = useState(secret0);
  const [token, setToken] = useState(token0);
  const [account, setAccount] = useState(account0);
  const [topic, setTopic] = useState(topic0);
  const [busy, setBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const chipsP = [...new Set([...PROFIT_CHIPS, ...defaultRungs.profit])].sort((a, b) => a - b);
  const chipsL = [...new Set([...LOSS_CHIPS, ...defaultRungs.loss])].sort((a, b) => a - b);

  return (
    <DialogContent title="Settings" className="max-h-[88vh] overflow-y-auto">
      <p className="mb-4 text-sm text-muted text-pretty">
        Shorts count as percent of credit collected. Longs count as percent of debit paid. Close
        shorts on the ask. Alerts never send orders — keep your Close-at-20% / 50% working orders
        in tastytrade.
      </p>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Default alerts</p>
      <p className="mb-3 text-sm text-muted text-pretty">
        New contracts and Reset rungs pick these up. Per-contract rungs stay as you set them.
      </p>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm">Alerts on by default</span>
        <Switch
          checked={defaultRungs.enabled}
          onCheckedChange={(on) =>
            useBook.getState().setDefaultRungs({ ...defaultRungs, enabled: on })
          }
        />
      </div>
      <p className="mb-2 text-xs uppercase tracking-wide text-subtle">Take profit</p>
      <ChipRow
        kind="profit"
        all={chipsP}
        on={defaultRungs.profit}
        toggle={(n) => {
          const profit = defaultRungs.profit.includes(n)
            ? defaultRungs.profit.filter((x) => x !== n)
            : [...defaultRungs.profit, n];
          useBook.getState().setDefaultRungs({ ...defaultRungs, profit });
        }}
      />
      <p className="mb-2 mt-5 text-xs uppercase tracking-wide text-subtle">Loss</p>
      <ChipRow
        kind="loss"
        all={chipsL}
        on={defaultRungs.loss}
        toggle={(n) => {
          const loss = defaultRungs.loss.includes(n)
            ? defaultRungs.loss.filter((x) => x !== n)
            : [...defaultRungs.loss, n];
          useBook.getState().setDefaultRungs({ ...defaultRungs, loss });
        }}
      />
      <CustomRung
        onAdd={(n) => {
          if (n > 0) {
            useBook.getState().setDefaultRungs({
              ...defaultRungs,
              profit: [...new Set([...defaultRungs.profit, n])],
            });
          } else {
            useBook.getState().setDefaultRungs({
              ...defaultRungs,
              loss: [...new Set([...defaultRungs.loss, Math.abs(n)])],
            });
          }
        }}
      />
      <Button
        variant="secondary"
        className="mt-4 mb-6 w-full"
        onClick={() => {
          useBook.getState().setDefaultRungs(cloneAlerts(DEFAULT_ALERTS));
          toast("Factory defaults restored");
        }}
      >
        Restore factory rungs
      </Button>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Alert buffer</p>
      <p className="mb-3 text-sm text-muted text-pretty">
        A given rung — like +20% or −50% — can only fire once in this window. Other rungs on the
        same contract still fire.
      </p>
      <input
        type="range"
        min={0}
        max={COOLDOWN_MINUTES.length - 1}
        step={1}
        value={cooldownIdx}
        aria-label="Alert buffer"
        aria-valuetext={cooldownLabel(cooldownMin)}
        onChange={(e) => {
          const next = COOLDOWN_MINUTES[Number(e.target.value)] ?? 15;
          useBook.getState().setAlertCooldownMin(next);
        }}
        className="mb-2 h-11 w-full accent-accent"
      />
      <p className="mb-6 font-mono text-sm tabular-nums text-fg">{cooldownLabel(cooldownMin)}</p>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Tastytrade</p>
      <p className="mb-4 text-sm text-muted text-pretty">
        Optional. Read-only grant from tastytrade → Manage → API. Keys stay in this browser. Each
        pull sends them through {APP_NAME} to tastytrade, then they are discarded.
      </p>
      <Label htmlFor="secret">Client secret</Label>
      <Input
        id="secret"
        type="password"
        autoComplete="off"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        className="mb-3"
      />
      <Label htmlFor="token">Refresh token</Label>
      <Input
        id="token"
        type="password"
        autoComplete="off"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="mb-3"
      />
      <Label htmlFor="acct">Account number (optional)</Label>
      <Input
        id="acct"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
        className="mb-4"
      />
      {err ? <p className="mb-3 text-sm text-down">{err}</p> : null}

      <div className="mb-6 flex flex-col gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            setErr("");
            setBusy(true);
            useBook.getState().setTastyCreds(secret, token, account);
            try {
              const res = await fetchTastyBook({
                data: { clientSecret: secret, refreshToken: token, account },
              });
              useBook.getState().applyTasty(res.rows);
              toast(`Loaded ${res.rows.length} contracts from ${res.account}`);
              onClose();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Could not reach tastytrade");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Pulling…" : "Pull positions"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            useBook.getState().loadDemo();
            toast("Sample book loaded");
            onClose();
          }}
        >
          Load sample book
        </Button>
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Phone</p>
      <p className="mb-4 text-sm text-muted text-pretty">
        Not SMS. Install ntfy on your phone, create a private topic, paste it here. With Watch on,
        rungs hit the lock screen. Topic is the password — use something long and unguessable.
      </p>
      <Label htmlFor="ntfy">ntfy topic</Label>
      <Input
        id="ntfy"
        value={topic}
        autoComplete="off"
        placeholder="premium-alerts-your-secret"
        onChange={(e) => setTopic(e.target.value)}
        className="mb-3"
      />
      <Button
        variant="secondary"
        disabled={phoneBusy}
        onClick={async () => {
          const t = topic.trim();
          if (!validNtfyTopic(t)) {
            toast("Topic needs 8–64 letters, numbers, dash or underscore.");
            return;
          }
          useBook.getState().setNtfyTopic(t);
          setPhoneBusy(true);
          try {
            await pushPhone({
              data: {
                topic: t,
                title: APP_NAME,
                message: "Test. If you see this on the phone, Watch will follow.",
                priority: 4,
              },
            });
            toast("Test sent to the phone");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Could not reach ntfy");
          } finally {
            setPhoneBusy(false);
          }
        }}
      >
        {phoneBusy ? "Sending…" : "Save topic and send test"}
      </Button>

      <p className="mt-6 mb-2 text-xs font-medium uppercase tracking-wide text-subtle">Backup</p>
      <p className="mb-4 text-sm text-muted text-pretty">
        Download a copy of this desk — book, rungs, Tasty keys, phone topic. Keep the file on this
        Mac. Restore it if the browser ever blanks.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const parsed = parseBackup(JSON.parse(await file.text()));
            if (!parsed) {
              toast("That file is not a Premium Alerts backup.");
              return;
            }
            useBook.getState().restoreBackup(parsed);
            toast(`Restored ${parsed.book.length} contracts`);
            onClose();
          } catch {
            toast("Could not read that file.");
          }
        }}
      />
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const json = JSON.stringify(makeBackup(useBook.getState()), null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const day = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `premium-alerts-${day}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast("Backup saved to Downloads");
          }}
        >
          Download backup
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          Restore backup
        </Button>
      </div>
    </DialogContent>
  );
}

export function AddForm({ onClose, desk }: { onClose: () => void; desk: DeskKind }) {
  const zero = desk === "zero";
  const [und, setUnd] = useState(zero ? "SPXW" : "");
  const [exp, setExp] = useState(zero ? nyDate() : "");
  const [strike, setStrike] = useState("");
  const [right, setRight] = useState<Right>(zero ? "P" : "C");
  const [side, setSide] = useState<Side>("S");
  const [qty, setQty] = useState("1");
  const [open, setOpen] = useState(zero ? "0.50" : "");
  const [mark, setMark] = useState(zero ? "0.50" : "");

  return (
    <DialogContent title="Add contract">
      <p className="mb-4 text-sm text-muted text-pretty">
        {zero
          ? "0DTE SPX leg. Each contract is its own line — add the long wing separately."
          : "One OCC contract per line. A strangle is two rows. A covered call is just the short call."}
      </p>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ticker" value={und} onChange={setUnd} placeholder="HOOD" />
          <Field label="Expiry" value={exp} onChange={setExp} placeholder="2026-10-16" />
        </div>
        <Field label="Strike" value={strike} onChange={setStrike} placeholder="130" />
        <div>
          <Label>Put / Call</Label>
          <div className="flex gap-2">
            {(["C", "P"] as const).map((r) => (
              <Button
                key={r}
                type="button"
                variant={right === r ? "default" : "secondary"}
                className="flex-1"
                onClick={() => setRight(r)}
              >
                {r === "C" ? "Call" : "Put"}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Side</Label>
          <div className="flex gap-2">
            {(["S", "L"] as const).map((r) => (
              <Button
                key={r}
                type="button"
                variant={side === r ? "default" : "secondary"}
                className="flex-1"
                onClick={() => setSide(r)}
              >
                {r === "S" ? "Short" : "Long"}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Qty" value={qty} onChange={setQty} />
          <Field
            label={side === "S" ? "Credit" : "Debit"}
            value={open}
            onChange={setOpen}
            placeholder="2.50"
          />
          <Field label="Mark" value={mark} onChange={setMark} placeholder="1.25" />
        </div>
      </div>
      <Button
        className="mt-5 w-full"
        onClick={() => {
          const s = Number(strike);
          const q = Number(qty);
          const o = Number(open);
          const m = Number(mark);
          if (!und.trim() || !exp || !s || !q || !o || m < 0) {
            toast("Fill ticker, expiry, strike, qty, and premium.");
            return;
          }
          const base = {
            und: und.trim().toUpperCase(),
            exp,
            strike: s,
            right,
          };
          useBook.getState().upsert({
            ...base,
            key: contractKey(base),
            side,
            qty: q,
            open: o * q * 100,
            mark: m,
            source: "manual",
            desk,
            ivr: null,
            delta: null,
          });
          toast("Contract added");
          onClose();
        }}
      >
        Save contract
      </Button>
    </DialogContent>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
