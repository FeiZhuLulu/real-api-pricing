import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import type { Point, Row, State } from "./types";
import ProviderLogo from "./ProviderLogo";
import PlanModelPicker, { planOptions } from "./PlanModelPicker";
import { useTheme } from "./theme";
import { dotColors, mix } from "./palette";
import {
  COMPARE_MAX,
  PLAN_SLOT,
  color,
  planKey,
  displayPlan,
  manufacturer,
  number,
  price,
  tableRows,
} from "./domain";

const LETTERS = ["A", "B", "C"];
const BAR_H = 34;
const OFFSET = 20;

/** One comparison slot; `id` stays empty until a model has been picked. */
type Slot = { plan: string; id: string };
const EMPTY: Slot = { plan: "", id: "" };

/** 1-2-5 step close to `range`. */
function niceStep(range: number): number {
  const e = 10 ** Math.floor(Math.log10(range));
  const f = range / e;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
}

/**
 * Linear axis for the compared values. When zoomed, the axis starts above
 * zero so the shortest bar fills about 40% of the track and small gaps stay
 * visible; the caller must label the truncated start.
 */
export function compareAxis(values: number[], zoom: boolean) {
  const max = Math.max(...values),
    min = Math.min(...values);
  const raw = (min - 0.4 * max) / 0.6;
  const zoomed = zoom && max > min && raw > 0;
  const step = niceStep((max - (zoomed ? raw : 0)) / 4 || max || 1);
  const start = zoomed ? Math.floor(raw / step) * step : 0;
  // Half-step headroom keeps the longest bar near the right edge.
  const end = Math.max(Math.ceil(max / (step / 2)) * (step / 2), start + step);
  const ticks: number[] = [];
  for (let k = 0; start + k * step <= end + step / 1e6; k++) ticks.push(start + k * step);
  return { start, end, step, ticks, pct: (v: number) => (100 * (v - start)) / (end - start) };
}

