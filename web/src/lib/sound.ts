/** A soft "seal" cue — a low, brief filtered thunk synthesised on the fly. Muted by default;
 *  nothing is created or played until the visitor opts in via the sound toggle. */

let enabled = false;
let ctx: AudioContext | null = null;

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
  if (v && !ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
}

export function playSeal() {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.36);
}
