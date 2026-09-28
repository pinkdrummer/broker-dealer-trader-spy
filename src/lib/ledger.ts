export const LEDGER_CATEGORIES = [
  "software",
  "data",
  "education",
  "hardware",
  "meals",
  "travel",
  "office",
  "other",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];

export type LedgerEntry = {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  category: LedgerCategory;
  notes: string;
  thumb: string | null;
  loggedAt: string;
};

export type ReceiptParse = {
  merchant: string;
  amount: number | null;
  date: string | null;
  category: LedgerCategory;
  notes: string;
};

export function newLedgerId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthTotal(entries: LedgerEntry[], yyyyMm: string): number {
  return entries
    .filter((e) => monthKey(e.date || e.loggedAt) === yyyyMm)
    .reduce((n, e) => n + (Number.isFinite(e.amount) ? e.amount : 0), 0);
}

export function parseReceiptJson(raw: string): ReceiptParse {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    obj = {};
  }
  const cat = String(obj.category || "other").toLowerCase();
  const category = (LEDGER_CATEGORIES as readonly string[]).includes(cat)
    ? (cat as LedgerCategory)
    : "other";
  const amount = Number(obj.amount);
  return {
    merchant: String(obj.merchant || "").trim() || "Unknown",
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null,
    date: typeof obj.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : null,
    category,
    notes: String(obj.notes || "").trim(),
  };
}
