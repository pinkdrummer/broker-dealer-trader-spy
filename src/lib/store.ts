import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type AlertSettings,
  type Contract,
  type DeskKind,
  type Filter,
  classifyDesk,
  cloneAlerts,
  DEFAULT_ALERTS,
  DEFAULT_COOLDOWN_MIN,
  clampCooldown,
  metrics,
  fullDemo,
} from "./book";
import { type DeskBackup } from "./backup";
import {
  guardedStateStorage,
  openPersistWrites,
  PERSIST_KEY,
} from "./persist-storage";

type State = {
  book: Contract[];
  alerts: Record<string, AlertSettings>;
  defaultRungs: AlertSettings;
  lastPct: Record<string, number | null>;
  selectedKey: string | null;
  filter: Filter;
  desk: DeskKind;
  watching: boolean;
  lastCheck: string | null;
  pullError: string | null;
  tastySecret: string;
  tastyToken: string;
  tastyAccount: string;
  tastyConnected: boolean;
  lastSync: string | null;
  ntfyTopic: string;
  alertCooldownMin: number;
  lastFired: Record<string, number>;
  setFilter: (f: Filter) => void;
  setDesk: (d: DeskKind) => void;
  select: (key: string | null) => void;
  setWatching: (on: boolean) => void;
  setLastCheck: (iso: string | null) => void;
  setPullError: (msg: string | null) => void;
  upsert: (c: Contract) => void;
  remove: (key: string) => void;
  loadDemo: () => void;
  applyTasty: (rows: Contract[]) => void;
  setAlerts: (key: string, next: AlertSettings) => void;
  clearAlerts: (key: string) => void;
  setDefaultRungs: (next: AlertSettings) => void;
  setTastyCreds: (secret: string, token: string, account: string) => void;
  setTastyConnected: (on: boolean) => void;
  setNtfyTopic: (topic: string) => void;
  markSeen: (key: string, pct: number | null) => void;
  markFired: (key: string, at: number) => void;
  setAlertCooldownMin: (min: number) => void;
  restoreBackup: (b: DeskBackup) => void;
};

function withDesk(c: Contract): Contract {
  return {
    ...c,
    desk: c.desk ?? classifyDesk(c.und, c.exp),
    ivr: c.ivr ?? null,
    delta: c.delta ?? null,
  };
}

