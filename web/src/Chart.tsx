import { useEffect, useRef, useState } from "react";
import type {
  Data,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import type { Row, State, SiteData } from "./types";
import { BrandMarks } from "./ProviderLogo";
import { wheelRange } from "./wheelZoom";
import {
  groups,
  pareto,
  frontierPath,
  displayPlan,
  color,
  price,
  allowance,
  number,
} from "./domain";
import {
  type ArenaPlacement,
  type FrontierLogoView,
  type PlotLayout,
  type TextLabelView,
  LOGO_SIZE,
  buildExportDecorationsFromLayout,
  cardGroups,
  frontierLogoViews,
  labelProvider,
  logoUrlMap,
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
        if (state.view === "pareto") {
          const gs = groups(rows);
          front = pareto(gs);
          const frontKeys = new Set(front.map((g) => g.key));
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
          // Non-frontier: faded small dots. Frontier: invisible hit targets under logos.
          for (const isFront of [false, true]) {
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
                size: isFront ? LOGO_SIZE : 8,
                opacity: isFront ? 0 : 0.43,
                line: { color: "#fff", width: isFront ? 0 : 1.4 },
              },
              hovertemplate: selected.map(
                (g) =>
                  `<b>${escape(g.rows[0].point.model_display)}</b><br>${escape(displayPlan(g.rows[0].point.plan, state.lang))}${g.rows.length > 1 ? ` · +${g.rows.length - 1} ${zh ? "条参考" : "references"}` : ""}<br>${price(g.price)} / MTok · ${number(g.score, state.lang)}<br>${escape(g.rows[0].mapping?.variant ?? "")}<br><i>${zh ? "点击查看来源" : "Click to inspect sources"}</i><extra></extra>`,
              ),
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

        const syncOverlay = () => {
          if (cancelled || state.view !== "pareto") {
            setLogos([]);
            setLabels([]);
            textPlacements = [];
            return;
          }
          const full = fullOf(el);
          if (!full) return;
          const logoViews = frontierLogoViews(front, full, logoMap);
          setLogos(logoViews);
          const box = plotBox(full);
          if (!box || !textGroups.length) {
            setLabels([]);
            textPlacements = [];
            return;
          }
          const anchors = new Map<string, { x: number; y: number }>();
          for (const v of logoViews) {
            if (v.inPlot) anchors.set(v.key, { x: v.x, y: v.y });
          }
          for (const g of textGroups) {
            if (anchors.has(g.key)) continue;
            const xa = full.xaxis;
            const ya = full.yaxis;
            if (!xa?.l2p || !ya?.l2p || !xa.d2l || !ya.d2l) continue;
            anchors.set(g.key, {
              x: xa._offset + xa.l2p(xa.d2l(g.price)),
              y: ya._offset + ya.l2p(ya.d2l(g.score)),
            });
          }
          textPlacements = placeTextLabels(textGroups, anchors, box, mobile);
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
        plot.removeAllListeners?.("plotly_click");
        plot.removeAllListeners?.("plotly_relayout");
        plot.removeAllListeners?.("plotly_afterplot");
        plot.on("plotly_click", (event: PlotMouseEvent) => {
          const key = event.points[0]?.customdata;
          if (typeof key === "string") {
            const selected = rowLookup.get(key);
            if (selected) selection.current(selected);
          }
        });
        plot.on("plotly_relayout", syncOverlay);
        plot.on("plotly_afterplot", syncOverlay);
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
                const anchors = new Map<string, { x: number; y: number }>();
                if (box) {
                  for (const g of [...front, ...textGroups]) {
                    const xa = exportFull.xaxis;
                    const ya = exportFull.yaxis;
                    if (!xa?.l2p || !ya?.l2p || !xa.d2l || !ya.d2l) continue;
                    anchors.set(g.key, {
                      x: xa._offset + xa.l2p(xa.d2l(g.price)),
                      y: ya._offset + ya.l2p(ya.d2l(g.score)),
                    });
                  }
                  exportText = placeTextLabels(
                    textGroups,
                    anchors,
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
                : { annotations: [], images: [] };
              await Plotly.relayout(exportHost, {
                annotations: [...baked.annotations, ...keyAnnotations],
                images: baked.images,
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
          observer.disconnect();
          plot.removeAllListeners?.("plotly_click");
          plot.removeAllListeners?.("plotly_relayout");
          plot.removeAllListeners?.("plotly_afterplot");
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
        {(logos.some((l) => l.inPlot) || labels.some((l) => l.inPlot)) && (
          <div className="arena-label-layer">
            <svg className="arena-label-leaders" aria-hidden="true">
              {labels
                .filter((c) => c.inPlot)
                .map((c) => (
                  <line
                    key={`line-${c.key}`}
                    x1={c.x0}
                    y1={c.y0}
                    x2={c.x1}
                    y2={c.y1}
                  />
                ))}
            </svg>
            {labels
              .filter((c) => c.inPlot)
              .map((c) => (
                <div
                  key={`name-${c.key}`}
                  className={`arena-name-label ${c.ax >= 0 ? "from-left" : "from-right"}`}
                  style={{ left: c.x1, top: c.y1 }}
                  aria-hidden="true"
                >
                  {c.label}
                </div>
              ))}
            {logos
              .filter((l) => l.inPlot)
              .map((l) => (
                <button
                  key={`logo-${l.key}`}
                  type="button"
                  className="arena-logo-mark"
                  style={{ left: l.x, top: l.y }}
                  title={l.label}
                  aria-label={l.label}
                  onClick={() => {
                    const selected = chartGroups.find((g) => g.key === l.key);
                    if (selected) selection.current(selected.rows);
                  }}
                >
                  {l.logoUrl ? (
                    <img src={l.logoUrl} alt="" width={20} height={20} />
                  ) : (
                    <span>{l.provider.slice(0, 2)}</span>
                  )}
                </button>
              ))}
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
