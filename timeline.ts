/** Pure maths for the song timeline (seconds <-> steps). One step is a sixteenth note. */
export const stepSeconds = (bpm: number): number => 60 / Math.max(1, bpm) / 4;
export const stepsToSeconds = (steps: number, bpm: number): number => steps * stepSeconds(bpm);
/** The nearest step to a time, kept inside 0 .. total-1. */
export function secondsToStep(seconds: number, bpm: number, total: number): number {
  return Math.max(0, Math.min(Math.max(0, total - 1), Math.round(seconds / stepSeconds(bpm))));
}
/** m:ss (or m:ss.t with decimals). */
export function formatTime(seconds: number, decimals = 0): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const body = decimals > 0 ? rest.toFixed(decimals).padStart(3 + decimals, '0') : String(Math.floor(rest)).padStart(2, '0');
  return `${m}:${body}`;
}
const NICE = [1, 2, 5, 10, 15, 30, 60, 120, 300];
/** The smallest "round" number of seconds between ruler marks that still leaves `minPx` between them. */
export function tickEvery(totalSeconds: number, widthPx: number, minPx = 56): number {
  const perSecond = widthPx / Math.max(0.001, totalSeconds);
  return NICE.find(n => n * perSecond >= minPx) ?? NICE[NICE.length - 1];
}
/** Ruler marks (in seconds) from 0 up to the total. */
export function rulerMarks(totalSeconds: number, every: number): number[] {
  const out: number[] = [];
  for (let t = 0; t <= totalSeconds + 1e-9; t += every) out.push(Math.round(t * 1000) / 1000);
  return out;
}
/** Where the playhead is, in (fractional) steps: the last reported step plus the time that has passed since, never beyond the next step. */
export function positionSteps(songStep: number, msSinceReport: number, bpm: number): number {
  const frac = Math.max(0, Math.min(0.999, msSinceReport / 1000 / stepSeconds(bpm)));
  return songStep + frac;
}
