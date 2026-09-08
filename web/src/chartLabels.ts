import type { Annotations, Image } from "plotly.js";
import type { Group } from "./types";
import { manufacturer } from "./domain";
import { providerLogoUrl } from "./ProviderLogo";

export type LabelMode = "frontier" | "all" | "none";

export const LOGO_SIZE = 28;

export interface ArenaPlacement {
  key: string;
  price: number;
  score: number;
  label: string;
  provider: string;
  ax: number;
  ay: number;
}

export interface FrontierLogoView {
  key: string;
  price: number;
  score: number;
  provider: string;
  label: string;
  x: number;
  y: number;
  logoUrl?: string;
  inPlot: boolean;
}

export interface TextLabelView extends ArenaPlacement {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  inPlot: boolean;
}

const logoDataCache = new Map<string, Promise<string>>();

/** Bottom cards: all points when labels=all, otherwise frontier (incl. none). */
export function cardGroups(
  gs: Group[],
  front: Group[],
  mode: LabelMode,
): Group[] {
  if (mode === "all") return gs;
  return front;
}

/** In-chart text names only — never includes logos. */
export function textLabelGroups(
  gs: Group[],
  front: Group[],
  mode: LabelMode,
): Group[] {
  if (mode === "none") return [];
  if (mode === "frontier") return front;
  return densify(gs, front);
}

export function modelLabel(g: Group): string {
  return [...new Set(g.rows.map((r) => r.point.model_display))].join(" / ");
}

export function labelProvider(g: Group): string {
  return manufacturer(g.rows[0].point.vendor);
}

function densify(gs: Group[], front: Group[], cap = 28): Group[] {
  if (!gs.length) return [];
  const selected: Group[] = [];
  const seen = new Set<string>();
  const take = (g: Group) => {
    if (seen.has(g.key)) return;
    seen.add(g.key);
    selected.push(g);
  };
  for (const g of front) take(g);
  const scores = gs.map((g) => g.score);
  const s0 = Math.min(...scores);
  const s1 = Math.max(...scores);
  const span = Math.max(s1 - s0, 1e-6);
  const rest = gs
    .filter((g) => !seen.has(g.key))
    .sort((a, b) => b.score - a.score || a.price - b.price);
  for (const g of rest) {
    if (selected.length >= cap) break;
    const far = selected.every((s) => {
      const dLog = Math.abs(Math.log10(g.price) - Math.log10(s.price));
      const dScore = Math.abs(g.score - s.score) / span;
      return dLog >= 0.2 || dScore >= 0.05;
    });
    if (far) take(g);
  }
  return selected;
}

const SLOT_BASE = [
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
  [1.35, 0.1],
  [-1.35, 0.1],
  [0.55, -1.55],
  [-0.55, -1.55],
  [0.55, 1.55],
  [-0.55, 1.55],
  [1.6, -0.75],
  [-1.6, -0.75],
  [1.6, 0.75],
  [-1.6, 0.75],
] as const;

function estimateLabelSize(label: string, mobile: boolean) {
  const font = mobile ? 10 : 11;
  const padX = 14;
  const padY = 8;
  const width = Math.min(
    mobile ? 168 : 220,
    Math.ceil(label.length * font * 0.62) + padX,
  );
  const height = font + padY;
  return { width, height };
}

export type PlotBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type PlotAxis = {
  _offset: number;
  _length?: number;
  d2l: (v: number) => number;
  l2p: (v: number) => number;
  range?: number[];
};

export type PlotLayout = {
  width: number;
  height: number;
  _size?: { l: number; r: number; t: number; b: number; w: number; h: number };
  xaxis?: PlotAxis;
  yaxis?: PlotAxis;
};

export function plotBox(layout: PlotLayout): PlotBox | null {
  const size = layout._size;
  if (size && size.w > 0 && size.h > 0) {
    return {
      left: size.l,
      right: size.l + size.w,
      top: size.t,
      bottom: size.t + size.h,
      width: size.w,
      height: size.h,
    };
  }
  const xa = layout.xaxis;
  const ya = layout.yaxis;
  if (!xa || !ya || xa._length == null || ya._length == null) return null;
  return {
    left: xa._offset,
    right: xa._offset + xa._length,
    top: ya._offset,
    bottom: ya._offset + ya._length,
    width: xa._length,
    height: ya._length,
  };
}

export function dataToPixel(
  layout: PlotLayout,
  price: number,
  score: number,
): { x: number; y: number } | null {
  const xa = layout.xaxis;
  const ya = layout.yaxis;
  if (!xa?.l2p || !ya?.l2p || !xa.d2l || !ya.d2l) return null;
  return {
    x: xa._offset + xa.l2p(xa.d2l(price)),
    y: ya._offset + ya.l2p(ya.d2l(score)),
  };
}