export default function AllowanceCompare({
  points,
  rows,
  state,
  onChange,
  onSelect,
}: {
  /** Every allowance point, so a chosen item survives later filtering. */
  points: Point[];
  /** Filtered rows: they narrow the plan lists offered in the pickers. */
  rows: Row[];
  state: State;
  onChange: (ids: string[]) => void;
  onSelect: (rows: Row[]) => void;
}) {
  const zh = state.lang === "zh";
  const dark = useTheme() === "dark";
  const [zoom, setZoom] = useState(true);
  const byId = new Map(points.map((p) => [p.id, p]));
  // Slots start empty; a saved link restores its complete items.
  // Slots start empty; a saved link restores every slot in its position.
  const [slots, setSlots] = useState<Slot[]>(() => {
    const saved = state.compare.map((v): Slot => {
      const p = byId.get(v);
      if (p) return { plan: planKey(p), id: v };
      return v.startsWith(PLAN_SLOT) ? { plan: v.slice(PLAN_SLOT.length), id: "" } : EMPTY;
    });
    return [...saved, EMPTY, EMPTY].slice(0, Math.max(2, saved.length));
  });
  const update = (next: Slot[]) => {
    setSlots(next);
    // Untouched default slots keep the link clean.
    onChange(
      next.every((s) => !s.plan) && next.length === 2
        ? []
        : next.map((s) => s.id || (s.plan ? PLAN_SLOT + s.plan : "")),
    );
  };
  const setSlot = (i: number, slot: Slot) => update(slots.map((s, k) => (k === i ? slot : s)));

  // Plans already chosen stay listed even when the filters now hide them.
  const chosenPlans = new Set(slots.map((s) => s.plan).filter(Boolean));
  const options = planOptions([
    ...tableRows(rows, state).map((r) => r.point),
    ...points.filter((p) => chosenPlans.has(planKey(p))),
  ]);
  const yi = (v: number) =>
    zh ? `${number(v, "zh", 3)} 亿` : `${number(v / 10, "en", 3)} B`;

  const slotColor = slots.map((s) => {
    const p = byId.get(s.id);
    return p ? dotColors(color(p), dark).fill : "";
  });
  // Same channel twice would draw two identical bars; shift the later ones.
  slotColor.forEach((f, i) => {
    if (f && slotColor.slice(0, i).includes(f))
      slotColor[i] = mix(f, dark ? "#ffffff" : "#000000", 0.35 * i);
  });
  // Complete items keep their slot letter and colour.
  const items = slots.flatMap((s, slot) => {
    const p = byId.get(s.id);
    return p ? [{ p, slot, fill: slotColor[slot], value: p.monthly_yi! }] : [];
  });
  const ready = items.length >= 2;

  const values = items.map((x) => x.value);
  const axis = compareAxis(ready ? values : [1], zoom);
  // English shows billions (yi / 10), so its ticks need one more decimal.
  const tickDigits = Math.max(0, Math.ceil(-Math.log10(zh ? axis.step : axis.step / 10)));
  const max = Math.max(...values),
    min = Math.min(...values);
  const base = values[0];
  const plotH = BAR_H + (items.length - 1) * OFFSET;
  const delta = (v: number) => {
    const diff = v - base;
    if (diff === 0) return zh ? "与基准相同" : "same as baseline";
    return `${diff > 0 ? "+" : "−"}${yi(Math.abs(diff))} · ${diff > 0 ? "+" : "−"}${number(
      Math.abs((100 * diff) / base),
      state.lang,
      1,
    )}%`;
  };
  const rowFor = (p: Point): Row =>
    rows.find((r) => r.point.id === p.id) ?? { key: p.id, point: p, mapping: null, score: null };

  const key = (slot: number) => (
    <span className="compare-key">
      <i style={slotColor[slot] ? { background: slotColor[slot] } : undefined} />
      {LETTERS[slot]}
    </span>
  );

  return (
    <section className="web-ranking compare-view" aria-label={zh ? "月额度对比" : "Monthly allowance comparison"}>
      <article className="plan-card compare-card">
        <header className="compare-head">
          <div>
            <span className="plan-card-channel">
              {zh ? "月额度对比 · 线性刻度" : "Allowance comparison · linear scale"}
            </span>
            <h3>
              {ready
                ? items.map((x) => x.p.model_display).join(" vs ")
                : zh
                  ? "选择要对比的套餐和模型"
                  : "Choose plans and models to compare"}
            </h3>
            <p className="plan-card-fee">
              {!ready ? (
                zh ? (
                  "每一项都要先选套餐、再选模型，至少两项后显示对比。"
                ) : (
                  "Pick a plan, then a model, for at least two items."
                )
              ) : max > min ? (
                <>
                  {zh ? "差距 " : "Gap "}
                  {yi(max - min)}
                  {" · "}
                  {max / min >= 1.1
                    ? `${zh ? "最高是最低的 " : "largest is "}${number(max / min, state.lang, 2)}×`
                    : `${zh ? "最高比最低多 " : "largest is "}${number((100 * (max - min)) / min, state.lang, 2)}%${zh ? "" : " more"}`}
                </>
              ) : zh ? (
                "额度相同"
              ) : (
                "Same allowance"
              )}
            </p>
          </div>
          {ready && (
            <div className="segmented compare-scale" role="group" aria-label={zh ? "坐标轴" : "Axis"}>
              <button aria-pressed={zoom} onClick={() => setZoom(true)}>
                {zh ? "放大差距" : "Zoom to gap"}
              </button>
              <button aria-pressed={!zoom} onClick={() => setZoom(false)}>
                {zh ? "从 0 开始" : "From zero"}
              </button>
            </div>
          )}
        </header>

        <div className="compare-pickers">
          {slots.map((s, i) => (
            <div className="compare-slot" key={i}>
              {key(i)}
              <PlanModelPicker
                options={options}
                plan={s.plan}
                model={s.id}
                zh={zh}
                onPlan={(plan) => setSlot(i, { plan, id: "" })}
                onModel={(id) => setSlot(i, { plan: s.plan, id })}
              />
              {(slots.length > 2 || s.plan) && (
                <button
                  className="icon-button"
                  aria-label={zh ? `移除 ${LETTERS[i]}` : `Remove ${LETTERS[i]}`}
                  onClick={() =>
                    update(slots.length > 2 ? slots.filter((_, k) => k !== i) : slots.map((x, k) => (k === i ? EMPTY : x)))
                  }
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {slots.length < COMPARE_MAX && (
            <button className="compare-add" onClick={() => setSlots([...slots, EMPTY])}>
              <Plus size={14} />
              {zh ? "添加对比项" : "Add item"}
            </button>
          )}
        </div>

        {ready ? (
          <>
        <p className="plan-card-caption">
          {zh ? "单位：亿 token / 月" : "Unit: billion tokens / month"}
          {axis.start > 0 &&
            (zh
              ? ` · 坐标轴从 ${yi(axis.start)} 起，已放大差距`
              : ` · axis starts at ${yi(axis.start)} to magnify the gap`)}
        </p>
        <div className="compare-track">
          <div className="compare-plot" style={{ height: plotH }}>
            {axis.ticks.map((v) => (
              <i key={v} className="compare-grid" style={{ left: `${axis.pct(v)}%` }} />
            ))}
            {max > min && (
              <span
                className="compare-gap"
                style={{ left: `${axis.pct(min)}%`, width: `${axis.pct(max) - axis.pct(min)}%` }}
              />
            )}
            {items.map(({ p, slot, fill, value }, i) => (
              <button
                key={p.id}
                className="compare-bar"
                style={{
                  top: i * OFFSET,
                  height: BAR_H,
                  width: `${axis.pct(value)}%`,
                  background: fill,
                  zIndex: i + 1,
                }}
                title={`${LETTERS[slot]} · ${p.model_display} · ${displayPlan(p.plan, state.lang)} · ${yi(value)}`}
                onClick={() => onSelect([rowFor(p)])}
              />
            ))}
            {items.map(({ p, slot, value }, i) => (
              <span
                key={p.id}
                className="compare-tag"
                style={{
                  left: `${axis.pct(value)}%`,
                  top: i * OFFSET + (i < items.length - 1 ? OFFSET / 2 : BAR_H / 2),
                  zIndex: items.length + 1,
                }}
              >
                <small>{LETTERS[slot]}</small>
                {yi(value)}
              </span>
            ))}
            {axis.start > 0 && (
              <svg className="compare-break" width="14" height={plotH + 8} aria-hidden="true">
                <path d={`M3 0 L11 ${(plotH + 8) / 2} L3 ${plotH + 8}`} />
              </svg>
            )}
          </div>
          <div className="compare-axis" aria-hidden="true">
            {axis.ticks.map((v) => (
              <span key={v} style={{ left: `${axis.pct(v)}%` }}>
                {number(zh ? v : v / 10, state.lang, tickDigits)}
              </span>
            ))}
          </div>
        </div>

        <ul className="compare-rows">
          {items.map(({ p, slot, value }, i) => (
            <li key={p.id}>
              <button className="plan-card-row compare-row" onClick={() => onSelect([rowFor(p)])}>
                {key(slot)}
                <ProviderLogo provider={manufacturer(p.vendor)} size={22} />
                <span className="compare-identity">
                  <span className="plan-card-model">{p.model_display}</span>
                  <small>
                    {displayPlan(p.plan, state.lang)} · {price(p.price_usd)}
                    {zh ? "/月" : "/mo"} · {price(p.real_usd_per_mtok)} / MTok
                  </small>
                </span>
                <span className="plan-card-value">
                  <strong>{yi(value)}</strong>
                  <small>{i === 0 ? (zh ? "基准" : "baseline") : delta(value)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
          </>
        ) : (
          <div className="compare-placeholder">
            {zh
              ? `已选好 ${items.length} / 2 项。套餐和模型都选定后，这里显示错位叠放的对比条。`
              : `${items.length} of 2 items ready. Bars appear once each has a plan and a model.`}
          </div>
        )}
      </article>
    </section>
  );
}
