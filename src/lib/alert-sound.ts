type AudioCtx = AudioContext;

let ctx: AudioCtx | null = null;

function audioContextCtor(): (new () => AudioCtx) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: new () => AudioCtx };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Must run inside a click (Watch). Safari/Brave will not play later without this. */
export function unlockAlertSound(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(c: AudioCtx, freq: number, start: number, dur: number, gain: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Two-note chime. Higher for a profit cross, lower for a give-back / loss. */
export function playAlertSound(worse: boolean): void {
  unlockAlertSound();
  if (!ctx) return;
  const t = ctx.currentTime;
  if (worse) {
    tone(ctx, 392, t, 0.16, 0.16);
    tone(ctx, 311, t + 0.14, 0.22, 0.16);
  } else {
    tone(ctx, 784, t, 0.12, 0.14);
    tone(ctx, 1046, t + 0.12, 0.16, 0.14);
  }
}

export function playWatchArmedSound(): void {
  unlockAlertSound();
  if (!ctx) return;
  tone(ctx, 660, ctx.currentTime, 0.1, 0.1);
}
