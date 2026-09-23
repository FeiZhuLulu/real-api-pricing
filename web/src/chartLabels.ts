import type { Group } from "./types";
import { manufacturer } from "./domain";

export type LabelMode = "frontier" | "all" | "none";

export const LOGO_SIZE = 28;
/** Clearance radius of a frontier logo badge and of a plain scatter dot. */
export const FRONTIER_RADIUS = LOGO_SIZE / 2;
export const DOT_RADIUS = 6;
/** A model/plan lock can cover dozens of points; beyond this, hits keep all
    their badges but name labels compete for slots instead of being forced. */
export const LABEL_FORCE_CAP = 6;

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

/** A marker a label must not cover: pixel centre plus its clearance radius. */
export interface AnchorPoint {
  key: string;
  x: number;
  y: number;
  r: number;
}

/** Bottom cards: all points when labels=all, otherwise frontier plus hits. */
export function cardGroups(
  gs: Group[],
  front: Group[],
  mode: LabelMode,
  hits: Group[] = [],
): Group[] {
  if (mode === "all") return gs;
  return badgeGroups(front, hits);
}

/** Badge order: frontier first, then search hits that are not already on it. */
export function badgeGroups(front: Group[], hits: Group[]): Group[] {
  const seen = new Set<string>();
  const out: Group[] = [];
  for (const g of [...front, ...hits])
    if (!seen.has(g.key)) {
      seen.add(g.key);
      out.push(g);
    }
  return out;
}

/** Placement priority: search hits get the good slots, then the base label set. */
export function orderLabelGroups(base: Group[], hits: Group[]): Group[] {
  const seen = new Set<string>();
  const out: Group[] = [];
  for (const g of [...hits, ...base])
    if (!seen.has(g.key)) {
      seen.add(g.key);
      out.push(g);
    }
  return out;
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

export function modelLabel(g: Group, lang = "en"): string {
  const name = [...new Set(g.rows.map((r) => r.point.model_display))].join(
    " / ",
  );
  const tag = g.rows.some((r) => r.mapping?.score_is_self_reported)
    ? lang === "zh"
      ? " [厂商自报]"
      : " [self-reported]"
    : "";
  return name + tag;
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
      const dLog = Math.abs(Math.log10(g.plotPrice) - Math.log10(s.plotPrice));
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
let measureCtx: CanvasRenderingContext2D | null | undefined;
export const LABEL_FONT =
  '"DM Sans Variable", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * Widths measured before the web font arrives are stale; drop them so labels
 * are re-measured against the real font.
 */
export function clearLabelSizeCache() {
  sizeCache.clear();
}

/**
 * Size of a name box: the text advance measured with the same font the SVG
 * renders (canvas measureText, no layout), plus 7px/3px padding and a 1px
 * border (6px/2px on mobile). Works for CJK as well as Latin names.
 */
export function measureLabel(label: string, mobile: boolean) {
  const cap = mobile ? 168 : 224;
  const font = mobile ? 10 : 11;
  const padX = mobile ? 6 : 7;
  const padY = mobile ? 2 : 3;
  const cacheKey = `${mobile ? 1 : 0}|${label}`;
  const hit = sizeCache.get(cacheKey);
  if (hit) return hit;
  if (measureCtx === undefined)
    measureCtx =
      typeof document !== "undefined"
        ? document.createElement("canvas").getContext("2d")
        : null;
  let text: number;
  if (measureCtx) {
    measureCtx.font = `${font}px ${LABEL_FONT}`;
    text = measureCtx.measureText(label).width;
  } else {
    text = [...label].reduce(
      (n, c) => n + (c.charCodeAt(0) > 255 ? font : font * 0.58),
      0,
    );
  }
  // One extra pixel: sub-pixel advances would otherwise clip the last glyph.
  const size = {
    width: Math.min(cap, Math.ceil(text + padX * 2 + 2 + 1)),
    height: Math.ceil(font * 1.25) + padY * 2 + 2,
  };
  sizeCache.set(cacheKey, size);
  return size;
}

/**
 * The label text that fits in `width` (the measured box, capped), ending in
 * an ellipsis when the full name would overflow.
 */
export function fitLabel(label: string, mobile: boolean): string {
  const cap = mobile ? 168 : 224;
  // measureLabel clamps at the cap, so reaching it means the name overflows.
  const fits = (text: string) => measureLabel(text, mobile).width < cap;
  if (fits(label)) return label;
  let lo = 1;
  let hi = label.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fits(label.slice(0, mid).trimEnd() + "…")) lo = mid;
    else hi = mid - 1;
  }
  return label.slice(0, lo).trimEnd() + "…";
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

export type Segment = { x1: number; y1: number; x2: number; y2: number };

/** Leader from the marker edge to the nearest point of the label border. */
export function leaderSegment(
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
  lang = "en",
  forced?: Set<string>,
): ArenaPlacement[] {
  if (!groups.length) return [];
  const placed: { box: Box; lead: Segment | null }[] = [];
  const out: ArenaPlacement[] = [];

  for (const g of groups) {
    const anchor = anchors.get(g.key);
    if (!anchor) continue;
    const label = modelLabel(g, lang);
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
    // Forced (search-marked) names take their least-bad slot even when every
    // slot is blocked — an explicit query must stay visible — and still claim
    // the space so later labels avoid it.
    if (!best || (bestPenalty >= BLOCKED && !forced?.has(g.key))) continue;
    placed.push({ box: best.box, lead: best.lead });
    out.push({
      key: g.key,
      price: g.plotPrice,
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
