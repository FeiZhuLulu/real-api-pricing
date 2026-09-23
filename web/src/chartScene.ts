import type { Group } from "./types";
import { ZERO_SLOT_RATIO } from "./domain";

/**
 * Visible data window. Prices are stored as log10 values: `xl` is the left
 * (expensive) edge and `xr` the right (cheap) edge, so `xl > xr` on the
 * reversed axis. Scores are linear, `yb` at the bottom and `yt` at the top.
 */
export interface View {
  xl: number;
  xr: number;
  yb: number;
  yt: number;
}
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}
export interface Tick {
  pos: number;
  label: string;
  major?: boolean;
}

export function makeBox(
  width: number,
  height: number,
  margin: { l: number; r: number; t: number; b: number },
): Box {
  const w = Math.max(40, width - margin.l - margin.r);
  const h = Math.max(40, height - margin.t - margin.b);
  return {
    left: margin.l,
    top: margin.t,
    right: margin.l + w,
    bottom: margin.t + h,
    width: w,
    height: h,
  };
}

/** Initial window: every plotted group with breathing room, top headroom for names. */
export function homeView(gs: Group[]): View {
  if (!gs.length) return { xl: 1, xr: -3, yb: 0, yt: 1 };
  const prices = gs.map((g) => Math.log10(g.plotPrice));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = Math.max((hi - lo) * 0.08, 0.2);
  const scores = gs.map((g) => g.score);
  const s0 = Math.min(...scores);
  const s1 = Math.max(...scores);
  const span = s1 - s0 || Math.max(Math.abs(s1) * 0.1, 1);
  return {
    xl: hi + pad,
    xr: lo - pad,
    yb: s0 - span * 0.08,
    yt: s1 + span * 0.14,
  };
}

export const xPixel = (v: View, b: Box, price: number) =>
  b.left + ((v.xl - Math.log10(price)) / (v.xl - v.xr)) * b.width;
export const yPixel = (v: View, b: Box, score: number) =>
  b.bottom - ((score - v.yb) / (v.yt - v.yb)) * b.height;
export const toPixel = (v: View, b: Box, price: number, score: number) => ({
  x: xPixel(v, b, price),
  y: yPixel(v, b, score),
});
export const inBox = (b: Box, x: number, y: number, pad = 0) =>
  x >= b.left - pad &&
  x <= b.right + pad &&
  y >= b.top - pad &&
  y <= b.bottom + pad;

/** Scale a [start, end] range about `fraction` of its length. */
export function scaleRange(
  range: [number, number],
  fraction: number,
  factor: number,
): [number, number] {
  const anchor = range[0] + (range[1] - range[0]) * fraction;
  return [
    anchor + (range[0] - anchor) * factor,
    anchor + (range[1] - anchor) * factor,
  ];
}

/** Zoom about a pixel, keeping the data under the pointer fixed. */
export function zoomAt(
  v: View,
  b: Box,
  x: number,
  y: number,
  factor: number,
): View {
  const fx = (x - b.left) / b.width;
  const fy = (b.bottom - y) / b.height;
  const [xl, xr] = scaleRange([v.xl, v.xr], fx, factor);
  const [yb, yt] = scaleRange([v.yb, v.yt], fy, factor);
  return { xl, xr, yb, yt };
}

/** Shift the window by a pixel drag: the data follows the pointer. */
export function panBy(v: View, b: Box, dx: number, dy: number): View {
  const sx = ((v.xl - v.xr) / b.width) * dx;
  const sy = ((v.yt - v.yb) / b.height) * dy;
  return { xl: v.xl + sx, xr: v.xr + sx, yb: v.yb + sy, yt: v.yt + sy };
}

/** Window covering a dragged pixel rectangle. */
export function boxToView(
  v: View,
  b: Box,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): View {
  const lx = (x: number) => v.xl - ((x - b.left) / b.width) * (v.xl - v.xr);
  const sy = (y: number) => v.yb + ((b.bottom - y) / b.height) * (v.yt - v.yb);
  return {
    xl: lx(Math.min(x0, x1)),
    xr: lx(Math.max(x0, x1)),
    yb: sy(Math.max(y0, y1)),
    yt: sy(Math.min(y0, y1)),
  };
}

/** "$0.0005", "$0.01", "$2": plain decimals, never exponent notation. */
export function formatTickPrice(value: number): string {
  if (value >= 1) return "$" + Number(value.toPrecision(3)).toLocaleString("en-US");
  const digits = Math.min(12, Math.max(0, -Math.floor(Math.log10(value)) + 2));
  return "$" + value.toFixed(digits).replace(/\.?0+$/, "");
}

const MANTISSAS = [[1], [1, 3], [1, 2, 5], [1, 2, 3, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9]];

/**
 * Log ticks for the visible window: the densest 1/2/5-style set that keeps
 * about `minGap` pixels between labels. When even whole decades are too
 * dense, every second (third…) decade is kept.
 */
export function priceTicks(
  v: View,
  b: Box,
  minGap = 62,
  cheapestShown = -Infinity,
): Tick[] {
  const lo = Math.min(v.xl, v.xr);
  const hi = Math.max(v.xl, v.xr);
  const perDecade = b.width / Math.max(hi - lo, 1e-9);
  const build = (m: number[], step = 1) => {
    const out: Tick[] = [];
    for (let d = Math.floor(lo) - 1; d <= Math.ceil(hi); d++) {
      if (m.length === 1 && d % step !== 0) continue;
      for (const k of m) {
        const value = k * 10 ** d;
        const lv = Math.log10(value);
        if (lv < lo || lv > hi || lv < cheapestShown) continue;
        out.push({
          pos: xPixel(v, b, value),
          label: formatTickPrice(value),
          major: k === 1,
        });
      }
    }
    return out.sort((a, c) => a.pos - c.pos);
  };
  let best = build([1]);
  for (const m of MANTISSAS) {
    const tight = Math.min(
      ...m.map((k, i) => Math.log10((m[i + 1] ?? 10) / k)),
    );
    if (tight * perDecade >= minGap) best = build(m);
  }
  if (perDecade < minGap) {
    const step = Math.ceil(minGap / perDecade);
    best = build([1], step);
  }
  return best;
}

export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(count, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export function scoreTicks(v: View, b: Box, lang = "en"): Tick[] {
  const count = Math.max(2, Math.round(b.height / 64));
  const step = niceStep(v.yt - v.yb, count);
  const fmt = new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: step < 1 ? 2 : 0,
  });
  const out: Tick[] = [];
  for (let s = Math.ceil(v.yb / step) * step; s <= v.yt + 1e-9; s += step)
    out.push({ pos: yPixel(v, b, s), label: fmt.format(Math.abs(s) < 1e-9 ? 0 : s) });
  return out;
}

/** The $0 slot's fence sits halfway (in log space) between the slot and the cheapest price. */
export const zeroFence = (zeroX: number) => zeroX * Math.sqrt(ZERO_SLOT_RATIO);

/** Nearest plotted group under a pixel, badges first. */
export function hitTest<T extends { x: number; y: number; r: number }>(
  items: T[],
  x: number,
  y: number,
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const it of items) {
    const d = Math.hypot(it.x - x, it.y - y);
    if (d > it.r) continue;
    // Normalise by radius so a badge wins over a dot it overlaps.
    const score = d / it.r;
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}
