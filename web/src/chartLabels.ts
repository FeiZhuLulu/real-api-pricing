import type { Annotations, Image } from "plotly.js";
import type { Group } from "./types";
import { manufacturer } from "./domain";

export type LabelMode = "frontier" | "all" | "none";

export const LOGO_SIZE = 28;
/** Clearance radius of a frontier logo badge and of a plain scatter dot. */
export const FRONTIER_RADIUS = LOGO_SIZE / 2;
export const DOT_RADIUS = 6;

/** Where the label box sits relative to the end of its leader line. */
export type LabelAnchor = "center" | "left" | "right";

export interface ArenaPlacement {
  key: string;
  price: number;
  score: number;
  label: string;
  provider: string;
  ax: number;
  ay: number;
  anchor: LabelAnchor;
  width: number;
  height: number;
  radius: number;
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
  left: number;
  top: number;
  lead: { x1: number; y1: number; x2: number; y2: number } | null;
  inPlot: boolean;
}

/** A marker a label must not cover: pixel centre plus its clearance radius. */
export interface AnchorPoint {
  key: string;
  x: number;
  y: number;
  r: number;
}

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

/**
 * Candidate directions, best first: straight above/below (leader is a short
 * vertical tick), then straight aside, then the diagonals.
 */
const DIRECTIONS: { dx: number; dy: number; anchor: LabelAnchor }[] = [
  { dx: 0, dy: -1, anchor: "center" },
  { dx: 0, dy: 1, anchor: "center" },
  { dx: 1, dy: 0, anchor: "left" },
  { dx: -1, dy: 0, anchor: "right" },
  { dx: 0.8, dy: -0.8, anchor: "left" },
  { dx: -0.8, dy: -0.8, anchor: "right" },
  { dx: 0.8, dy: 0.8, anchor: "left" },
  { dx: -0.8, dy: 0.8, anchor: "right" },
];
/** Gap between the marker edge and the label box, tried nearest first. */
const RING_GAPS = [8, 22, 40];

const sizeCache = new Map<string, { width: number; height: number }>();
let probe: HTMLElement | null | undefined;

/**
 * Measure a name with a hidden copy of the real label element, so the reserved
 * box matches the rendered font, letter spacing, padding and border exactly —
 * for CJK as well as Latin names.
 */
export function measureLabel(label: string, mobile: boolean) {
  const cap = mobile ? 168 : 224;
  if (probe === undefined) {
    if (typeof document === "undefined") probe = null;
    else {
      probe = document.createElement("div");
      probe.className = "arena-name-label";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "left:-10000px;top:0;visibility:hidden;max-width:none;transition:none";
      document.body.appendChild(probe);
    }
  }
  // The label font follows a media query, so the current size is part of the key.
  const cacheKey = `${cap}|${probe ? getComputedStyle(probe).fontSize : mobile}|${label}`;
  const hit = sizeCache.get(cacheKey);
  if (hit) return hit;
  let size: { width: number; height: number };
  if (probe) {
    probe.style.fontSize = mobile ? "10px" : "11px";
    probe.style.padding = mobile ? "2px 6px" : "3px 7px";
    probe.textContent = label;
    const rect = probe.getBoundingClientRect();
    // One extra pixel: sub-pixel text widths would otherwise trigger ellipsis.
    size = {
      width: Math.min(cap, Math.ceil(rect.width + 1)),
      height: Math.ceil(rect.height),
    };
  } else {
    const font = mobile ? 10 : 11;
    const text = [...label].reduce(
      (n, c) => n + (c.charCodeAt(0) > 255 ? font : font * 0.58),
      0,
    );
    size = {
      width: Math.min(cap, Math.ceil(text) + (mobile ? 12 : 14) + 2),
      height: Math.round(font * 1.25) + (mobile ? 4 : 6) + 2,
    };
  }
  sizeCache.set(cacheKey, size);
  return size;
}

export type LabelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
type Box = LabelRect;

function labelBox(
  x: number,
  y: number,
  slot: { ax: number; ay: number; anchor: LabelAnchor },
  size: { width: number; height: number },
): Box {
  const left =
    slot.anchor === "center"
      ? x + slot.ax - size.width / 2
      : slot.anchor === "left"
        ? x + slot.ax
        : x + slot.ax - size.width;
  const top = y + slot.ay - size.height / 2;
  return {
    left,
    top,
    right: left + size.width,
    bottom: top + size.height,
  };
}

/** Rectangle a finished placement occupies once its point lands on (x, y). */
export const placementRect = (
  placement: ArenaPlacement,
  x: number,
  y: number,
): LabelRect => labelBox(x, y, placement, placement);

