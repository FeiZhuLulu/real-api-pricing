/** Zoom in axis coordinates (log10 for a log axis), keeping the pointer fixed. */
export function wheelRange(range: number[], fraction: number, delta: number): [number, number] {
  const factor = Math.exp(Math.max(-0.12, Math.min(0.12, delta * 0.0015)));
  const anchor = range[0] + (range[1] - range[0]) * fraction;
  return [anchor + (range[0] - anchor) * factor, anchor + (range[1] - anchor) * factor];
}
