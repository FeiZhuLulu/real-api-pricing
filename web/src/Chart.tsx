import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  ArrowCounterClockwise,
  ArrowsOutCardinal,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  SelectionPlus,
} from "@phosphor-icons/react";
import dmSansUrl from "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url";
import type { Group, Row, State, SiteData } from "./types";
import { BrandMarks, providerLogoUrl } from "./ProviderLogo";
import { wheelRange } from "./wheelZoom";
import {
  groups,
  pareto,
  frontierPath,
  displayPlan,
  accessLine,
  color,
  colorAlpha,
  price,
  number,
  unmeteredNote,
  selfReportTag,
  variantLabel,
  type Lock,
  searchCandidates,
  searchHits,
  metricLabel,
} from "./domain";
import {
  type AnchorPoint,
  type ArenaPlacement,
  DOT_RADIUS,
  FRONTIER_RADIUS,
  LABEL_FONT,
  LABEL_FORCE_CAP,
  LOGO_SIZE,
  badgeGroups,
  cardGroups,
  clearLabelSizeCache,
  fitLabel,
  labelProvider,
  leaderSegment,
  orderLabelGroups,
  placeTextLabels,
  placementRect,
  textLabelGroups,
} from "./chartLabels";
import {
  type Box,
  type View,
  boxToView,
  hitTest,
  homeView,
  inBox,
  makeBox,
  panBy,
  priceTicks,
  scoreTicks,
  toPixel,
  xPixel,
  yPixel,
  zeroFence,
  zoomAt,
} from "./chartScene";
import { chartColors, dotColors, readableInk, type ChartColors } from "./palette";
import ChartSearch from "./ChartSearch";

export interface ChartHandle {
  download: (format: "png" | "svg") => Promise<void>;
}
const FONT = LABEL_FONT;

interface SceneProps {
  width: number;
  height: number;
  box: Box;
  view: View;
  colors: ChartColors;
  dark: boolean;
  gs: Group[];
  front: Group[];
  frontKeys: Set<string>;
  badges: Group[];
  placements: ArenaPlacement[];
  hits: Set<string>;
  highlight: string | null;
  hoverKey: string | null;
  showFrontier: boolean;
  zeroX: number | null;
  xTitle: string;
  yTitle: string;
  cheaper: string;
  unmetered: string;
  lang: string;
  mobile: boolean;
  clipId: string;
  zoomRect?: { x0: number; y0: number; x1: number; y1: number } | null;
  header?: { title: string; subtitle: string } | null;
  keyRows?: { n: number; text: string; color: string }[];
  fontCss?: string;
  ariaLabel?: string;
}

/**
 * The whole chart as one SVG tree with explicit colours. The page renders it
 * live; the exporter renders the very same component off-screen, so a
 * downloaded PNG/SVG matches what is on screen.
 */