type Segment = { x1: number; y1: number; x2: number; y2: number };

/** Leader from the marker edge to the nearest point of the label border. */
function leaderSegment(
  x: number,
  y: number,
  box: Box,
  radius: number,
): Segment | null {
  const cx = Math.min(Math.max(x, box.left), box.right);
  const cy = Math.min(Math.max(y, box.top), box.bottom);
  const length = Math.hypot(cx - x, cy - y);
  if (length <= radius + 1) return null;
  const t = radius / length;
  return {
    x1: x + (cx - x) * t,
    y1: y + (cy - y) * t,
    x2: cx,
    y2: cy,
  };
}

const side = (a: Segment, px: number, py: number) =>
  Math.sign(
    (a.x2 - a.x1) * (py - a.y1) - (a.y2 - a.y1) * (px - a.x1),
  );

function segmentsCross(a: Segment, b: Segment): boolean {
  return (
    side(a, b.x1, b.y1) * side(a, b.x2, b.y2) < 0 &&
    side(b, a.x1, a.y1) * side(b, a.x2, a.y2) < 0
  );
}

const boxesOverlap = (a: Box, b: Box, pad: number) =>
  a.left < b.right + pad &&
  a.right > b.left - pad &&
  a.top < b.bottom + pad &&
  a.bottom > b.top - pad;

const boxCoversMarker = (a: Box, m: AnchorPoint) =>
  m.x > a.left - m.r &&
  m.x < a.right + m.r &&
  m.y > a.top - m.r &&
  m.y < a.bottom + m.r;

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
  r2l?: (v: number) => number;
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

