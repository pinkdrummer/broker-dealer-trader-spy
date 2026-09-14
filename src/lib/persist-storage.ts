import type { StateStorage } from "zustand/middleware";

export const PERSIST_KEY = "premium-alerts-v1";
const LEGACY_KEYS = ["short-book-v2", "short-book-v1"];

let writesOpen = false;

export function openPersistWrites(): void {
  writesOpen = true;
}

export function persistWritesOpen(): boolean {
  return writesOpen;
}

/** True when a snapshot is the empty/demo factory, not a real desk. */
export function isBlankSnapshot(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> } & Record<string, unknown>;
    const s: Record<string, unknown> =
      parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
    const secret = typeof s.tastySecret === "string" ? s.tastySecret.trim() : "";
    const token = typeof s.tastyToken === "string" ? s.tastyToken.trim() : "";
    if (secret && token) return false;
    const book = Array.isArray(s.book) ? s.book : [];
    if (book.length === 0) return true;
    return book.every((row: unknown) => {
      if (!row || typeof row !== "object") return true;
      return (row as { source?: string }).source === "demo";
    });
  } catch {
    return true;
  }
}

function readLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLs(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Brave / private mode can throw */
  }
}

export const guardedStateStorage: StateStorage = {
  getItem: (name) => {
    const primary = readLs(name);
    if (primary && !isBlankSnapshot(primary)) return primary;
    const bak = readLs(`${name}.bak`);
    if (bak && !isBlankSnapshot(bak)) return bak;
    if (primary) return primary;
    for (const key of LEGACY_KEYS) {
      const legacy = readLs(key);
      if (legacy && !isBlankSnapshot(legacy)) return legacy;
    }
    return bak ?? null;
  },
  setItem: (name, value) => {
    if (!writesOpen) return;
    writeLs(name, value);
    if (!isBlankSnapshot(value)) writeLs(`${name}.bak`, value);
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