function ChartScene(p: SceneProps) {
  const { box, view, colors: c } = p;
  const font = p.mobile ? 10 : 11;
  // Legend hover isolates a channel; an active search softly recedes the rest.
  const fade = (g: Group) =>
    p.highlight !== null
      ? g.rows[0].point.channel === p.highlight
        ? 1
        : 0.16
      : p.hits.size > 0 && !p.hits.has(g.key)
        ? 0.4
        : 1;
  const badgeKeys = new Set(p.badges.map((g) => g.key));
  const fence = p.zeroX !== null ? zeroFence(p.zeroX) : null;
  const xTicks = priceTicks(
    view,
    box,
    p.mobile ? 54 : 64,
    fence !== null ? Math.log10(fence) : -Infinity,
  );
  const yTicks = scoreTicks(view, box, p.lang);
  const line = p.showFrontier && p.front.length
    ? (() => {
        const path = frontierPath(p.front, 1e-12, 1e12);
        return path.x
          .map((x, i) => {
            const X = Math.max(-1e5, Math.min(1e5, xPixel(view, box, x)));
            return `${i ? "L" : "M"}${X.toFixed(1)},${yPixel(view, box, path.y[i]).toFixed(1)}`;
          })
          .join("");
      })()
    : "";
  const hovered = p.hoverKey ? p.gs.find((g) => g.key === p.hoverKey) : null;
  const zeroPx = p.zeroX !== null ? xPixel(view, box, p.zeroX) : null;
  const dots = p.gs.filter((g) => !badgeKeys.has(g.key));
  // Faded points first so emphasised ones stay on top.
  dots.sort((a, b) => fade(a) - fade(b));
  const titleY = box.bottom + 46;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={p.width}
      height={p.height}
      viewBox={`0 0 ${p.width} ${p.height}`}
      fontFamily={FONT}
      role="img"
      aria-label={p.ariaLabel}
      style={{ display: "block" }}
    >
      {p.fontCss && <style>{p.fontCss}</style>}
      <defs>
        <clipPath id={p.clipId}>
          <rect x={box.left} y={box.top} width={box.width} height={box.height} />
        </clipPath>
      </defs>
      {p.header && (
        <>
          <rect width={p.width} height={p.height} fill={c.surface} />
          <text x={box.left} y={34} fontSize={20} fontWeight={600} fill={c.ink} letterSpacing={-0.3}>
            {p.header.title}
          </text>
          <text x={box.left} y={56} fontSize={12} fill={c.text}>
            {p.header.subtitle}
          </text>
        </>
      )}
      <g>
        {/* grid */}
        {yTicks.map((t) => (
          <line key={`gy${t.label}`} x1={box.left} x2={box.right} y1={t.pos} y2={t.pos} stroke={c.grid} />
        ))}
        {xTicks.map((t) => (
          <line
            key={`gx${t.label}`}
            x1={t.pos}
            x2={t.pos}
            y1={box.top}
            y2={box.bottom}
            stroke={t.major ? c.gridMajor : c.grid}
          />
        ))}
        <line x1={box.left} x2={box.right} y1={box.bottom} y2={box.bottom} stroke={c.axis} />
        {fence !== null && inBox(box, xPixel(view, box, fence), box.top) && (
          <line
            x1={xPixel(view, box, fence)}
            x2={xPixel(view, box, fence)}
            y1={box.top}
            y2={box.bottom}
            stroke={c.fence}
            strokeDasharray="2 4"
          />
        )}
        {/* tick labels */}
        <g fontSize={p.mobile ? 10.5 : 11.5} fill={c.text} style={{ fontVariantNumeric: "tabular-nums" }}>
          {yTicks.map((t) =>
            t.pos >= box.top - 1 && t.pos <= box.bottom + 1 ? (
              <text key={`ty${t.label}`} x={box.left - 10} y={t.pos} textAnchor="end" dominantBaseline="central">
                {t.label}
              </text>
            ) : null,
          )}
          {xTicks.map((t) => (
            <text key={`tx${t.label}`} x={t.pos} y={box.bottom + 18} textAnchor="middle">
              {t.label}
            </text>
          ))}
          {zeroPx !== null && zeroPx >= box.left && zeroPx <= box.right && (
            <text x={zeroPx} y={box.bottom + 18} textAnchor="middle" fill={c.ink} fontWeight={600}>
              ≈$0
              <tspan x={zeroPx} dy="1.25em" fontSize={p.mobile ? 9.5 : 10} fontWeight={400} fill={c.text}>
                {p.unmetered}
              </tspan>
            </text>
          )}
        </g>
        {/* axis titles */}
        <text x={box.left + box.width / 2} y={titleY} textAnchor="middle" fontSize={12} fill={c.text}>
          {p.xTitle}
        </text>
        {!p.mobile && (
          <text x={box.right} y={titleY} textAnchor="end" fontSize={11.5} fontWeight={600} fill={c.ink}>
            {p.cheaper}
          </text>
        )}
        <text
          transform={`translate(${p.mobile ? 12 : 16} ${box.top + box.height / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={12}
          fill={c.text}
        >
          {p.yTitle}
        </text>
        {/* data */}
        <g clipPath={`url(#${p.clipId})`}>
          {line && <path d={line} fill="none" stroke={c.frontier} strokeWidth={1.7} strokeLinejoin="round" />}
          {dots.map((g) => {
            const { x, y } = toPixel(view, box, g.plotPrice, g.score);
            const col = dotColors(color(g.rows[0].point), p.dark);
            const f = fade(g);
            return (
              <circle
                key={g.key}
                cx={x.toFixed(1)}
                cy={y.toFixed(1)}
                r={4.4}
                fill={col.fill}
                fillOpacity={0.84 * f}
                stroke={col.stroke}
                strokeOpacity={f < 1 ? f : 0.95}
                strokeWidth={1}
              />
            );
          })}
          {hovered && !badgeKeys.has(hovered.key) && (() => {
            const { x, y } = toPixel(view, box, hovered.plotPrice, hovered.score);
            const col = dotColors(color(hovered.rows[0].point), p.dark);
            return (
              <circle
                className="point-halo"
                cx={x}
                cy={y}
                r={8}
                fill={col.fill}
                stroke={c.surface}
                strokeWidth={2.5}
              />
            );
          })()}
        </g>
        {/* leaders + names */}
        <g>
          {p.placements.map((pl) => {
            const { x, y } = toPixel(view, box, pl.price, pl.score);
            if (!inBox(box, x, y, -pl.radius)) return null;
            const rect = placementRect(pl, x, y);
            if (rect.right < box.left || rect.left > box.right || rect.bottom < box.top || rect.top > box.bottom)
              return null;
            const lead = leaderSegment(x, y, rect, pl.radius);
            return lead ? (
              <line
                key={`lead-${pl.key}`}
                x1={lead.x1}
                y1={lead.y1}
                x2={lead.x2}
                y2={lead.y2}
                stroke={c.leader}
                strokeDasharray="2 3"
              />
            ) : null;
          })}
        </g>
        {p.badges.map((g) => {
          const { x, y } = toPixel(view, box, g.plotPrice, g.score);
          if (!inBox(box, x, y, -LOGO_SIZE / 2)) return null;
          const provider = labelProvider(g);
          const logo = providerLogoUrl(provider, "light");
          const hit = p.hits.has(g.key);
          const hitColor = color(g.rows[0].point);
          const hover = p.hoverKey === g.key;
          const faded = p.highlight !== null && g.rows[0].point.channel !== p.highlight;
          const h = LOGO_SIZE / 2;
          return (
            <g key={`badge-${g.key}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={faded ? 0.3 : 1}>
              <g className={hover ? "chart-badge is-hovered" : "chart-badge"}>
                {hit && (
                  <rect x={-h - 3} y={-h - 3} width={LOGO_SIZE + 6} height={LOGO_SIZE + 6} rx={9} fill={colorAlpha(g.rows[0].point, p.dark ? 0.45 : 0.3)} />
                )}
                <rect
                  x={-h + 0.5}
                  y={-h + 0.5}
                  width={LOGO_SIZE - 1}
                  height={LOGO_SIZE - 1}
                  rx={7}
                  fill={c.badgeBg}
                  stroke={hit ? hitColor : c.badgeStroke}
                  strokeWidth={hit ? 1.6 : 1}
                />
                {logo ? (
                  <image href={logo} x={-10} y={-10} width={20} height={20} preserveAspectRatio="xMidYMid meet" />
                ) : (
                  <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={600} fill="#555">
                    {provider.slice(0, 2)}
                  </text>
                )}
              </g>
            </g>
          );
        })}
        {p.placements.map((pl) => {
          const { x, y } = toPixel(view, box, pl.price, pl.score);
          if (!inBox(box, x, y, -pl.radius)) return null;
          const rect = placementRect(pl, x, y);
          if (rect.right < box.left || rect.left > box.right || rect.bottom < box.top || rect.top > box.bottom)
            return null;
          const g = p.gs.find((gg) => gg.key === pl.key);
          const hit = p.hits.has(pl.key);
          const front = p.frontKeys.has(pl.key);
          const faded = g && p.highlight !== null && g.rows[0].point.channel !== p.highlight;
          const hitColor = g ? color(g.rows[0].point) : c.frontier;
          return (
            <g key={`name-${pl.key}`} opacity={faded ? 0.3 : 1}>
              {hit && g && (
                <rect
                  x={rect.left - 3}
                  y={rect.top - 3}
                  width={rect.right - rect.left + 6}
                  height={rect.bottom - rect.top + 6}
                  rx={7}
                  fill={colorAlpha(g.rows[0].point, p.dark ? 0.4 : 0.25)}
                />
              )}
              <rect
                x={rect.left + 0.5}
                y={rect.top + 0.5}
                width={rect.right - rect.left - 1}
                height={rect.bottom - rect.top - 1}
                rx={5}
                fill={c.labelBg}
                stroke={hit ? hitColor : front ? c.frontierLabel : p.hoverKey === pl.key ? c.labelHover : c.labelBorder}
              />
              <text
                x={(rect.left + rect.right) / 2}
                y={(rect.top + rect.bottom) / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={font}
                fill={c.ink}
              >
                {fitLabel(pl.label, p.mobile)}
              </text>
            </g>
          );
        })}
        {p.zoomRect && (
          <rect
            x={Math.min(p.zoomRect.x0, p.zoomRect.x1)}
            y={Math.min(p.zoomRect.y0, p.zoomRect.y1)}
            width={Math.abs(p.zoomRect.x1 - p.zoomRect.x0)}
            height={Math.abs(p.zoomRect.y1 - p.zoomRect.y0)}
            fill={c.zoomFill}
            stroke={c.zoomStroke}
            strokeDasharray="4 3"
          />
        )}
        {p.keyRows && p.keyRows.length > 0 && (
          <g fontSize={12} fill={c.ink}>
            {p.keyRows.map((k, i) => {
              const col = i % 2;
              const rowI = Math.floor(i / 2);
              const x = box.left + col * ((p.width - box.left - 24) / 2);
              const y = box.bottom + 92 + rowI * 24;
              return (
                <g key={k.n} transform={`translate(${x} ${y})`}>
                  <circle cx={9} cy={-4} r={9} fill={k.color} />
                  <text
                    x={9}
                    y={-4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight={700}
                    fill={readableInk(k.color)}
                  >
                    {k.n}
                  </text>
                  <text x={26} y={-4} dominantBaseline="central">
                    {k.text}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </g>
    </svg>
  );
}

let fontCssJob: Promise<string> | null = null;
/** The page font, embedded so exported files render with the same metrics. */
function exportFontCss(): Promise<string> {
  fontCssJob ??= fetch(dmSansUrl)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("font"))))
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(
              `@font-face{font-family:"DM Sans Variable";font-style:normal;font-weight:100 1000;src:url(${reader.result}) format("woff2");}`,
            );
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => "");
  return fontCssJob;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, size: number) {
  if (measureCtx === undefined)
    measureCtx =
      typeof document !== "undefined"
        ? document.createElement("canvas").getContext("2d")
        : null;
  if (!measureCtx) return text.length * size * 0.6;
  measureCtx.font = `${size}px ${FONT}`;
  return measureCtx.measureText(text).width;
}

function marginsFor(v: View, height: number, lang: string, mobile: boolean) {
  const probe = makeBox(600, height, { l: 60, r: 20, t: 20, b: 60 });
  const widest = Math.max(
    ...scoreTicks(v, probe, lang).map((t) => textWidth(t.label, mobile ? 10.5 : 11.5)),
    16,
  );
  return {
    l: Math.ceil(widest + (mobile ? 30 : 40)),
    r: mobile ? 14 : 22,
    t: 18,
    b: 64,
  };
}

function placeAll(
  labelGroups: Group[],
  gs: Group[],
  view: View,
  box: Box,
  frontKeys: Set<string>,
  hitSet: Set<string>,
  hitCount: number,
  mobile: boolean,
  lang: string,
) {
  if (!labelGroups.length) return [];
  const anchors = new Map<string, AnchorPoint>();
  const markers: AnchorPoint[] = [];
  for (const g of gs) {
    const { x, y } = toPixel(view, box, g.plotPrice, g.score);
    if (!inBox(box, x, y, 30)) continue;
    const marker = {
      key: g.key,
      x,
      y,
      // Hits carry a badge too, so other labels keep the badge clearance.
      r: frontKeys.has(g.key) || hitSet.has(g.key) ? FRONTIER_RADIUS : DOT_RADIUS,
    };
    markers.push(marker);
    anchors.set(g.key, marker);
  }
  return placeTextLabels(
    labelGroups,
    anchors,
    markers,
    box,
    mobile,
    lang,
    hitCount <= LABEL_FORCE_CAP ? hitSet : undefined,
  );
}

type Gesture =
  | { kind: "pan"; id: number; x: number; y: number; view: View; moved: boolean }
  | { kind: "zoom"; id: number; x: number; y: number; moved: boolean }
  | { kind: "pinch"; dist: number; cx: number; cy: number; view: View };

export default function Chart({
  rows,
  state,
  data,
  theme,
  highlight,
  onSelect,
  onSearch,
  handle,
}: {
  rows: Row[];
  state: State;
  data: SiteData;
  theme: "light" | "dark";
  highlight: string | null;
  onSelect: (rows: Row[]) => void;
  onSearch: (find: string, lock: Lock | null) => void;
  handle: React.RefObject<ChartHandle | null>;
}) {
  const zh = state.lang === "zh";
  const dark = theme === "dark";
  const colors = chartColors(dark);
  const clipId = useId().replace(/:/g, "");
  const shell = useRef<HTMLDivElement>(null);
  const svgWrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const mobile = width > 0 && width < 600;
  const height = mobile ? 430 : Math.round(Math.min(600, Math.max(470, width * 0.44)));

  const gs = useMemo(() => groups(rows), [rows]);
  const front = useMemo(() => pareto(gs), [gs]);
  const frontKeys = useMemo(() => new Set(front.map((g) => g.key)), [front]);
  const signature = useMemo(() => gs.map((g) => g.key).join("|"), [gs]);
  const home = useMemo(() => homeView(gs), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<View>(home);
  const [settled, setSettled] = useState<View>(home);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<"pan" | "zoom">("pan");
  const [zoomRect, setZoomRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [grabbing, setGrabbing] = useState(false);

  useLayoutEffect(() => {
    setView(home);
    setSettled(home);
  }, [home]);
  // Names re-solve once a gesture settles; mid-gesture they ride along.
  useEffect(() => {
    if (gesture.current) return;
    const t = setTimeout(() => setSettled(view), 140);
    return () => clearTimeout(t);
  }, [view]);

  useLayoutEffect(() => {
    const el = shell.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!document.fonts) return;
    const done = () => {
      clearLabelSizeCache();
      setFontEpoch((n) => n + 1);
    };
    void document.fonts.ready.then(done);
    document.fonts.addEventListener("loadingdone", done);
    return () => document.fonts.removeEventListener("loadingdone", done);
  }, []);

  const margins = useMemo(
    () => marginsFor(home, height, state.lang, mobile),
    [home, height, state.lang, mobile, fontEpoch], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const box = useMemo(() => makeBox(width || 800, height, margins), [width, height, margins]);

  const candidates = useMemo(
    () => searchCandidates(gs, state.find, state.lang),
    [gs, state.find, state.lang],
  );
  const hits = useMemo(
    () => searchHits(gs, state.find, state.lock, state.lang),
    [gs, state.find, state.lock, state.lang],
  );
  const hitList = useMemo(() => gs.filter((g) => hits.keys.has(g.key)), [gs, hits]);
  const badges = useMemo(() => badgeGroups(front, hitList), [front, hitList]);
  const labelGroups = useMemo(
    () => orderLabelGroups(textLabelGroups(gs, front, state.labels), hitList),
    [gs, front, state.labels, hitList],
  );
  const placements = useMemo(
    () =>
      width
        ? placeAll(labelGroups, gs, settled, box, frontKeys, hits.keys, hitList.length, mobile, state.lang)
        : [],
    // fontEpoch: widths measured before the web font arrived are stale.
    [labelGroups, gs, settled, box, frontKeys, hits, hitList.length, mobile, state.lang, width, fontEpoch], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const cardList = useMemo(
    () => cardGroups(gs, front, state.labels, hitList),
    [gs, front, state.labels, hitList],
  );
  const zeroGroup = gs.find((g) => g.price === 0);
  const zeroX = zeroGroup ? zeroGroup.plotPrice : null;

  const board = data.boards[state.board];
  const xTitle = zh ? "真实单价 · 美元 / 百万 token（对数）" : "Real price · USD per million tokens (log scale)";
  const cheaper = zh ? "更便宜 →" : "Cheaper →";
  const unmetered = zh ? "不计额度" : "unmetered";
  const markable = useMemo(
    () =>
      gs.map((g) => {
        const { x, y } = toPixel(view, box, g.plotPrice, g.score);
        const badge = badges.some((b) => b.key === g.key);
        return { key: g.key, x, y, r: badge ? FRONTIER_RADIUS + 3 : 9 };
      }),
    [gs, view, box, badges],
  );

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgWrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const setViewSafe = (next: View) => {
    // Refuse degenerate windows (a runaway zoom would lose all precision).
    const spanX = next.xl - next.xr;
    const spanY = next.yt - next.yb;
    if (!(spanX > 1e-4 && spanX < 40 && spanY > 1e-6 && Number.isFinite(spanY))) return;
    setView(next);
  };
  const reset = () => {
    setView(home);
    setSettled(home);
  };
  const zoomBy = (factor: number) =>
    setViewSafe(zoomAt(view, box, box.left + box.width / 2, box.top + box.height / 2, factor));

  // Wheel zoom inside the plot rectangle only; page scroll elsewhere.
  const viewRef = useRef(view);
  viewRef.current = view;
  const boxRef = useRef(box);
  boxRef.current = box;
  useEffect(() => {
    const el = svgWrap.current;
    if (!el) return;
    let frame = 0;
    let pending: View | null = null;
    const wheel = (event: WheelEvent) => {
      const b = boxRef.current;
      const r = el.getBoundingClientRect();
      const x = event.clientX - r.left;
      const y = event.clientY - r.top;
      if (!inBox(b, x, y)) return;
      event.preventDefault();
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? b.height : 1);
      if (!delta) return;
      const v = pending ?? viewRef.current;
      const fx = (x - b.left) / b.width;
      const fy = (b.bottom - y) / b.height;
      const [xl, xr] = wheelRange([v.xl, v.xr], fx, delta);
      const [yb, yt] = wheelRange([v.yb, v.yt], fy, delta);
      pending = { xl, xr, yb, yt };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (pending) setViewSafe(pending);
          pending = null;
        });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheel);
      cancelAnimationFrame(frame);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        view,
      };
      setZoomRect(null);
      return;
    }
    if (!inBox(box, pt.x, pt.y)) return;
    gesture.current =
      dragMode === "zoom" && e.pointerType === "mouse"
        ? { kind: "zoom", id: e.pointerId, x: pt.x, y: pt.y, moved: false }
        : { kind: "pan", id: e.pointerId, x: pt.x, y: pt.y, view, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const pt = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    if (g?.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      setViewSafe(zoomAt(g.view, box, g.cx, g.cy, g.dist / dist));
      return;
    }
    if (g && (g.kind === "pan" || g.kind === "zoom") && g.id === e.pointerId) {
      const dx = pt.x - g.x;
      const dy = pt.y - g.y;
      if (!g.moved && Math.hypot(dx, dy) > 4) {
        g.moved = true;
        setHoverKey(null);
        if (g.kind === "pan") setGrabbing(true);
      }
      if (!g.moved) return;
      if (g.kind === "pan") setViewSafe(panBy(g.view, box, dx, dy));
      else
        setZoomRect({
          x0: g.x,
          y0: g.y,
          x1: Math.max(box.left, Math.min(box.right, pt.x)),
          y1: Math.max(box.top, Math.min(box.bottom, pt.y)),
        });
      return;
    }
    if (e.pointerType !== "mouse") return;
    const target = inBox(box, pt.x, pt.y, 6) ? hitTest(markable, pt.x, pt.y) : null;
    const key = target?.key ?? null;
    if (key !== hoverKey) setHoverKey(key);
  };
  const endGesture = (e: React.PointerEvent, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) {
        gesture.current = null;
        setSettled(viewRef.current);
      }
      return;
    }
    if (g.id !== e.pointerId) return;
    gesture.current = null;
    setGrabbing(false);
    if (cancelled) {
      setZoomRect(null);
      return;
    }
    if (!g.moved) {
      const pt = local(e);
      const target = hitTest(markable, pt.x, pt.y);
      const group = target && gs.find((gg) => gg.key === target.key);
      if (group) onSelect(group.rows);
      return;
    }
    if (g.kind === "zoom" && zoomRect) {
      const w = Math.abs(zoomRect.x1 - zoomRect.x0);
      const h = Math.abs(zoomRect.y1 - zoomRect.y0);
      if (w > 8 && h > 8)
        setViewSafe(boxToView(view, box, zoomRect.x0, zoomRect.y0, zoomRect.x1, zoomRect.y1));
      setZoomRect(null);
    }
    setSettled(viewRef.current);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 0.12;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [box.width * step, 0],
      ArrowRight: [-box.width * step, 0],
      ArrowUp: [0, box.height * step],
      ArrowDown: [0, -box.height * step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      setViewSafe(panBy(view, box, ...moves[e.key]));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(0.8);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(1.25);
    } else if (e.key === "0") {
      e.preventDefault();
      reset();
    }
  };

  const ariaLabel = zh
    ? `${board.name}：${gs.length} 个坐标，前沿 ${front.length} 个。下方卡片可逐一查看。`
    : `${board.name}: ${gs.length} plotted coordinates, ${front.length} on the frontier. Use the cards below to inspect each.`;
  const sceneBase = {
    view,
    colors,
    dark,
    gs,
    front,
    frontKeys,
    badges,
    hits: hits.keys,
    showFrontier: state.frontier,
    zeroX,
    xTitle,
    yTitle: metricLabel(board.metric, state.lang),
    cheaper,
    unmetered,
    lang: state.lang,
  };

  // Keep the latest render inputs for the exporter without re-binding it.
  const exportInputs = useRef({ sceneBase, labelGroups, hitList, cardList, board, gs });
  exportInputs.current = { sceneBase, labelGroups, hitList, cardList, board, gs };
  useEffect(() => {
    handle.current = {
      download: async (format) => {
        const { sceneBase: base, labelGroups: lg, hitList: hl, cardList: cards, board: b, gs: all } =
          exportInputs.current;
        const W = 1200;
        const top = 78;
        const plotH = 560;
        const keyRows = cards.map((g, i) => ({
          n: i + 1,
          color: color(g.rows[0].point),
          text: `${[...new Set(g.rows.map((r) => r.point.model_display))].join(" / ")} · ${price(g.price)} / MTok${g.price === 0 ? " · " + unmeteredNote(g.rows[0].point, state.lang) : ""} · ${number(g.score, state.lang)}${g.rows[0].mapping?.score_is_self_reported ? " · " + selfReportTag(state.lang) : ""}`,
        }));
        const keyH = keyRows.length ? 70 + Math.ceil(keyRows.length / 2) * 24 : 20;
        const m = marginsFor(base.view, plotH, state.lang, false);
        const exportBox = makeBox(W, top + plotH, { ...m, t: top });
        const H = exportBox.bottom + m.b + keyH;
        const exportPlacements = placeAll(
          lg,
          all,
          base.view,
          exportBox,
          base.frontKeys,
          base.hits,
          hl.length,
          false,
          state.lang,
        );
        const fontCss = await exportFontCss();
        const host = document.createElement("div");
        const root = createRoot(host);
        flushSync(() =>
          root.render(
            <ChartScene
              {...base}
              width={W}
              height={H}
              box={exportBox}
              placements={exportPlacements}
              highlight={null}
              hoverKey={null}
              mobile={false}
              clipId="export-clip"
              header={{
                title: `${b.name} × ${zh ? "真实单价" : "real price"}`,
                subtitle: `${metricLabel(b.metric, state.lang)} · ${zh ? "快照" : "Snapshot"} ${b.snapshot} · Real API Pricing · real-api-pricing.vercel.app`,
              }}
              keyRows={keyRows}
              fontCss={fontCss}
            />,
          ),
        );
        const svgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + host.innerHTML;
        root.unmount();
        const filename = `real-api-pricing-${state.board}-${state.lang}.${format}`;
        const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        if (format === "svg") return download(svgBlob, filename);
        const url = URL.createObjectURL(svgBlob);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = W * 2;
          canvas.height = H * 2;
          const ctx = canvas.getContext("2d")!;
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0, W, H);
          const png = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
          );
          download(png, filename);
        } finally {
          URL.revokeObjectURL(url);
        }
      },
    };
    return () => {
      handle.current = null;
    };
  }, [handle, state.lang, state.board, zh]);

  const hoverGroup = hoverKey ? gs.find((g) => g.key === hoverKey) : undefined;
  const hoverPoint = hoverGroup?.rows[0]?.point;
  const hoverBadge = hoverGroup ? badges.some((b) => b.key === hoverGroup.key) : false;
  const CARD_WIDTH = 256;
  const CARD_HEIGHT = 150;
  const hoverCard =
    hoverGroup && width
      ? (() => {
          const { x, y } = toPixel(view, box, hoverGroup.plotPrice, hoverGroup.score);
          const gap = (hoverBadge ? FRONTIER_RADIUS : DOT_RADIUS) + 10;
          const left = x + gap + CARD_WIDTH > box.right - 4 ? x - gap - CARD_WIDTH : x + gap;
          const top = y + gap + CARD_HEIGHT > box.bottom - 4 ? y - gap - CARD_HEIGHT : y + gap;
          return {
            left: Math.max(4, Math.min(left, width - CARD_WIDTH - 4)),
            top: Math.max(4, Math.min(top, height - CARD_HEIGHT - 4)),
          };
        })()
      : null;
  const hitStyle = (g: Group) =>
    hits.keys.has(g.key)
      ? ({
          "--hit": color(g.rows[0].point),
          "--hit-ring": colorAlpha(g.rows[0].point, dark ? 0.45 : 0.3),
        } as React.CSSProperties)
      : undefined;
  const zoomed =
    Math.abs(view.xl - home.xl) + Math.abs(view.xr - home.xr) > 1e-6 ||
    Math.abs(view.yt - home.yt) + Math.abs(view.yb - home.yb) > 1e-6;

  return (
    <>
      <div className="plot-controls" role="toolbar" aria-label={zh ? "图表操作" : "Chart navigation"}>
        <div className="segmented" role="group" aria-label={zh ? "拖拽模式" : "Drag mode"}>
          <button aria-pressed={dragMode === "pan"} onClick={() => setDragMode("pan")}>
            <ArrowsOutCardinal size={15} />
            <span>{zh ? "平移" : "Pan"}</span>
          </button>
          <button aria-pressed={dragMode === "zoom"} onClick={() => setDragMode("zoom")}>
            <SelectionPlus size={15} />
            <span>{zh ? "框选缩放" : "Box zoom"}</span>
          </button>
        </div>
        <div className="segmented" role="group" aria-label={zh ? "缩放" : "Zoom"}>
          <button aria-label={zh ? "放大" : "Zoom in"} title={zh ? "放大" : "Zoom in"} onClick={() => zoomBy(0.8)}>
            <MagnifyingGlassPlus size={15} />
          </button>
          <button aria-label={zh ? "缩小" : "Zoom out"} title={zh ? "缩小" : "Zoom out"} onClick={() => zoomBy(1.25)}>
            <MagnifyingGlassMinus size={15} />
          </button>
          <button onClick={reset} disabled={!zoomed} title={zh ? "重置视图（双击图表）" : "Reset view (double-click the plot)"}>
            <ArrowCounterClockwise size={15} />
            <span>{zh ? "重置" : "Reset"}</span>
          </button>
        </div>
        <span className="plot-hint">
          {zh ? "滚轮缩放 · 拖拽平移 · 双击复位" : "Scroll to zoom · drag to pan · double-click to reset"}
        </span>
        <div className="chart-search-slot">
          <ChartSearch
            query={state.find}
            lock={state.lock}
            candidates={candidates}
            hits={hits}
            lang={state.lang}
            onSearch={onSearch}
          />
        </div>
      </div>
      <div className="chart-shell" ref={shell}>
        <div
          ref={svgWrap}
          className={`plot${dragMode === "zoom" ? " is-zoom" : ""}${grabbing ? " is-grabbing" : ""}${hoverKey ? " is-over-point" : ""}`}
          style={{ height }}
          tabIndex={0}
          aria-describedby="chart-help"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endGesture(e)}
          onPointerCancel={(e) => endGesture(e, true)}
          onPointerLeave={() => !gesture.current && setHoverKey(null)}
          onDoubleClick={reset}
          onKeyDown={onKeyDown}
        >
          {width > 0 && (
            <ChartScene
              {...sceneBase}
              width={width}
              height={height}
              box={box}
              placements={placements}
              highlight={highlight}
              hoverKey={hoverKey}
              mobile={mobile}
              clipId={`clip-${clipId}`}
              zoomRect={zoomRect}
              ariaLabel={ariaLabel}
            />
          )}
        </div>
        <p id="chart-help" className="sr-only">
          {zh
            ? "键盘：方向键平移，加号/减号缩放，0 复位。"
            : "Keyboard: arrow keys pan, plus and minus zoom, 0 resets."}
        </p>
        {hoverCard && hoverGroup && hoverPoint && (
          <div className="point-hover-card" style={hoverCard} aria-hidden="true">
            <div className="hover-title">
              <BrandMarks point={hoverPoint} size={20} />
              <b>{[...new Set(hoverGroup.rows.map((r) => r.point.model_display))].join(" / ")}</b>
            </div>
            <div className="hover-plan">
              {displayPlan(hoverPoint.plan, state.lang)} · {accessLine(hoverPoint)}
            </div>
            {hoverGroup.rows[0]?.mapping?.variant && (
              <div className="hover-variant">
                {variantLabel(hoverGroup.rows[0].mapping.variant, state.lang)}
              </div>
            )}
            <div className="hover-stats">
              <span>
                <small>{zh ? "真实单价" : "Real price"}</small>
                {price(hoverGroup.price)} <i>/ MTok</i>
                {hoverGroup.price === 0 && <i> · {unmeteredNote(hoverPoint, state.lang)}</i>}
              </span>
              <span>
                <small>{zh ? "分数" : "Score"}</small>
                {number(hoverGroup.score, state.lang)}
                {hoverGroup.rows[0]?.mapping?.score_is_self_reported && (
                  <i> · {selfReportTag(state.lang)}</i>
                )}
              </span>
            </div>
            <div className="hover-foot">
              {hoverGroup.rows.length > 1
                ? `+${hoverGroup.rows.length - 1} ${zh ? "条参考 · " : "more references · "}`
                : ""}
              {zh ? "点击查看来源" : "Click to inspect sources"}
            </div>
          </div>
        )}
      </div>
      {cardList.length > 0 && (
        <div className="point-key" aria-label={zh ? "前沿与标注模型" : "Frontier and marked models"}>
          <div>
            {cardList.map((g, i) => (
              <button
                key={g.key}
                className={hits.keys.has(g.key) ? "is-hit" : undefined}
                style={hitStyle(g)}
                onClick={() => onSelect(g.rows)}
                onMouseEnter={() => setHoverKey(g.key)}
                onMouseLeave={() => setHoverKey(null)}
                onFocus={() => setHoverKey(g.key)}
                onBlur={() => setHoverKey(null)}
              >
                <b
                  style={{
                    background: color(g.rows[0].point),
                    color: readableInk(color(g.rows[0].point)),
                  }}
                >
                  {i + 1}
                </b>
                <BrandMarks point={g.rows[0].point} size={22} />
                <span>
                  <strong>
                    {[...new Set(g.rows.map((r) => r.point.model_display))].join(" / ")}
                  </strong>
                  <small>
                    {price(g.price)} / MTok
                    {g.price === 0 ? ` · ${unmeteredNote(g.rows[0].point, state.lang)}` : ""}
                    {" · "}
                    {number(g.score, state.lang)}
                    {g.rows[0].mapping?.score_is_self_reported ? ` · ${selfReportTag(state.lang)}` : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