function inPlotBox(
  x: number,
  y: number,
  box: PlotBox,
  pad: number,
): boolean {
  return (
    x >= box.left - pad &&
    x <= box.right + pad &&
    y >= box.top - pad &&
    y <= box.bottom + pad
  );
}

/** Pixel-centered frontier logos; hide when outside the plot box. */
export function frontierLogoViews(
  front: Group[],
  layout: PlotLayout,
  logos: Map<string, string>,
): FrontierLogoView[] {
  const box = plotBox(layout);
  if (!box) return [];
  const half = LOGO_SIZE / 2;
  const out: FrontierLogoView[] = [];
  for (const g of front) {
    const pt = dataToPixel(layout, g.price, g.score);
    if (!pt) continue;
    out.push({
      key: g.key,
      price: g.price,
      score: g.score,
      provider: labelProvider(g),
      label: modelLabel(g),
      x: pt.x,
      y: pt.y,
      logoUrl: logos.get(labelProvider(g)),
      inPlot: inPlotBox(pt.x, pt.y, box, -half),
    });
  }
  return out;
}

/**
 * Place text-only labels using real pixel anchors and plot size.
 * Leader (ax, ay) is from the data/logo pixel to the label anchor.
 */
export function placeTextLabels(
  groups: Group[],
  anchors: Map<string, { x: number; y: number }>,
  box: PlotBox,
  mobile: boolean,
): ArenaPlacement[] {
  if (!groups.length) return [];
  const base = mobile ? 44 : 58;
  const vy = mobile ? 30 : 34;
  const options = SLOT_BASE.map(([sx, sy]) => ({
    ax: Math.round(sx * base),
    ay: Math.round(sy * vy),
  }));
  const ordered = [...groups].sort(
    (a, b) => a.score - b.score || a.price - b.price,
  );
  const placed: {
    key: string;
    ax: number;
    ay: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const g = ordered[i]!;
    const anchor = anchors.get(g.key);
    if (!anchor) continue;
    const size = estimateLabelSize(modelLabel(g), mobile);
    let best = options[i % options.length]!;
    let bestPen = Infinity;
    for (let si = 0; si < options.length; si++) {
      const slot = options[si]!;
      // Label box anchored near the leader tail; left-side labels extend left.
      const tailX = anchor.x + slot.ax;
      const tailY = anchor.y + slot.ay;
      const left =
        slot.ax >= 0 ? tailX - 4 : tailX - size.width + 4;
      const top = tailY - size.height / 2;
      const right = left + size.width;
      const bottom = top + size.height;
      let pen = si === i % options.length ? 0 : 0.25;
      if (left < box.left + 2) pen += (box.left + 2 - left) * 0.08;
      if (right > box.right - 2) pen += (right - (box.right - 2)) * 0.08;
      if (top < box.top + 2) pen += (box.top + 2 - top) * 0.08;
      if (bottom > box.bottom - 2) pen += (bottom - (box.bottom - 2)) * 0.08;
      if (left < box.left - 8 || right > box.right + 8) pen += 20;
      if (top < box.top - 8 || bottom > box.bottom + 8) pen += 20;
      for (const p of placed) {
        const ox = Math.min(right, p.right) - Math.max(left, p.left);
        const oy = Math.min(bottom, p.bottom) - Math.max(top, p.top);
        if (ox > 0 && oy > 0) pen += 14 + ox * 0.05 + oy * 0.05;
      }
      // Keep names clear of every logo, including neighbouring frontier points.
      const logoPad = LOGO_SIZE / 2 + 4;
      for (const other of anchors.values()) {
        if (
          right > other.x - logoPad && left < other.x + logoPad &&
          bottom > other.y - logoPad && top < other.y + logoPad
        ) pen += 40;
      }
      if (pen < bestPen) {
        bestPen = pen;
        best = slot;
      }
    }
    const tailX = anchor.x + best.ax;
    const tailY = anchor.y + best.ay;
    const left = best.ax >= 0 ? tailX - 4 : tailX - size.width + 4;
    const top = tailY - size.height / 2;
    placed.push({
      key: g.key,
      ax: best.ax,
      ay: best.ay,
      left,
      top,
      right: left + size.width,
      bottom: top + size.height,
    });
  }

  const byKey = new Map(placed.map((p) => [p.key, p]));
  return groups.flatMap((g) => {
    const p = byKey.get(g.key);
    if (!p) return [];
    return [
      {
        key: g.key,
        price: g.price,
        score: g.score,
        label: modelLabel(g),
        provider: labelProvider(g),
        ax: p.ax,
        ay: p.ay,
      },
    ];
  });
}

