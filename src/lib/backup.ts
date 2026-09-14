import {
  cloneAlerts,
  DEFAULT_ALERTS,
  DEFAULT_COOLDOWN_MIN,
  clampCooldown,
  type AlertSettings,
  type Contract,
  type DeskKind,
} from "./book.ts";

export const BACKUP_VERSION = 1 as const;

export type DeskBackup = {
  v: typeof BACKUP_VERSION;
  savedAt: string;
  book: Contract[];
  alerts: Record<string, AlertSettings>;
  defaultRungs: AlertSettings;
  lastPct: Record<string, number | null>;
  desk: DeskKind;
  tastySecret: string;
  tastyToken: string;
  tastyAccount: string;
  ntfyTopic: string;
  watching: boolean;
  alertCooldownMin: number;
};

function isAlertSettings(x: unknown): x is AlertSettings {
  if (!x || typeof x !== "object") return false;
  const a = x as AlertSettings;
  return (
    typeof a.enabled === "boolean" &&
    Array.isArray(a.profit) &&
    Array.isArray(a.loss) &&
    a.profit.every((n) => typeof n === "number") &&
    a.loss.every((n) => typeof n === "number")
  );
}

function isContract(x: unknown): x is Contract {
  if (!x || typeof x !== "object") return false;
  const c = x as Contract;
  return (
    typeof c.key === "string" &&
    typeof c.und === "string" &&
    typeof c.exp === "string" &&
    typeof c.strike === "number" &&
    (c.right === "C" || c.right === "P") &&
    (c.side === "S" || c.side === "L") &&
    typeof c.qty === "number" &&
    typeof c.open === "number" &&
    typeof c.mark === "number"
  );
}

export function makeBackup(s: {
  book: Contract[];
  alerts: Record<string, AlertSettings>;
  defaultRungs: AlertSettings;
  lastPct: Record<string, number | null>;
  desk: DeskKind;
  tastySecret: string;
  tastyToken: string;
  tastyAccount: string;
  ntfyTopic: string;
  watching: boolean;
  alertCooldownMin?: number;
}): DeskBackup {
  return {
    v: BACKUP_VERSION,
    savedAt: new Date().toISOString(),
    book: s.book,
    alerts: s.alerts,
    defaultRungs: cloneAlerts(s.defaultRungs),
    lastPct: s.lastPct,
    desk: s.desk,
    tastySecret: s.tastySecret,
    tastyToken: s.tastyToken,
    tastyAccount: s.tastyAccount,
    ntfyTopic: s.ntfyTopic,
    watching: s.watching,
    alertCooldownMin: clampCooldown(s.alertCooldownMin ?? DEFAULT_COOLDOWN_MIN),
  };
}

export function parseBackup(raw: unknown): DeskBackup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== BACKUP_VERSION) return null;
  if (!Array.isArray(o.book) || !o.book.every(isContract)) return null;
  const alerts: Record<string, AlertSettings> = {};
  if (o.alerts && typeof o.alerts === "object") {
    for (const [k, v] of Object.entries(o.alerts as Record<string, unknown>)) {
      if (isAlertSettings(v)) alerts[k] = cloneAlerts(v);
    }
  }
  const defaultRungs = isAlertSettings(o.defaultRungs)
    ? cloneAlerts(o.defaultRungs)
    : cloneAlerts(DEFAULT_ALERTS);
  const lastPct: Record<string, number | null> = {};
  if (o.lastPct && typeof o.lastPct === "object") {
    for (const [k, v] of Object.entries(o.lastPct as Record<string, unknown>)) {
      if (v == null || typeof v === "number") lastPct[k] = v as number | null;
    }
  }
  const desk: DeskKind = o.desk === "zero" ? "zero" : "premium";
  return {
    v: BACKUP_VERSION,
    savedAt: typeof o.savedAt === "string" ? o.savedAt : new Date().toISOString(),
    book: o.book as Contract[],
    alerts,
    defaultRungs,
    lastPct,
    desk,
    tastySecret: typeof o.tastySecret === "string" ? o.tastySecret : "",
    tastyToken: typeof o.tastyToken === "string" ? o.tastyToken : "",
    tastyAccount: typeof o.tastyAccount === "string" ? o.tastyAccount : "",
    ntfyTopic: typeof o.ntfyTopic === "string" ? o.ntfyTopic : "",
    watching: o.watching === true,
    alertCooldownMin: clampCooldown(
      typeof o.alertCooldownMin === "number" ? o.alertCooldownMin : DEFAULT_COOLDOWN_MIN,
    ),
  };
}