export const useBook = create<State>()(
  persist(
    (set) => ({
      book: [],
      alerts: {},
      defaultRungs: cloneAlerts(DEFAULT_ALERTS),
      lastPct: {},
      selectedKey: null,
      filter: "all",
      desk: "premium",
      watching: false,
      lastCheck: null,
      pullError: null,
      tastySecret: "",
      tastyToken: "",
      tastyAccount: "",
      tastyConnected: false,
      lastSync: null,
      ntfyTopic: "",
      alertCooldownMin: DEFAULT_COOLDOWN_MIN,
      lastFired: {},
      setFilter: (filter) => set({ filter }),
      setDesk: (desk) => set({ desk, selectedKey: null, filter: "all" }),
      select: (selectedKey) => set({ selectedKey }),
      setWatching: (watching) => set({ watching }),
      setLastCheck: (lastCheck) => set({ lastCheck }),
      setPullError: (pullError) => set({ pullError }),
      upsert: (c) =>
        set((s) => {
          const row = withDesk(c);
          const i = s.book.findIndex((x) => x.key === row.key);
          const book = i >= 0 ? s.book.map((x, idx) => (idx === i ? row : x)) : [...s.book, row];
          return { book };
        }),
      remove: (key) =>
        set((s) => ({
          book: s.book.filter((c) => c.key !== key),
          selectedKey: s.selectedKey === key ? null : s.selectedKey,
        })),
      loadDemo: () =>
        set({
          book: fullDemo(),
          tastyConnected: false,
          lastSync: null,
          pullError: null,
        }),
      applyTasty: (rows) =>
        set((s) => {
          if (rows.length === 0 && s.book.length > 0) {
            return {
              tastyConnected: true,
              lastSync: new Date().toISOString(),
              pullError: "Tasty returned no positions — left the current book in place.",
            };
          }
          const mapped = rows.map(withDesk);
          const tastyKeys = new Set(mapped.map((r) => r.key));
          const kept = s.book.filter((c) => c.source === "manual" && !tastyKeys.has(c.key));
          return {
            book: [...mapped, ...kept],
            tastyConnected: true,
            lastSync: new Date().toISOString(),
            pullError: null,
          };
        }),
      setAlerts: (key, next) => set((s) => ({ alerts: { ...s.alerts, [key]: next } })),
      clearAlerts: (key) =>
        set((s) => {
          const alerts = { ...s.alerts };
          delete alerts[key];
          return { alerts };
        }),
      setDefaultRungs: (defaultRungs) => set({ defaultRungs: cloneAlerts(defaultRungs) }),
      setTastyCreds: (tastySecret, tastyToken, tastyAccount) =>
        set({ tastySecret, tastyToken, tastyAccount }),
      setTastyConnected: (tastyConnected) => set({ tastyConnected }),
      setNtfyTopic: (ntfyTopic) => set({ ntfyTopic }),
      markSeen: (key, pct) =>
        set((s) => ({ lastPct: { ...s.lastPct, [key]: pct } })),
      markFired: (key, at) =>
        set((s) => ({ lastFired: { ...s.lastFired, [key]: at } })),
      setAlertCooldownMin: (min) => set({ alertCooldownMin: clampCooldown(min) }),
      restoreBackup: (b) =>
        set({
          book: b.book.map(withDesk),
          alerts: b.alerts,
          defaultRungs: cloneAlerts(b.defaultRungs),
          lastPct: b.lastPct,
          desk: b.desk,
          tastySecret: b.tastySecret,
          tastyToken: b.tastyToken,
          tastyAccount: b.tastyAccount,
          ntfyTopic: b.ntfyTopic,
          watching: b.watching,
          alertCooldownMin: clampCooldown(b.alertCooldownMin ?? DEFAULT_COOLDOWN_MIN),
          tastyConnected: Boolean(b.tastySecret && b.tastyToken),
          pullError: null,
          selectedKey: null,
        }),
    }),
    {
      name: PERSIST_KEY,
      skipHydration: true,
      storage: createJSONStorage(() => guardedStateStorage),
      partialize: (s) => ({
        book: s.book,
        alerts: s.alerts,
        defaultRungs: s.defaultRungs,
        lastPct: s.lastPct,
        filter: s.filter,
        desk: s.desk,
        watching: s.watching,
        tastySecret: s.tastySecret,
        tastyToken: s.tastyToken,
        tastyAccount: s.tastyAccount,
        tastyConnected: s.tastyConnected,
        lastSync: s.lastSync,
        ntfyTopic: s.ntfyTopic,
        alertCooldownMin: s.alertCooldownMin,
        lastFired: s.lastFired,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const p = persisted as Partial<State>;
        const book = (p.book ?? current.book).map(withDesk);
        const defaultRungs = migrateDefaultRungs(p.defaultRungs) ?? current.defaultRungs;
        const filter = migrateFilter(p.filter) ?? current.filter;
        const alerts = p.alerts ? migrateAlertMap(p.alerts) : current.alerts;
        const alertCooldownMin = clampCooldown(p.alertCooldownMin ?? current.alertCooldownMin);
        const lastFired =
          p.lastFired && typeof p.lastFired === "object" ? p.lastFired : current.lastFired;
        return { ...current, ...p, book, defaultRungs, filter, alerts, alertCooldownMin, lastFired };
      },
    },
  ),
);

useBook.persist.onFinishHydration(() => {
  openPersistWrites();
});

if (typeof window !== "undefined") {
  void useBook.persist.rehydrate();
}

export function resolveAlerts(key: string): AlertSettings {
  const s = useBook.getState();
  return s.alerts[key] ?? cloneAlerts(s.defaultRungs);
}

function sameRungs(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort((x, y) => x - y);
  const bs = [...b].sort((x, y) => x - y);
  return as.every((n, i) => n === bs[i]);
}

function migrateDefaultRungs(raw: unknown): AlertSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as AlertSettings;
  if (typeof r.enabled !== "boolean" || !Array.isArray(r.profit) || !Array.isArray(r.loss)) {
    return undefined;
  }
  const oldProfit = [20, 30, 40, 50];
  const oldLoss = [50, 100, 150, 200, 250, 300];
  if (sameRungs(r.profit, oldProfit) && sameRungs(r.loss, oldLoss)) {
    return cloneAlerts({ ...DEFAULT_ALERTS, enabled: r.enabled });
  }
  return cloneAlerts(r);
}

function migrateAlertMap(alerts: Record<string, AlertSettings>): Record<string, AlertSettings> {
  const out: Record<string, AlertSettings> = {};
  for (const [key, value] of Object.entries(alerts)) {
    out[key] = migrateDefaultRungs(value) ?? cloneAlerts(value);
  }
  return out;
}

function migrateFilter(raw: unknown): Filter | undefined {
  if (raw === "through") return "neg";
  if (raw === "target") return "pos";
  if (raw === "all" || raw === "S" || raw === "L" || raw === "neg" || raw === "pos") return raw;
  return undefined;
}

export function visibleBook(book: Contract[], desk: DeskKind, filter: Filter): Contract[] {
  let rows = book.filter((c) => (c.desk ?? "premium") === desk);
  if (filter === "S" || filter === "L") rows = rows.filter((c) => c.side === filter);
  if (filter === "neg") rows = rows.filter((c) => (metrics(c).pct ?? 0) < 0);
  if (filter === "pos") rows = rows.filter((c) => (metrics(c).pct ?? 0) >= 0);
  return [...rows].sort((a, b) => {
    const pa = metrics(a).pct ?? 0;
    const pb = metrics(b).pct ?? 0;
    return pa - pb;
  });
}