export function textLabelViews(
  placements: ArenaPlacement[],
  layout: PlotLayout,
): TextLabelView[] {
  const box = plotBox(layout);
  if (!box) return [];
  const out: TextLabelView[] = [];
  for (const p of placements) {
    const pt = dataToPixel(layout, p.price, p.score);
    if (!pt) continue;
    const x1 = pt.x + p.ax;
    const y1 = pt.y + p.ay;
    const size = estimateLabelSize(p.label, box.width < 420);
    const left = p.ax >= 0 ? x1 - 4 : x1 - size.width + 4;
    const top = y1 - size.height / 2;
    const visible =
      inPlotBox(pt.x, pt.y, box, -LOGO_SIZE / 2) &&
      left < box.right &&
      left + size.width > box.left &&
      top < box.bottom &&
      top + size.height > box.top;
    out.push({
      ...p,
      x0: pt.x,
      y0: pt.y,
      x1,
      y1,
      inPlot: visible,
    });
  }
  return out;
}

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const hit = logoDataCache.get(url);
  if (hit) return hit;
  const job = fetch(url)
    .then(async (res) => {
      if (!res.ok) return url;
      const ctype = res.headers.get("content-type") ?? "";
      if (ctype.includes("svg") || url.includes(".svg")) {
        const text = await res.text();
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      }
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => url);
  logoDataCache.set(url, job);
  return job;
}

export async function resolveLogoDataUrl(
  provider: string,
): Promise<string | undefined> {
  const url = providerLogoUrl(provider);
  if (!url) return undefined;
  return toDataUrl(url);
}

export async function logoUrlMap(
  providers: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    [...new Set(providers)].map(async (provider) => {
      const src = await resolveLogoDataUrl(provider);
      if (src) map.set(provider, src);
    }),
  );
  return map;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

/**
 * Build export images/annotations from a finished export plot's fullLayout.
 * Paper coords are plot-area normalized (fx, fy); logo size is 28/plotW × 28/plotH.
 */
export function buildExportDecorationsFromLayout(
  front: Group[],
  textPlacements: ArenaPlacement[],
  logos: Map<string, string>,
  layout: PlotLayout,
  mobile: boolean,
): {
  annotations: Partial<Annotations>[];
  images: Array<Partial<Image> & Record<string, unknown>>;
} {
  const box = plotBox(layout);
  const xa = layout.xaxis;
  const ya = layout.yaxis;
  const annotations: Partial<Annotations>[] = [];
  const images: Array<Partial<Image> & Record<string, unknown>> = [];
  if (!box || !xa?.l2p || !ya?.l2p || !xa.d2l || !ya.d2l) {
    return { annotations, images };
  }

  for (const g of front) {
    const src = logos.get(labelProvider(g));
    if (!src) continue;
    const xLin = xa.d2l(g.price);
    const yLin = ya.d2l(g.score);
    // Plot-area normalized coords (Plotly paper for images/annotations).
    const fx = xa.l2p(xLin) / box.width;
    const fy = 1 - ya.l2p(yLin) / box.height;
    if (fx < -0.05 || fx > 1.05 || fy < -0.05 || fy > 1.05) continue;
    images.push({
      source: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect x=".5" y=".5" width="27" height="27" rx="6" fill="white" stroke="#d0d5dc"/><image href="${escapeHtml(src)}" x="4" y="4" width="20" height="20"/></svg>`,
      )}`,
      xref: "paper",
      yref: "paper",
      x: fx,
      y: fy,
      sizex: LOGO_SIZE / box.width,
      sizey: LOGO_SIZE / box.height,
      xanchor: "center",
      yanchor: "middle",
      layer: "above",
      sizing: "contain",
      opacity: 1,
    });
  }

  const fontSize = mobile ? 10 : 11;
  for (const p of textPlacements) {
    annotations.push({
      x: Math.log10(p.price),
      y: p.score,
      xref: "x",
      yref: "y",
      ax: p.ax,
      ay: p.ay,
      axref: "pixel",
      ayref: "pixel",
      xanchor: p.ax >= 0 ? "left" : "right",
      text: escapeHtml(p.label),
      showarrow: true,
      arrowhead: 0,
      arrowwidth: 1,
      arrowcolor: "#9aa3ad",
      standoff: LOGO_SIZE / 2,
      bgcolor: "rgba(255,255,255,0.96)",
      bordercolor: "#e1e4e8",
      borderwidth: 1,
      borderpad: 3,
      font: {
        size: fontSize,
        color: "#20242a",
        family:
          "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      },
      align: p.ax >= 0 ? "left" : "right",
      captureevents: false,
    });
  }

  return { annotations, images };
}
