import { useEffect, useRef, useState } from "react";
import type {
  Data,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import type { Group, Row, State, SiteData } from "./types";
import { BrandMarks, logoUrlMap } from "./ProviderLogo";
import { wheelRange } from "./wheelZoom";
import {
  groups,
  pareto,
  frontierPath,
  displayPlan,
  accessLine,
  color,
  price,
  allowance,
  number,
} from "./domain";
import {
  type AnchorPoint,
  type ArenaPlacement,
  type FrontierLogoView,
  type PlotBox,
  type PlotLayout,
  type TextLabelView,
  DOT_RADIUS,
  FRONTIER_RADIUS,
  buildExportDecorationsFromLayout,
  cardGroups,
  dataToPixel,
  frontierLogoViews,
  labelProvider,
  placeTextLabels,
  plotBox,
  textLabelGroups,
  textLabelViews,
} from "./chartLabels";

export interface ChartHandle {
  download: (format: "png" | "svg") => Promise<void>;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export default function Chart({
  rows,
  state,
  data,
  onSelect,
  handle,
}: {
  rows: Row[];
  state: State;
  data: SiteData;
  onSelect: (rows: Row[]) => void;
  handle: React.RefObject<ChartHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const controls = useRef<{
    mode: (mode: "pan" | "zoom") => void;
    reset: () => void;
  } | null>(null);
  const [dragMode, setDragMode] = useState<"pan" | "zoom">("pan");
  const [logos, setLogos] = useState<FrontierLogoView[]>([]);
  const [labels, setLabels] = useState<TextLabelView[]>([]);
  const [area, setArea] = useState<PlotBox | null>(null);
  const [hover, setHover] = useState<{
    key: string;
    x: number;
    y: number;
    front: boolean;
  } | null>(null);
  const chartGroups = state.view === "pareto" ? groups(rows) : [];
  const frontGroups =
    state.view === "pareto" ? pareto(chartGroups) : [];
  const cardList =
    state.view === "pareto"
      ? cardGroups(chartGroups, frontGroups, state.labels)
      : [];
  const [small, setSmall] = useState(() => window.innerWidth <= 700);
  useEffect(() => {
    const media = window.matchMedia("(max-width:700px)");
    const change = () => setSmall(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const zh = state.lang === "zh";
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    const el = host.current;
    if (!el) return;
    setLoading(true);
    setError("");
    setLogos([]);
    setLabels([]);
    setHover(null);
    import("plotly.js-basic-dist-min")
      .then(async ({ default: Plotly }) => {
        if (cancelled) return;
        const width = el.clientWidth;
        const mobile = width < 600;
        let traces: Data[] = [];
        let layout: Partial<Layout> = {
          font: {
            family:
              "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            size: 12,
            color: "#737780",
          },
          paper_bgcolor: "#fff",
          plot_bgcolor: "#fff",
          margin: { l: mobile ? 50 : 68, r: mobile ? 22 : 48, t: 48, b: 65 },
          showlegend: false,
          hovermode: "closest",
          dragmode: "pan",
          hoverlabel: {
            bgcolor: "#fff",
            bordercolor: "#e1e4e8",
            font: { color: "#20242a", size: 12 },
          },
          height: mobile ? 470 : 540,
        };
        const rowLookup = new Map<string, Row[]>();
        let front: ReturnType<typeof pareto> = [];
        let textGroups: ReturnType<typeof textLabelGroups> = [];
        let logoMap = new Map<string, string>();
        let textPlacements: ArenaPlacement[] = [];
        let plotted: Group[] = [];
        let frontKeys = new Set<string>();
        if (state.view === "pareto") {
          const gs = groups(rows);
          front = pareto(gs);
          plotted = gs;
          frontKeys = new Set(front.map((g) => g.key));
          textGroups = textLabelGroups(gs, front, state.labels);
          logoMap = await logoUrlMap(front.map((g) => labelProvider(g)));
          if (cancelled) return;
          const prices = gs.map((g) => g.price);
          const lo = prices.length ? Math.log10(Math.min(...prices)) : -3,
            hi = prices.length ? Math.log10(Math.max(...prices)) : 1;
          const pad = Math.max((hi - lo) * 0.08, 0.2);
          const xmin = 10 ** (lo - pad),
            xmax = 10 ** (hi + pad);
          if (state.frontier && front.length) {
            const line = frontierPath(front, xmin, xmax);
            traces.push({
              type: "scatter",
              mode: "lines",
              x: line.x,
              y: line.y,
              line: { color: "#282b32", width: 1.6 },
              hoverinfo: "skip",
            });
          }
          // Frontier first: invisible hit targets under the logos. Plotly keeps
          // the earliest trace when two points tie on hover distance, and its
          // distance floor (1 - 3/radius) favours small markers, so these must
          // match the dot radius or a neighbouring dot would steal the hover.
          for (const isFront of [true, false]) {
            const selected = gs.filter((g) => frontKeys.has(g.key) === isFront);
            for (const g of selected) rowLookup.set(g.key, g.rows);
            traces.push({
              type: "scatter",
              mode: "markers",
              x: selected.map((g) => g.price),
              y: selected.map((g) => g.score),
              customdata: selected.map((g) => g.key),
              marker: {
                color: selected.map((g) => color(g.rows[0].point)),
                size: 8,
                opacity: isFront ? 0 : 0.43,
                line: { color: "#fff", width: isFront ? 0 : 1.4 },
              },
              // Hover text is our own card: keep the events, drop Plotly's label.
              hoverinfo: "none",
            });
          }
          layout.xaxis = {
            type: "log",
            range: [hi + pad, lo - pad],
            title: {
              text: zh
                ? "真实单价 · USD / 百万 token     → 更便宜"
                : "Real price · USD / million tokens     → Less expensive",
              font: { size: 12 },
            },
            gridcolor: "#f0f1f3",
            zeroline: false,
            tickprefix: "$",
            tickformat: ".3~g",
            ticks: "",
            fixedrange: false,
          };
          layout.yaxis = {
            title: {
              text: data.boards[state.board].metric,
              font: { size: 12 },
            },
            gridcolor: "#eaecf0",
            zeroline: false,
            ticks: "",
            automargin: true,
          };
          if (front.length || textGroups.length) {
            layout.margin = {
              ...layout.margin,
              t: mobile ? 56 : 64,
              r: mobile ? 36 : 64,
              l: mobile ? 52 : 72,
            };
          }
        } else {
          const sorted = [...rows].sort((a, b) =>
            state.view === "price"
              ? a.point.real_usd_per_mtok - b.point.real_usd_per_mtok
              : (b.point.monthly_yi ?? 0) - (a.point.monthly_yi ?? 0),
          );
          const vals = sorted.map((r) =>
            state.view === "price"
              ? r.point.real_usd_per_mtok
              : (r.point.monthly_yi ?? 0) / (zh ? 1 : 10),
          );
          const min = vals.length ? Math.min(...vals) : 1;
          const max = vals.length ? Math.max(...vals) : 10;
          for (const r of sorted) rowLookup.set(r.key, [r]);
          const ticks = sorted.map(
            (r, i) =>
              `${i + 1}. ${escape(r.point.model_display)} · ${escape(displayPlan(r.point.plan, state.lang))}`,
          );
          traces = [
            {
              type: "bar",
              orientation: "h",
              x: vals,
              y: sorted.map((r) => r.key),
              customdata: sorted.map((r) => r.key),
              marker: {
                color: sorted.map((r) => color(r.point)),
                opacity: 0.88,
              },
              text: sorted.map(
                (r) =>
                  (state.view === "price"
                    ? price(r.point.real_usd_per_mtok)
                    : allowance(r.point, state.lang)) +
                  " · " +
                  r.point.channel,
              ),
              textposition: "outside",
              cliponaxis: false,
              hovertemplate: sorted.map(
                (r) =>
                  `<b>${escape(r.point.model_display)}</b><br>${escape(displayPlan(r.point.plan, state.lang))}<br>${state.view === "price" ? price(r.point.real_usd_per_mtok) + " / MTok" : allowance(r.point, state.lang) + " tokens"}<extra></extra>`,
              ),
            },
          ];
          layout = {
            ...layout,
            height: Math.max(470, sorted.length * 33 + 110),
            margin: {
              l: mobile ? 170 : 330,
              r: mobile ? 95 : 165,
              t: 26,
              b: 65,
            },
            bargap: 0.36,
            xaxis: {
              type: "log",
              range: [Math.log10(min) - 0.15, Math.log10(max) + 0.35],
              side: "top",
              gridcolor: "#f0f1f3",
              title: {
                text:
                  state.view === "price"
                    ? "USD / MTok"
                    : zh
                      ? "月额度 · 亿 token"
                      : "Monthly allowance · billion tokens",
              },
            },
            yaxis: {
              autorange: "reversed",
              tickvals: sorted.map((r) => r.key),
              ticktext: ticks,
              tickfont: { size: 11 },
              automargin: false,
            },
          };
        }
        const initialX = {
          ...layout.xaxis,
          range: [...(layout.xaxis?.range ?? [])],
        };
        const initialY = { ...layout.yaxis };
        await Plotly.react(el, traces, layout, {
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: [
            "select2d",
            "lasso2d",
            "toImage",
            "autoScale2d",
            "zoom2d",
            "pan2d",
            "resetScale2d",
          ],
          scrollZoom: false,
          displaylogo: false,
        });
        if (cancelled) return;
        const plot = el as unknown as PlotlyHTMLElement;
        const fullOf = (node: HTMLElement) =>
          (node as unknown as { _fullLayout?: PlotLayout })._fullLayout;

        /**
         * Reproject the overlay onto the current axis ranges. `resolve` re-runs
         * the collision solver; during a drag we keep the chosen slots so the
         * names travel with their points instead of jumping around.
         */
        const syncOverlay = (resolve = true) => {
          if (cancelled || state.view !== "pareto") {
            setLogos([]);
            setLabels([]);
            setArea(null);
            textPlacements = [];
            return;
          }
          const full = fullOf(el);
          if (!full) return;
          const box = plotBox(full);
          setArea(box);
          setLogos(frontierLogoViews(front, full, logoMap));
          if (!box || !textGroups.length) {
            setLabels([]);
            textPlacements = [];
            return;
          }
          if (resolve) {
            const anchors = new Map<string, AnchorPoint>();
            const markers: AnchorPoint[] = [];
            for (const g of plotted) {
              const pt = dataToPixel(full, g.price, g.score, box);
              if (!pt) continue;
              const marker = {
                key: g.key,
                x: pt.x,
                y: pt.y,
                r: frontKeys.has(g.key) ? FRONTIER_RADIUS : DOT_RADIUS,
              };
              markers.push(marker);
              anchors.set(g.key, marker);
            }
            textPlacements = placeTextLabels(
              textGroups,
              anchors,
              markers,
              box,
              mobile,
            );
          }
          setLabels(textLabelViews(textPlacements, full));
        };

        setDragMode("pan");
        controls.current = {
          mode: (mode) => {
            void Plotly.relayout(el, { dragmode: mode });
            setDragMode(mode);
          },
          reset: () => {
            void Plotly.relayout(el, {
              xaxis: { ...initialX },
              yaxis: {
                ...initialY,
                autorange: state.view === "pareto" ? true : "reversed",
              },
            });
          },
        };
        for (const event of [
          "plotly_click",
          "plotly_relayout",
          "plotly_relayouting",
          "plotly_afterplot",
          "plotly_hover",
          "plotly_unhover",
        ])
          plot.removeAllListeners?.(event);
        plot.on("plotly_click", (event: PlotMouseEvent) => {
          const key = event.points[0]?.customdata;
          if (typeof key === "string") {
            const selected = rowLookup.get(key);
            if (selected) selection.current(selected);
          }
        });
        plot.on("plotly_hover", (event: PlotMouseEvent) => {
          const point = event.points[0];
          const key = point?.customdata;
          if (typeof key !== "string" || state.view !== "pareto") return;
          const full = fullOf(el);
          const box = full && plotBox(full);
          const pt =
            full && box
              ? dataToPixel(full, Number(point.x), Number(point.y), box)
              : null;
          if (pt) setHover({ key, x: pt.x, y: pt.y, front: frontKeys.has(key) });
        });
        plot.on("plotly_unhover", () => setHover(null));
        plot.on("plotly_relayout", () => {
          setHover(null);
          syncOverlay();
        });
        plot.on("plotly_afterplot", () => syncOverlay());
        // Fired continuously while dragging or wheel-zooming: keep the overlay
        // glued to the plot instead of catching up after the gesture ends.
        let dragFrame = 0;
        plot.on("plotly_relayouting", () => {
          setHover(null);
          if (dragFrame) return;
          dragFrame = requestAnimationFrame(() => {
            dragFrame = 0;
            syncOverlay(false);
          });
        });
        syncOverlay();
        const shell = el.parentElement!;
        let wheelFrame = 0;
        let pendingRanges: { x: [number, number]; y: [number, number] } | null = null;
        const wheel = (event: WheelEvent) => {
          if (state.view !== "pareto" || cancelled) return;
          const full = fullOf(el);
          const box = full && plotBox(full);
          if (!box || !full?.xaxis?.range || !full.yaxis?.range) return;
          const rect = el.getBoundingClientRect();
          const px = event.clientX - rect.left, py = event.clientY - rect.top;
          // Leave page scrolling untouched over axes, toolbar, cards and outside the plot.
          if (px < box.left || px > box.right || py < box.top || py > box.bottom) return;
          event.preventDefault();
          const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1);
          if (!delta) return;
          const ranges = pendingRanges ?? { x: full.xaxis.range, y: full.yaxis.range };
          pendingRanges = {
            x: wheelRange(ranges.x, (px - box.left) / box.width, delta),
            y: wheelRange(ranges.y, 1 - (py - box.top) / box.height, delta),
          };
          if (!wheelFrame) wheelFrame = requestAnimationFrame(() => {
            wheelFrame = 0;
            const next = pendingRanges;
            pendingRanges = null;
            if (!cancelled && next) void Plotly.relayout(el, {
              "xaxis.range": next.x, "yaxis.range": next.y,
              "xaxis.autorange": false, "yaxis.autorange": false,
            });
          });
        };
        shell.addEventListener("wheel", wheel, { passive: false });
        handle.current = {
          download: async (format) => {
            const exportHost = document.createElement("div");
            exportHost.style.cssText =
              "position:fixed;left:-20000px;top:0;width:1200px;";
            document.body.appendChild(exportHost);
            const exportCards =
              state.view === "pareto"
                ? cardGroups(groups(rows), pareto(groups(rows)), state.labels)
                : [];
            const extraHeight = exportCards.length
              ? 50 + exportCards.length * 22
              : 0;
            // Plotly mutates the supplied layout during responsive relayouts.
            // Use a fixed export plot height instead of reading that mutable value.
            const exportPlotHeight = state.view === "pareto" ? 540 : Number(layout.height ?? 540);
            const exportHeight = exportPlotHeight + extraHeight;
            const exportMargin = {
              l: Number(layout.margin?.l ?? 68),
              r: Number(layout.margin?.r ?? 48),
              t: Number(layout.margin?.t ?? 48),
              b: Number(layout.margin?.b ?? 65) + extraHeight,
            };
            const plotHeight =
              exportPlotHeight -
              Number(layout.margin?.t ?? 48) -
              Number(layout.margin?.b ?? 65);
            const keyAnnotations = exportCards.map((g, i) => ({
              xref: "paper" as const,
              yref: "paper" as const,
              x: 0,
              y: -(85 + i * 22) / plotHeight,
              xanchor: "left" as const,
              yanchor: "top" as const,
              showarrow: false,
              text: escape(
                `${i + 1}. ${[...new Set(g.rows.map((r) => r.point.model_display))].join(" / ")} · ${price(g.price)} / MTok · ${number(g.score, state.lang)}`,
              ),
              font: { size: 12, color: "#303740" },
            }));
            try {
              await Plotly.newPlot(
                exportHost,
                traces,
                {
                  ...plot.layout,
                  width: 1200,
                  height: exportHeight,
                  margin: exportMargin,
                  annotations: [],
                  images: [],
                },
                { staticPlot: true },
              );
              const exportFull = fullOf(exportHost);
              let exportText: ArenaPlacement[] = [];
              if (exportFull && textGroups.length) {
                const box = plotBox(exportFull);
                if (box) {
                  const anchors = new Map<string, AnchorPoint>();
                  const markers: AnchorPoint[] = [];
                  for (const g of plotted) {
                    const pt = dataToPixel(exportFull, g.price, g.score, box);
                    if (!pt) continue;
                    const marker = {
                      key: g.key,
                      x: pt.x,
                      y: pt.y,
                      r: frontKeys.has(g.key) ? FRONTIER_RADIUS : DOT_RADIUS,
                    };
                    markers.push(marker);
                    anchors.set(g.key, marker);
                  }
                  exportText = placeTextLabels(
                    textGroups,
                    anchors,
                    markers,
                    box,
                    false,
                  );
                }
              }
              const baked = exportFull
                ? buildExportDecorationsFromLayout(
                    front,
                    exportText,
                    logoMap,
                    exportFull,
                    false,
                  )
                : { annotations: [], images: [], shapes: [] };
              await Plotly.relayout(exportHost, {
                annotations: [...baked.annotations, ...keyAnnotations],
                images: baked.images,
                shapes: baked.shapes,
              });
              await Plotly.downloadImage(exportHost, {
                format,
                filename: `real-api-pricing-${state.view}-${state.board}-${state.lang}`,
                width: 1200,
                height: exportHeight,
              });
            } finally {
              Plotly.purge(exportHost);
              exportHost.remove();
            }
          },
        };
        const observer = new ResizeObserver(() => {
          if (!cancelled) {
            void Plotly.Plots.resize(el);
            syncOverlay();
          }
        });
        observer.observe(el);
        cleanup = () => {
          shell.removeEventListener("wheel", wheel);
          cancelAnimationFrame(wheelFrame);
          cancelAnimationFrame(dragFrame);
          observer.disconnect();
          for (const event of [
            "plotly_click",
            "plotly_relayout",
            "plotly_relayouting",
            "plotly_afterplot",
            "plotly_hover",
            "plotly_unhover",
          ])
            plot.removeAllListeners?.(event);
        };
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      cleanup();
      handle.current = null;
      controls.current = null;
      setLogos([]);
      setLabels([]);
      setHover(null);
    };
  }, [
    rows,
    state.view,
    state.board,
    state.lang,
    state.frontier,
    state.labels,
    data,
    handle,
    small,
  ]);
  const hoverGroup = hover
    ? chartGroups.find((g) => g.key === hover.key)
    : undefined;
  const hoverPoint = hoverGroup?.rows[0]?.point;
  // Approximate box used only to decide which side of the point the card opens.
  const CARD_WIDTH = 246;
  const CARD_HEIGHT = 146;
  const hoverCard =
    hover && area && hoverGroup
      ? (() => {
          const gap = (hover.front ? FRONTIER_RADIUS : DOT_RADIUS) + 10;
          const right = hover.x + gap;
          const below = hover.y + gap;
          const left =
            right + CARD_WIDTH > area.right - 4
              ? hover.x - gap - CARD_WIDTH
              : right;
          const top =
            below + CARD_HEIGHT > area.bottom - 4
              ? hover.y - gap - CARD_HEIGHT
              : below;
          return {
            left: Math.max(4, Math.min(left, area.right - CARD_WIDTH - 4)),
            top: Math.max(4, Math.min(top, area.bottom - CARD_HEIGHT - 4)),
          };
        })()
      : null;
  return (
    <>
      <div
        className="plot-controls"
        aria-label={zh ? "图表操作" : "Chart navigation"}
      >
        <button
          aria-pressed={dragMode === "zoom"}
          onClick={() => controls.current?.mode("zoom")}
        >
          {zh ? "框选缩放" : "Box zoom"}
        </button>
        <button
          aria-pressed={dragMode === "pan"}
          onClick={() => controls.current?.mode("pan")}
        >
          {zh ? "拖拽平移" : "Pan"}
        </button>
        <button onClick={() => controls.current?.reset()}>
          {zh ? "重置视图" : "Reset view"}
        </button>
        <span>
          {zh
              ? "绘图区内滚轮精细缩放 · 框选放大 · 双击或重置视图复位"
              : "Scroll inside the plot for precise zoom · Box zoom · Double-click or Reset view to restore"}
        </span>
      </div>
      <div
        className={`chart-shell ${state.view !== "pareto" ? "ranking-chart" : ""}`}
        aria-label={zh ? "交互数据图表" : "Interactive data chart"}
      >
        <div ref={host} className="plot" />
        {(logos.some((l) => l.inPlot) ||
          labels.some((l) => l.inPlot) ||
          hover) && (
          <div className="arena-label-layer" aria-hidden="true">
            <svg className="arena-label-leaders">
              {labels
                .filter((c) => c.inPlot && c.lead)
                .map((c) => (
                  <line
                    key={`line-${c.key}`}
                    x1={c.lead!.x1}
                    y1={c.lead!.y1}
                    x2={c.lead!.x2}
                    y2={c.lead!.y2}
                  />
                ))}
            </svg>
            {labels
              .filter((c) => c.inPlot)
              .map((c) => (
                <div
                  key={`name-${c.key}`}
                  className={`arena-name-label${hover?.key === c.key ? " is-hovered" : ""}`}
                  style={{ left: c.left, top: c.top, maxWidth: c.width }}
                >
                  {c.label}
                </div>
              ))}
            {hover && !hover.front && hoverPoint && (
              <span
                className="point-halo"
                style={{
                  left: hover.x,
                  top: hover.y,
                  background: color(hoverPoint),
                }}
              />
            )}
            {logos
              .filter((l) => l.inPlot)
              .map((l) => (
                <span
                  key={`logo-${l.key}`}
                  className={`arena-logo-mark${hover?.key === l.key ? " is-hovered" : ""}`}
                  style={{ left: l.x, top: l.y }}
                >
                  {l.logoUrl ? (
                    <img src={l.logoUrl} alt="" width={20} height={20} />
                  ) : (
                    <span>{l.provider.slice(0, 2)}</span>
                  )}
                </span>
              ))}
          </div>
        )}
        {hoverCard && hoverGroup && hoverPoint && (
          <div className="point-hover-card" style={hoverCard} aria-hidden="true">
            <div className="hover-title">
              <BrandMarks point={hoverPoint} />
              <b>
                {[
                  ...new Set(hoverGroup.rows.map((r) => r.point.model_display)),
                ].join(" / ")}
              </b>
            </div>
            <div className="hover-plan">
              {displayPlan(hoverPoint.plan, state.lang)} ·{" "}
              {accessLine(hoverPoint)}
            </div>
            {hoverGroup.rows[0]?.mapping?.variant && (
              <div className="hover-variant">
                {hoverGroup.rows[0].mapping.variant}
              </div>
            )}
            <div className="hover-stats">
              <span>
                <small>{zh ? "真实单价" : "Real price"}</small>
                {price(hoverGroup.price)} <i>/ MTok</i>
              </span>
              <span>
                <small>{zh ? "分数" : "Score"}</small>
                {number(hoverGroup.score, state.lang)}
              </span>
            </div>
            <div className="hover-foot">
              {hoverGroup.rows.length > 1
                ? `+${hoverGroup.rows.length - 1} ${zh ? "条参考 · " : "references · "}`
                : ""}
              {zh ? "点击查看来源" : "Click to inspect sources"}
            </div>
          </div>
        )}
        {loading && (
          <div className="chart-loading">
            {zh ? "正在绘制数据…" : "Drawing the data…"}
          </div>
        )}
        {error && (
          <div className="empty" role="alert">
            {zh
              ? "图表暂时无法绘制，仍可查看下方数据。"
              : "Chart could not render. The data table is still available."}
            <small>{error}</small>
          </div>
        )}
      </div>
      {cardList.length > 0 && (
        <div
          className="point-key"
          aria-label={zh ? "模型卡片" : "Model cards"}
        >
          <p>
            {zh
              ? "前沿点以厂商 Logo 标在坐标上；旁注为模型名。下方卡片可点开对应套餐与来源。"
              : "Frontier points are manufacturer logos on their coordinates; side notes are model names. Cards below open plans and sources."}
          </p>
          <div>
            {cardList.map((g, i) => (
              <button key={g.key} onClick={() => selection.current(g.rows)}>
                <b style={{ background: color(g.rows[0].point) }}>{i + 1}</b>
                <span>
                  <BrandMarks point={g.rows[0].point} />
                  {[...new Set(g.rows.map((r) => r.point.model_display))].join(
                    " / ",
                  )}
                  <small>
                    {price(g.price)} / MTok · {number(g.score, state.lang)}
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