function rangeLinear(ax: PlotAxis): [number, number] | null {
  const range = ax.range;
  if (!range || range.length < 2) return null;
  const toLinear = ax.r2l ?? Number;
  const lo = toLinear(range[0]);
  const hi = toLinear(range[1]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return null;
  return [lo, hi];
}

/**
 * Pixel position derived from the live axis ranges instead of l2p.
 * While Plotly pans it updates ax.range on every frame but only recomputes the
 * l2p scale when the drag ends, so l2p would leave the overlay behind.
 */
export function dataToPixel(
  layout: PlotLayout,
  price: number,
  score: number,
  box?: PlotBox | null,
): { x: number; y: number } | null {
  const xa = layout.xaxis;
  const ya = layout.yaxis;
  if (!xa?.l2p || !ya?.l2p || !xa.d2l || !ya.d2l) return null;
  const xLin = xa.d2l(price);
  const yLin = ya.d2l(score);
  if (!Number.isFinite(xLin) || !Number.isFinite(yLin)) return null;
  const area = box ?? plotBox(layout);
  const xr = area && rangeLinear(xa);
  const yr = area && rangeLinear(ya);
  if (area && xr && yr) {
    return {
      x: area.left + ((xLin - xr[0]) / (xr[1] - xr[0])) * area.width,
      y: area.bottom - ((yLin - yr[0]) / (yr[1] - yr[0])) * area.height,
    };
  }
  return {
    x: xa._offset + xa.l2p(xLin),
    y: ya._offset + ya.l2p(yLin),
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
    const pt = dataToPixel(layout, g.price, g.score, box);
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

const BLOCKED = 1000;

/**
 * Arena-style placement: try the nearest clear slot around each marker, keep the
 * leader short, and drop a name outright when every slot would collide with
 * another name, a marker or the plot edge. Groups are placed in the order given
 * (frontier first), so the important names win the good slots.
 */
export function placeTextLabels(
  groups: Group[],
  anchors: Map<string, AnchorPoint>,
  markers: AnchorPoint[],
  box: PlotBox,
  mobile: boolean,
): ArenaPlacement[] {
  if (!groups.length) return [];
  const placed: { box: Box; lead: Segment | null }[] = [];
  const out: ArenaPlacement[] = [];

  for (const g of groups) {
    const anchor = anchors.get(g.key);
    if (!anchor) continue;
    const label = modelLabel(g);
    const size = measureLabel(label, mobile);
    let best: { slot: (typeof DIRECTIONS)[number] & { ax: number; ay: number }; box: Box; lead: Segment | null } | null = null;
    let bestPenalty = Infinity;
    let index = 0;
    for (const gap of RING_GAPS) {
      for (const dir of DIRECTIONS) {
        const distance = anchor.r + gap;
        const slot = {
          ...dir,
          ax: Math.round(dir.dx * distance),
          ay: Math.round(
            dir.dy * (distance + (dir.anchor === "center" ? size.height / 2 : 0)),
          ),
        };
        const rect = labelBox(anchor.x, anchor.y, slot, size);
        const lead = leaderSegment(anchor.x, anchor.y, rect, anchor.r);
        let penalty = index++ * 0.6;
        if (
          rect.left < box.left + 2 ||
          rect.right > box.right - 2 ||
          rect.top < box.top + 2 ||
          rect.bottom > box.bottom - 2
        ) {
          penalty += BLOCKED;
        }
        for (const other of placed) {
          if (boxesOverlap(rect, other.box, 3)) penalty += BLOCKED;
        }
        for (const marker of markers) {
          if (marker.key === g.key) continue;
          if (boxCoversMarker(rect, marker)) {
            penalty += BLOCKED;
          }
        }
        if (lead) {
          penalty += Math.hypot(lead.x2 - lead.x1, lead.y2 - lead.y1) * 0.08;
          for (const other of placed) {
            if (other.lead && segmentsCross(lead, other.lead)) penalty += 35;
          }
        }
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          best = { slot, box: rect, lead };
        }
      }
    }
    if (!best || bestPenalty >= BLOCKED) continue;
    placed.push({ box: best.box, lead: best.lead });
    out.push({
      key: g.key,
      price: g.price,
      score: g.score,
      label,
      provider: labelProvider(g),
      ax: best.slot.ax,
      ay: best.slot.ay,
      anchor: best.slot.anchor,
      width: size.width,
      height: size.height,
      radius: anchor.r,
    });
  }
  return out;
}

export function textLabelViews(
  placements: ArenaPlacement[],
  layout: PlotLayout,
): TextLabelView[] {
  const box = plotBox(layout);
  if (!box) return [];
  const out: TextLabelView[] = [];
  for (const p of placements) {
    const pt = dataToPixel(layout, p.price, p.score, box);
    if (!pt) continue;
    const rect = labelBox(pt.x, pt.y, p, p);
    const visible =
      inPlotBox(pt.x, pt.y, box, -p.radius) &&
      rect.left < box.right &&
      rect.right > box.left &&
      rect.top < box.bottom &&
      rect.bottom > box.top;
    out.push({
      ...p,
      left: rect.left,
      top: rect.top,
      lead: leaderSegment(pt.x, pt.y, rect, p.radius),
      inPlot: visible,
    });
  }
  return out;
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
  shapes: Array<Record<string, unknown>>;
} {
  const box = plotBox(layout);
  const xa = layout.xaxis;
  const ya = layout.yaxis;
  const annotations: Partial<Annotations>[] = [];
  const images: Array<Partial<Image> & Record<string, unknown>> = [];
  const shapes: Array<Record<string, unknown>> = [];
  if (!box || !xa?.l2p || !ya?.l2p || !xa.d2l || !ya.d2l) {
    return { annotations, images, shapes };
  }
  const toPaperX = (px: number) => (px - box.left) / box.width;
  const toPaperY = (py: number) => 1 - (py - box.top) / box.height;

  for (const g of front) {
    const src = logos.get(labelProvider(g));
    if (!src) continue;
    const pt = dataToPixel(layout, g.price, g.score, box);
    if (!pt) continue;
    // Plot-area normalized coords (Plotly paper for images/annotations/shapes).
    const fx = toPaperX(pt.x);
    const fy = toPaperY(pt.y);
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
    const pt = dataToPixel(layout, p.price, p.score, box);
    if (!pt) continue;
    const rect = labelBox(pt.x, pt.y, p, p);
    const lead = leaderSegment(pt.x, pt.y, rect, p.radius);
    if (lead) {
      // Annotation arrows cannot be dashed, so leaders are dotted shapes.
      shapes.push({
        type: "line",
        xref: "paper",
        yref: "paper",
        x0: toPaperX(lead.x1),
        y0: toPaperY(lead.y1),
        x1: toPaperX(lead.x2),
        y1: toPaperY(lead.y2),
        line: { color: "#aab1ba", width: 1, dash: "dot" },
        layer: "above",
      });
    }
    annotations.push({
      x: toPaperX(pt.x + p.ax),
      y: toPaperY(pt.y + p.ay),
      xref: "paper",
      yref: "paper",
      xanchor:
        p.anchor === "center" ? "center" : p.anchor === "left" ? "left" : "right",
      yanchor: "middle",
      text: escapeHtml(p.label),
      showarrow: false,
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
      align: "center",
      captureevents: false,
    });
  }

  return { annotations, images, shapes };
}
