import { useEffect, useState } from "react";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
} from "@phosphor-icons/react";
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
  const [page, setPage] = useState(0);
  const sorted = tableRows(rows, {
    ...state,
    sort: isPrice ? "price" : "allowance",
    direction: isPrice ? "asc" : "desc",
  });
  const signature = sorted.map((r) => r.key).join("|");
  useEffect(() => setPage(0), [signature, state.view]);
  const pages = Math.max(1, Math.ceil(sorted.length / 15));
  const current = Math.min(page, pages - 1),
    offset = current * 15,
    visible = sorted.slice(offset, offset + 15);
  const value = (r: Row) =>
    isPrice ? r.point.real_usd_per_mtok : r.point.monthly_yi!;
  const values = sorted.map(value),
    low = Math.min(...values),
    high = Math.max(...values);
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
  useEffect(() => {
    handle.current = {
      download: async (format) => {
        const width = 1100,
          height = 150 + visible.length * 86;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, Microsoft YaHei, sans-serif" fill="#20262e"><text x="32" y="40" font-size="23">${escape(title)}</text><text x="32" y="68" font-size="12" fill="#687382">${escape(`${offset + 1}–${offset + visible.length} / ${sorted.length} · ${unit} · ${zh ? "条形为对数刻度" : "Bars use a logarithmic scale"}`)}</text>${visible
          .map((r, i) => {
            const y = 110 + i * 86;
            return `<text x="32" y="${y}" fill="#7a8490" font-size="14">${offset + i + 1}</text><text x="75" y="${y}" font-size="16">${escape(r.point.model_display)}</text><text x="75" y="${y + 23}" font-size="12" fill="#687382">${escape(displayPlan(r.point.plan, state.lang) + " · " + accessLine(r.point))}</text><rect x="580" y="${y - 9}" width="${bar(r) * 2.8}" height="7" rx="3" fill="${color(r.point)}"/><text x="1068" y="${y}" text-anchor="end" font-size="18">${escape(formatted(r))}</text><line x1="32" x2="1068" y1="${y + 48}" y2="${y + 48}" stroke="#edf0f3"/>`;
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
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext("2d")!;
            ctx.scale(2, 2);
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
          link.download = `real-api-pricing-${state.view}-${state.lang}${!isPrice ? `-fee-${state.feeBand}` : ""}-page-${current + 1}.${format}`;
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
      <div className="ranking-columns">
        <span>#</span>
        <span>{zh ? "模型 / 套餐与渠道" : "Model / plan & channel"}</span>
        <span>
          {zh ? "数值对比 · 对数刻度" : "Comparison · logarithmic scale"}
        </span>
        <span>{unit}</span>
        <span />
      </div>
      {visible.length ? (
        visible.map((r, i) => (
          <button
            className="ranking-row"
            key={r.key}
            onClick={() => onSelect([r])}
          >
            <span className="rank-number">{offset + i + 1}</span>
            <span className="rank-identity">
              <strong className="model-with-logo">
                <BrandMarks point={r.point} />
                {r.point.model_display}
              </strong>
              <span>{displayPlan(r.point.plan, state.lang)}</span>
              <small>
                <i style={{ background: color(r.point) }} />
                {accessLine(r.point)} ·{" "}
                {r.point.billing === "api"
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
      <div className="ranking-pagination">
        <span>
          {sorted.length ? offset + 1 : 0}–{offset + visible.length} /{" "}
          {sorted.length} ·{" "}
          {zh
            ? "每页 15 条，图片导出当前页"
            : "15 per page · Image export includes this page"}
        </span>
        <div>
          <button
            aria-label={zh ? "排名上一页" : "Previous ranking page"}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <CaretLeft />
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            aria-label={zh ? "排名下一页" : "Next ranking page"}
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <CaretRight />
          </button>
        </div>
      </div>
    </section>
  );
}
