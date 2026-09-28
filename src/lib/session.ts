/** SPX 0DTE entry window is 9:30–11:00 America/New_York on weekdays. */

export type ZeroWindowState = "weekend" | "before" | "open" | "closed";

export type ZeroWindow = {
  state: ZeroWindowState;
  label: string;
  detail: string;
};

function nyParts(now: Date): { weekday: number; minutes: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const week: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  return { weekday: week[map.weekday ?? "Mon"] ?? 1, minutes: hour * 60 + minute, hour, minute };
}

export function zeroWindow(now: Date = new Date()): ZeroWindow {
  const { weekday, minutes } = nyParts(now);
  if (weekday === 0 || weekday === 6) {
    return {
      state: "weekend",
      label: "Window closed",
      detail: "Next open Mon 9:30 ET",
    };
  }
  const open = 9 * 60 + 30;
  const close = 11 * 60;
  if (minutes < open) {
    const left = open - minutes;
    return {
      state: "before",
      label: "Window opens 9:30 ET",
      detail: left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left}m`,
    };
  }
  if (minutes < close) {
    const left = close - minutes;
    return {
      state: "open",
      label: "Window open",
      detail: `${left}m left · 9:30–11:00 ET`,
    };
  }
  return {
    state: "closed",
    label: "Window closed",
    detail: "11:00 ET passed · no new 0DTE",
  };
}
