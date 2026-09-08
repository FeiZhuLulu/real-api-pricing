import { useEffect, useRef } from "react";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import type { Row, State } from "./types";
import type { ChartHandle } from "./Chart";
import { BrandMarks } from "./ProviderLogo";
import {
  accessLine,
  allowance,
  color,
  displayPlan,
  price,
  tableRows,
  feeBands,
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
  onSelect,
  handle,
  onQuery,
}: {
  rows: Row[];
  state: State;
  onSelect: (rows: Row[]) => void;
  handle: React.RefObject<ChartHandle | null>;
  onQuery: (query: string) => void;
}) {
  const zh = state.lang === "zh",
    isPrice = state.view === "price";
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
  }, [signature, state.view]);
  const value = (r: Row) =>
    isPrice ? r.point.real_usd_per_mtok : r.point.monthly_yi!;
  const values = sorted.map(value),
    low = values.length ? Math.min(...values) : 0,
    high = values.length ? Math.max(...values) : 0;
  const bar = (r: Row) =>
    high === low
      ? 100
      : 8 +
        (92 * (Math.log10(value(r)) - Math.log10(low))) /
          (Math.log10(high) - Math.log10(low));
  const formatted = (r: Row) =>
    isPrice ? price(value(r)) : allowance(r.point, state.lang);
  const unit = isPrice ? "USD / MTok" : zh ? "token / 月" : "tokens / month";
  const heading = isPrice
    ? zh
      ? "真实单价排名"
      : "Real price ranking"
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
        // Dense rows keep a full ~188-row PNG under common canvas height limits.
        const width = 1100,
          rowH = sorted.length > 40 ? 54 : 86,
          height = 130 + Math.max(sorted.length, 1) * rowH;
        const scale =
          format === "png"
            ? Math.max(1, Math.min(2, Math.floor(16384 / Math.max(height, 1))))
            : 1;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, Microsoft YaHei, sans-serif" fill="#20262e"><text x="32" y="40" font-size="23">${escape(title)}</text><text x="32" y="68" font-size="12" fill="#687382">${escape(`${sorted.length} ${zh ? "条筛选结果" : "filtered rows"} · ${unit} · ${zh ? "条形为对数刻度" : "Bars use a logarithmic scale"}`)}</text>${sorted
          .map((r, i) => {
            const y = 110 + i * rowH;
            const titleSize = rowH < 70 ? 14 : 16,
              metaSize = rowH < 70 ? 11 : 12,
              valueSize = rowH < 70 ? 16 : 18;
            return `<text x="32" y="${y}" fill="#7a8490" font-size="14">${i + 1}</text><text x="75" y="${y}" font-size="${titleSize}">${escape(r.point.model_display)}</text><text x="75" y="${y + 22}" font-size="${metaSize}" fill="#687382">${escape(displayPlan(r.point.plan, state.lang) + " · " + accessLine(r.point))}</text><rect x="580" y="${y - 9}" width="${bar(r) * 2.8}" height="7" rx="3" fill="${color(r.point)}"/><text x="1068" y="${y}" text-anchor="end" font-size="${valueSize}">${escape(formatted(r))}</text><line x1="32" x2="1068" y1="${y + Math.min(44, rowH - 10)}" y2="${y + Math.min(44, rowH - 10)}" stroke="#edf0f3"/>`;
          })
          .join("")}</g></svg>`;
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
          link.download = `real-api-pricing-${state.view}-${state.lang}${!isPrice ? `-fee-${state.feeBand}` : ""}.${format}`;
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
      <div className="ranking-toolbar">
        <div>
          <strong>
            {zh ? "逐项比较，一目了然" : "Compare the numbers, row by row."}
          </strong>
          <p>
            {isPrice
              ? zh
                ? "单价由低到高，越低越便宜。"
                : "Lowest price first. Lower is less expensive."
              : zh
                ? "额度由高到低，越高可用量越多。"
                : "Largest allowance first. Higher means more tokens."}{" "}
            {zh ? "条形使用对数刻度。" : "Bars use a logarithmic scale."}
          </p>
        </div>
        <label className="ranking-search">
          <MagnifyingGlass size={18} />
          <input
            aria-label={zh ? "搜索排名" : "Search ranking"}
            placeholder={
              zh ? "搜索模型、套餐或渠道…" : "Search model, plan or channel…"
            }
            value={state.query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
      </div>
      <div
        className="ranking-scroll"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={regionLabel}
      >
        <div className="ranking-columns" aria-hidden={sorted.length === 0}>
          <span>#</span>
          <span>{zh ? "模型 / 套餐与渠道" : "Model / plan & channel"}</span>
          <span>
            {zh ? "数值对比 · 对数刻度" : "Comparison · logarithmic scale"}
          </span>
          <span>{unit}</span>
          <span />
        </div>
        {sorted.length ? (
          sorted.map((r, i) => (
            <button
              className="ranking-row"
              key={r.key}
              onClick={() => onSelect([r])}
            >
              <span className="rank-number">{i + 1}</span>
              <span className="rank-identity">
                <strong className="model-with-logo">
                  <BrandMarks point={r.point} />
                  {r.point.model_display}
                </strong>
                <span>{displayPlan(r.point.plan, state.lang)}</span>
                <small>
                  <i style={{ background: color(r.point) }} />
                  {accessLine(r.point)} ·{" "}
                  {r.point.billing === "metered"
                    ? "API"
                    : zh
                      ? "订阅"
                      : "Subscription"}
                </small>
              </span>
              <span className="rank-bar" aria-hidden="true">
                <span
                  style={{ width: `${bar(r)}%`, background: color(r.point) }}
                />
              </span>
              <span className="rank-value">
                <strong>{formatted(r)}</strong>
                <small>
                  {isPrice
                    ? r.point.monthly_yi === null
                      ? zh
                        ? "按量计费"
                        : "Pay as you go"
                      : allowance(r.point, state.lang) +
                        (zh ? " token / 月" : " tokens / mo")
                    : price(r.point.price_usd) + (zh ? " / 月" : " / mo")}
                </small>
              </span>
              <ArrowRight className="rank-arrow" size={17} />
            </button>
          ))
        ) : (
          <div className="empty">
            <h3>{zh ? "没有匹配的结果" : "No matching results"}</h3>
            <button onClick={() => onQuery("")}>
              {zh ? "清除搜索" : "Clear search"}
            </button>
          </div>
        )}
      </div>
      <div className="ranking-status">
        {sorted.length}{" "}
        {zh
          ? "条筛选结果 · 列表内滚动浏览 · 图片导出全部筛选行"
          : "filtered rows · scroll inside the list · image export includes all filtered rows"}
      </div>
    </section>
  );
}
