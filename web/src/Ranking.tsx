import { useEffect, useRef } from "react";
import type { Row, State } from "./types";
import type { ChartHandle } from "./Chart";
import { BrandMarks } from "./ProviderLogo";
import ResizeHandle from "./ResizeHandle";
import { useIncremental } from "./useIncremental";
import { useTheme } from "./theme";
import { dotColors } from "./palette";
import {
  accessLine,
  allowance,
  allowanceYi,
  weeklyAllowanceNote,
  barWidth,
  color,
  displayPlan,
  price,
  tableRows,
  feeBands,
  unmeteredNote,
} from "./domain";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );

export default function Ranking({
  rows,
  state,
  axis,
  highlight,
  onSelect,
  handle,
  onQuery,
}: {
  rows: Row[];
  state: State;
  axis: { low: number; high: number };
  highlight: string | null;
  onSelect: (rows: Row[]) => void;
  handle: React.RefObject<ChartHandle | null>;
  onQuery: (query: string) => void;
}) {
  const zh = state.lang === "zh",
    isPrice = state.view === "price",
    isWeekly = state.allowancePeriod === "week";
  const dark = useTheme() === "dark";
  const scrollRef = useRef<HTMLDivElement>(null);
  const sorted = tableRows(rows, {
    ...state,
    sort: isPrice ? "price" : "allowance",
    direction: isPrice ? "asc" : "desc",
  });
  const signature = sorted.map((r) => r.key).join("|");
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }, [signature, state.view, state.allowancePeriod]);
  const { limit, sentinel } = useIncremental(sorted.length, signature + state.view + state.allowancePeriod, scrollRef, 60);
  const value = (r: Row) =>
    isPrice ? r.point.real_usd_per_mtok : allowanceYi(r.point, state.allowancePeriod)!;
  const bar = (r: Row) => barWidth(value(r), axis);
  const decades = Math.round(Math.log10(axis.high / axis.low));
  const scaleNote = zh ? "对数刻度 · 每格 10 倍" : "log scale · 10× per tick";
  const formatted = (r: Row) =>
    isPrice
      ? price(value(r)) +
        (value(r) === 0 ? " · " + unmeteredNote(r.point, state.lang) : "")
      : allowance(r.point, state.lang, state.allowancePeriod);
  const unit = isPrice
    ? "USD / MTok"
    : isWeekly
      ? zh ? "token / 周等值" : "tokens / week equivalent"
      : zh ? "token / 月" : "tokens / month";
  const heading = isPrice
    ? zh
      ? "真实单价排名"
      : "Real price ranking"
    : isWeekly
      ? zh ? "每周等值额度排名" : "Weekly equivalent allowance ranking"
      : zh
        ? "月额度排名"
        : "Monthly allowance ranking";
  const band = feeBands.find((b) => b.id === state.feeBand);
  const title =
    heading +
    (!isPrice && band ? ` · ${zh ? "月费" : "Monthly fee"} ${band.label}` : "");
  const regionLabel = zh
    ? `${title}，可滚动列表`
    : `${title}, scrollable list`;
  useEffect(() => {
    handle.current = {
      download: async (format) => {
        // Dense rows keep a full ~260-row PNG under common canvas height limits.
        const bg = dark ? "#15181c" : "#ffffff";
        const ink = dark ? "#eceef1" : "#16191d";
        const muted = dark ? "#a0a8b3" : "#5b636e";
        const rule = dark ? "#262b31" : "#edf0f3";
        const track = dark ? "#23282e" : "#f0f2f5";
        const headerH = !isPrice && isWeekly ? 160 : 130;
        const width = 1100,
          rowH = sorted.length > 40 ? 54 : 86,
          height = headerH + Math.max(sorted.length, 1) * rowH;
        const scale =
          format === "png"
            ? Math.max(1, Math.min(2, Math.floor(16384 / Math.max(height, 1))))
            : 1;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/><g font-family="DM Sans, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" fill="${ink}"><text x="32" y="44" font-size="23" font-weight="600">${escape(title)}</text><text x="32" y="72" font-size="12" fill="${muted}">${escape(`${sorted.length} ${zh ? "条筛选结果" : "filtered rows"} · ${unit} · ${zh ? "条形为对数刻度，每格 10 倍" : "Bars use a logarithmic scale, 10× per tick"} · Real API Pricing`)}</text>${sorted
          .map((r, i) => {
            const y = headerH - 18 + i * rowH;
            const titleSize = rowH < 70 ? 14 : 16,
              metaSize = rowH < 70 ? 11 : 12,
              valueSize = rowH < 70 ? 16 : 18;
            const fill = dotColors(color(r.point), dark).fill;
            return `<text x="32" y="${y}" fill="${muted}" font-size="13">${i + 1}</text><text x="75" y="${y}" font-size="${titleSize}" font-weight="600">${escape(r.point.model_display)}</text><text x="75" y="${y + 20}" font-size="${metaSize}" fill="${muted}">${escape(displayPlan(r.point.plan, state.lang) + " · " + accessLine(r.point))}</text><rect x="580" y="${y - 9}" width="280" height="7" rx="3.5" fill="${track}"/><rect x="580" y="${y - 9}" width="${bar(r) * 2.8}" height="7" rx="3.5" fill="${fill}"/>${Array.from({ length: decades - 1 }, (_, k) => `<line x1="${580 + (280 * (k + 1)) / decades}" x2="${580 + (280 * (k + 1)) / decades}" y1="${y - 11}" y2="${y}" stroke="${muted}" stroke-opacity="0.35"/>`).join("")}<text x="1068" y="${y}" text-anchor="end" font-size="${valueSize}" font-weight="600">${escape(formatted(r))}</text><line x1="32" x2="1068" y1="${y + Math.min(40, rowH - 12)}" y2="${y + Math.min(40, rowH - 12)}" stroke="${rule}"/>`;
          })
          .join("")}${!isPrice && isWeekly ? `<text x="32" y="97" font-size="12" fill="${muted}">${escape(weeklyAllowanceNote(state.lang))}</text>` : ""}</g></svg>`;
        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        let url = URL.createObjectURL(blob);
        try {
          if (format === "png") {
            const img = new Image();
            img.src = url;
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext("2d")!;
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            const png = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (b) =>
                  b ? resolve(b) : reject(new Error("PNG export failed")),
                "image/png",
              ),
            );
            URL.revokeObjectURL(url);
            url = URL.createObjectURL(png);
          }
          const link = document.createElement("a");
          link.href = url;
          link.download = `real-api-pricing-${state.view}-${state.lang}${!isPrice ? `${isWeekly ? "-week" : ""}-fee-${state.feeBand}` : ""}.${format}`;
          link.click();
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      },
    };
    return () => {
      handle.current = null;
    };
  });
  return (
    <section className="web-ranking" aria-label={title}>
      <div
        className="ranking-scroll"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={regionLabel}
      >
        <div className="ranking-columns" aria-hidden={sorted.length === 0}>
          <span>#</span>
          <span>{zh ? "模型 · 套餐与渠道" : "Model · plan & channel"}</span>
          <span>
            {(isPrice
              ? zh
                ? "由低到高"
                : "Cheapest first"
              : zh
                ? "由多到少"
                : "Largest first") +
              " · " +
              scaleNote}
          </span>
          <span>{unit}</span>
        </div>
        {sorted.length ? (
          <>
            {sorted.slice(0, limit).map((r, i) => {
              const fill = dotColors(color(r.point), dark).fill;
              const faded = highlight !== null && r.point.channel !== highlight;
              return (
                <button
                  className={`ranking-row${faded ? " is-faded" : ""}`}
                  key={r.key}
                  onClick={() => onSelect([r])}
                >
                  <span className="rank-number">{i + 1}</span>
                  <span className="rank-identity">
                    <strong className="model-with-logo">
                      <BrandMarks point={r.point} size={24} />
                      <span className="model-name">
                        {r.point.model_display}
                        <span className="rank-plan">
                          {displayPlan(r.point.plan, state.lang)}
                        </span>
                      </span>
                    </strong>
                    <small>
                      <i style={{ background: fill }} />
                      {accessLine(r.point)}
                    </small>
                  </span>
                  <span
                    className="rank-bar"
                    aria-hidden="true"
                    style={{ "--decade": `${100 / decades}%` } as React.CSSProperties}
                  >
                    <span style={{ width: `${bar(r)}%`, background: fill }} />
                  </span>
                  <span className="rank-value">
                    <strong>
                      {isPrice ? price(value(r)) : allowance(r.point, state.lang, state.allowancePeriod)}
                    </strong>
                    <small>
                      {isPrice
                        ? r.point.billing === "metered"
                          ? zh
                            ? "按量计费"
                            : "Pay as you go"
                          : r.point.monthly_yi === null
                            ? unmeteredNote(r.point, state.lang) +
                              " · " +
                              price(r.point.price_usd) +
                              (zh ? " / 月" : " / mo")
                            : allowance(r.point, state.lang, state.allowancePeriod) +
                              (isWeekly
                                ? zh ? " token / 周等值" : " tokens / week eq."
                                : zh ? " token / 月" : " tokens / mo")
                        : price(r.point.price_usd) + (zh ? " / 月" : " / mo")}
                    </small>
                  </span>
                </button>
              );
            })}
            {limit < sorted.length && (
              <div className="sentinel-row" aria-hidden="true">
                <span ref={(el) => void (sentinel.current = el)}>
                  {zh ? "正在加载更多…" : "Loading more…"}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="empty">
            <h3>{zh ? "没有匹配的结果" : "No matching results"}</h3>
            <button onClick={() => onQuery("")}>
              {zh ? "清除搜索" : "Clear search"}
            </button>
          </div>
        )}
      </div>
      <ResizeHandle
        target={scrollRef}
        label={
          zh
            ? "拖动调整列表高度，双击恢复"
            : "Drag to resize the list · double-click to reset"
        }
      />
      <small className="ranking-scale-note" aria-hidden="true">
        {scaleNote}
      </small>
    </section>
  );
}
