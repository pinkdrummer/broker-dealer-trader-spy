import { useState } from "react";
import { toast } from "sonner";
import { parseReceipt } from "@/lib/parse-receipt";
import {
  LEDGER_CATEGORIES,
  monthKey,
  monthTotal,
  newLedgerId,
  type LedgerCategory,
  type LedgerEntry,
} from "@/lib/ledger";
import { money } from "@/lib/book";
import { useBook } from "@/lib/store";
import { Input } from "@/components/ui/input";

async function shrinkImage(file: File, max = 1200): Promise<{ send: string; thumb: string }> {
  const raw = await file.arrayBuffer();
  const blob = new Blob([raw], { type: file.type || "image/jpeg" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not open that photo"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.drawImage(img, 0, 0, w, h);
    const send = canvas.toDataURL("image/jpeg", 0.72);
    const tw = Math.max(1, Math.round(w * (240 / w)));
    const th = Math.max(1, Math.round(h * (240 / w)));
    const t = document.createElement("canvas");
    t.width = tw;
    t.height = th;
    t.getContext("2d")?.drawImage(img, 0, 0, tw, th);
    const thumb = t.toDataURL("image/jpeg", 0.6);
    return { send, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LedgerPanel() {
  const receipts = useBook((s) => s.receipts);
  const [busy, setBusy] = useState(false);
  const nowMonth = monthKey(new Date().toISOString());
  const total = monthTotal(receipts, nowMonth);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const { send, thumb } = await shrinkImage(file);
      const res = await parseReceipt({ data: { image: send } });
      if (!res.ok) {
        toast(res.error);
        useBook.getState().addReceipt({
          id: newLedgerId(),
          merchant: file.name.replace(/\.[^.]+$/, ""),
          amount: 0,
          date: new Date().toISOString().slice(0, 10),
          category: "other",
          notes: "Read failed — fill this in.",
          thumb,
          loggedAt: new Date().toISOString(),
        });
        return;
      }
      const row: LedgerEntry = {
        id: newLedgerId(),
        merchant: res.parse.merchant,
        amount: res.parse.amount ?? 0,
        date: res.parse.date || new Date().toISOString().slice(0, 10),
        category: res.parse.category,
        notes: res.parse.notes,
        thumb,
        loggedAt: new Date().toISOString(),
      };
      useBook.getState().addReceipt(row);
      toast(`Logged ${row.merchant}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log that photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle">Books</p>
          <h2 className="text-xl font-medium">Receipts</h2>
          <p className="text-sm text-muted text-pretty">
            Snap a slip. It reads merchant, total, and date, then sits in this month’s log.
          </p>
        </div>
        <p className="font-mono text-sm tabular-nums">{money(total)} this month</p>
      </div>

      <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface text-sm text-muted">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            void onFile(f);
            e.target.value = "";
          }}
        />
        {busy ? "Reading the slip…" : "Drop a photo or tap to shoot"}
      </label>

      {receipts.length === 0 ? (
        <p className="py-8 text-center text-sm text-subtle">Nothing logged yet.</p>
      ) : (
        receipts.map((r) => <ReceiptCard key={r.id} row={r} />)
      )}
    </div>
  );
}

function ReceiptCard({ row }: { row: LedgerEntry }) {
  return (
    <article className="flex gap-3 rounded-xl border border-border bg-surface p-3">
      {row.thumb ? (
        <img src={row.thumb} alt="" className="size-16 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="size-16 shrink-0 rounded-md bg-elevated" />
      )}
      <div className="min-w-0 flex-1">
        <Input
          value={row.merchant}
          onChange={(e) => useBook.getState().updateReceipt(row.id, { merchant: e.target.value })}
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Input
            inputMode="decimal"
            value={String(row.amount || "")}
            onChange={(e) => useBook.getState().updateReceipt(row.id, { amount: Number(e.target.value) || 0 })}
          />
          <Input
            type="date"
            value={row.date}
            onChange={(e) => useBook.getState().updateReceipt(row.id, { date: e.target.value })}
          />
          <select
            value={row.category}
            onChange={(e) =>
              useBook.getState().updateReceipt(row.id, { category: e.target.value as LedgerCategory })
            }
            className="h-11 rounded-md border border-border bg-elevated px-2 text-sm"
          >
            {LEDGER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Input
          className="mt-2"
          value={row.notes}
          placeholder="Note"
          onChange={(e) => useBook.getState().updateReceipt(row.id, { notes: e.target.value })}
        />
        <button
          type="button"
          className="mt-2 text-xs text-subtle"
          onClick={() => useBook.getState().removeReceipt(row.id)}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
