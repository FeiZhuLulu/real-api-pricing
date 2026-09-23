import palette from "../../config/channel-colors.json";

/** Channel colours shared with the Python charts (config/channel-colors.json). */
export const channelColors: Record<string, string> = palette.colors;
export const FALLBACK_COLOR = palette.fallback;
export const FRONTIER_COLOR = palette.frontier;

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (c: number[]) =>
  "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
/** Blend `a` towards `b` by `t` (0..1) in sRGB. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
/** WCAG relative luminance. */
export function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** Ink (near-black or white) with the higher WCAG contrast on `background`. */
export function readableInk(background: string): string {
  const l = luminance(background);
  return contrast(l, luminance("#16191d")) >= contrast(l, 1) ? "#16191d" : "#ffffff";
}

/**
 * Scatter dot fill + outline. Light mode outlines each dot in a darker shade
 * of its own hue so pale channels (StepFun, Cursor, the pastel tints) stay
 * legible on white; dark mode lifts the outline instead. Zhipu's black turns
 * to ink-white on a dark surface, its natural inverse.
 */
export function dotColors(color: string, dark: boolean) {
  const fill = dark && luminance(color) < 0.03 ? "#E6E8EB" : color;
  return {
    fill,
    stroke: dark ? mix(fill, "#ffffff", 0.35) : mix(fill, "#000000", luminance(fill) > 0.5 ? 0.38 : 0.24),
  };
}

export interface ChartColors {
  surface: string;
  ink: string;
  text: string;
  grid: string;
  gridMajor: string;
  axis: string;
  frontier: string;
  frontierLabel: string;
  labelBorder: string;
  labelHover: string;
  labelBg: string;
  leader: string;
  badgeBg: string;
  badgeStroke: string;
  fence: string;
  zoomFill: string;
  zoomStroke: string;
}
const LIGHT: ChartColors = {
  surface: "#ffffff",
  ink: "#16191d",
  text: "#5b636e",
  grid: "#eef0f3",
  gridMajor: "#dfe3e8",
  axis: "#c9ced6",
  frontier: FRONTIER_COLOR,
  frontierLabel: FRONTIER_COLOR,
  labelBorder: "#d9dee4",
  labelHover: "#8d96a1",
  labelBg: "rgba(255,255,255,0.95)",
  leader: "#a3abb5",
  badgeBg: "#ffffff",
  badgeStroke: FRONTIER_COLOR,
  fence: "#b8bfc8",
  zoomFill: "rgba(31,35,40,0.06)",
  zoomStroke: "#4b535d",
};
const DARK: ChartColors = {
  surface: "#15181c",
  ink: "#eceef1",
  text: "#a0a8b3",
  grid: "#22272d",
  gridMajor: "#2e343c",
  axis: "#3a414a",
  frontier: "#eceef1",
  frontierLabel: "#c3cad2",
  labelBorder: "#39404a",
  labelHover: "#7d8894",
  labelBg: "rgba(27,31,36,0.95)",
  leader: "#65707c",
  badgeBg: "#f1f2f4",
  badgeStroke: "#0d0f12",
  fence: "#4a525c",
  zoomFill: "rgba(236,238,241,0.07)",
  zoomStroke: "#c3cad2",
};
export const chartColors = (dark: boolean) => (dark ? DARK : LIGHT);
