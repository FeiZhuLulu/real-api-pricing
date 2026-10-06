import { useEffect, useRef, useState } from "react";
import { DotsSixVertical, X } from "@phosphor-icons/react";
import type { Point, Row, State } from "./types";
import ProviderLogo from "./ProviderLogo";
import PlanModelPicker, { ALL_MODELS, planKey, planOptions } from "./PlanModelPicker";
import ResizeHandle from "./ResizeHandle";
import { useTheme } from "./theme";
import { dotColors } from "./palette";
import {
  allowance,
  barWidth,
  color,
  displayPlan,
  manufacturer,
  price,
  tableRows,
} from "./domain";

/** Chosen points grouped into one card per plan, in the order plans were added. */
function cardGroups(points: Point[]): { key: string; points: Point[] }[] {
  const map = new Map<string, Point[]>();
  for (const p of points) map.set(planKey(p), [...(map.get(planKey(p)) ?? []), p]);
  return [...map].map(([key, ps]) => ({
    key,
    points: ps.sort((a, b) => (b.monthly_yi ?? 0) - (a.monthly_yi ?? 0) || a.id.localeCompare(b.id)),
  }));
}

export default function AllowanceCards({
  points,
  rows,
  state,
  axis,
  highlight,
  onChange,
  onSelect,
}: {
  /** Every allowance point, so a chosen card survives later filtering. */
  points: Point[];
  /** Filtered rows: they narrow the plans offered in the picker. */
  rows: Row[];
  state: State;
  axis: { low: number; high: number };
  highlight: string | null;
  onChange: (ids: string[]) => void;
  onSelect: (rows: Row[]) => void;
}) {
  const zh = state.lang === "zh";
  const dark = useTheme() === "dark";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState("");
  const byId = new Map(points.map((p) => [p.id, p]));
  const chosen = state.cards.flatMap((id) => byId.get(id) ?? []);
  const options = planOptions(tableRows(rows, state).map((r) => r.point));
  const groups = cardGroups(chosen);
  const decades = Math.round(Math.log10(axis.high / axis.low));
  const caption = zh
    ? "由多到少 · 对数刻度 · 每格 10 倍"
    : "Largest first · log scale · 10× per tick";
  const rowFor = (p: Point): Row =>
    rows.find((r) => r.point.id === p.id) ?? { key: p.id, point: p, mapping: null, score: null };
  // A card appears only once both a plan and a model have been picked.
  const add = (model: string) => {
    const ids =
      model === ALL_MODELS ? options.plans.get(plan)!.map((p) => p.id) : [model];
    onChange([...state.cards, ...ids.filter((id) => !state.cards.includes(id))]);
    setPlan("");
  };
  const remove = (ids: string[]) => onChange(state.cards.filter((id) => !ids.includes(id)));

  // Drag to reorder: cards swap live under the pointer, the order is saved on release.
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [focusGrip, setFocusGrip] = useState<string | null>(null);
  const shown = order ? order.flatMap((k) => byKey.get(k) ?? []) : groups;
  const commit = (keys: string[]) =>
    onChange(keys.flatMap((k) => byKey.get(k)?.points.map((p) => p.id) ?? []));
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const startDrag = (e: React.PointerEvent, key: string) => {
    const target = e.target as Element;
    if (e.button !== 0 || target.closest(".plan-card-remove")) return;
    // Touch drags only from the grip, so the rest of the card still scrolls the page.
    if (e.pointerType !== "mouse" && !target.closest(".plan-card-grip")) return;
    e.preventDefault();
    const x0 = e.clientX,
      y0 = e.clientY;
    let keys = groups.map((g) => g.key);
    let active = false;
    // Window listeners: React moves the card's DOM node while reordering,
    // which would drop a pointer capture held by the card itself.
    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        active = true;
        setDragging(key);
        setOrder(keys);
      }
      const box = scrollRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      if (ev.clientY < r.top + 48) box.scrollTop -= 14;
      else if (ev.clientY > r.bottom - 48) box.scrollTop += 14;
      const over = [...box.querySelectorAll<HTMLElement>("[data-card]")].find((el) => {
        const c = el.getBoundingClientRect();
        return ev.clientX >= c.left && ev.clientX <= c.right && ev.clientY >= c.top && ev.clientY <= c.bottom;
      })?.dataset.card;
      if (!over || over === key) return;
      const next = keys.filter((k) => k !== key);
      next.splice(keys.indexOf(over), 0, key);
      keys = next;
      setOrder(next);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (active) commitRef.current(keys);
      setOrder(null);
      setDragging(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const nudge = (key: string, by: number) => {
    const keys = groups.map((g) => g.key);
    const from = keys.indexOf(key),
      to = Math.min(keys.length - 1, Math.max(0, from + by));
    if (from === to) return;
    keys.splice(from, 1);
    keys.splice(to, 0, key);
    setFocusGrip(key);
    commit(keys);
  };
  // Moving a card re-inserts its node, which drops keyboard focus; restore it.
  useEffect(() => {
    if (!focusGrip) return;
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-card="${CSS.escape(focusGrip)}"] .plan-card-grip`)
      ?.focus();
    setFocusGrip(null);
  }, [focusGrip, state.cards]);

  return (
    <section className="web-ranking" aria-label={zh ? "月额度卡片" : "Monthly allowance cards"}>
      <div className="card-picker">
        <span className="card-picker-label">{zh ? "添加卡片" : "Add a card"}</span>
        <PlanModelPicker
          options={options}
          plan={plan}
          model=""
          zh={zh}
          allowAll
          onPlan={setPlan}
          onModel={add}
        />
        {chosen.length > 0 && (
          <button className="card-picker-clear" onClick={() => onChange([])}>
            {zh ? "清空卡片" : "Clear cards"}
          </button>
        )}
      </div>
      <div
        className={`ranking-scroll plan-cards-scroll${dragging ? " is-sorting" : ""}`}
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={zh ? "按套餐分组的月额度卡片，可滚动" : "Allowance cards by plan, scrollable"}
      >
        {groups.length ? (
          <div className="plan-cards">
            {shown.map(({ key, points: models }) => {
              const p = models[0];
              const fill = dotColors(color(p), dark).fill;
              const faded = highlight !== null && p.channel !== highlight;
              return (
                <article
                  key={key}
                  data-card={key}
                  className={`plan-card${faded ? " is-faded" : ""}${dragging === key ? " is-dragging" : ""}`}
                >
                  <header onPointerDown={(e) => startDrag(e, key)}>
                    <span className="plan-card-channel">
                      <i style={{ background: fill }} />
                      {p.channel}
                    </span>
                    <h3>{displayPlan(p.plan, state.lang)}</h3>
                    <p className="plan-card-fee">
                      {price(p.price_usd)}
                      {zh ? "/月" : "/mo"}
                      {p.local_price && <small> · {p.local_price}</small>}
                    </p>
                    <button
                      className="icon-button plan-card-grip"
                      aria-label={
                        zh
                          ? `拖动排序 ${displayPlan(p.plan, state.lang)}，方向键移动`
                          : `Reorder ${displayPlan(p.plan, state.lang)}; arrow keys move it`
                      }
                      title={zh ? "拖动排序" : "Drag to reorder"}
                      onKeyDown={(e) => {
                        const by =
                          e.key === "ArrowLeft" || e.key === "ArrowUp"
                            ? -1
                            : e.key === "ArrowRight" || e.key === "ArrowDown"
                              ? 1
                              : 0;
                        if (!by) return;
                        e.preventDefault();
                        nudge(key, by);
                      }}
                    >
                      <DotsSixVertical size={16} weight="bold" />
                    </button>
                    <button
                      className="icon-button plan-card-remove"
                      aria-label={zh ? `移除 ${displayPlan(p.plan, state.lang)} 卡片` : `Remove the ${displayPlan(p.plan, state.lang)} card`}
                      title={zh ? "移除卡片" : "Remove card"}
                      onClick={() => remove(models.map((m) => m.id))}
                    >
                      <X size={15} />
                    </button>
                  </header>
                  <p className="plan-card-caption">{caption}</p>
                  <ul>
                    {models.map((m) => (
                      <li key={m.id} className="plan-card-item">
                        <button
                          className="plan-card-row"
                          title={`${m.model_display} · ${price(m.real_usd_per_mtok)} / MTok`}
                          onClick={() => onSelect([rowFor(m)])}
                        >
                          <ProviderLogo provider={manufacturer(m.vendor)} size={22} />
                          <span className="plan-card-model">{m.model_display}</span>
                          <span
                            className="plan-card-bar"
                            aria-hidden="true"
                            style={{ "--decade": `${100 / decades}%` } as React.CSSProperties}
                          >
                            <span
                              style={{
                                width: `${barWidth(m.monthly_yi ?? 0, axis)}%`,
                                background: fill,
                              }}
                            />
                          </span>
                          <span className="plan-card-value">{allowance(m, state.lang)}</span>
                        </button>
                        <button
                          className="icon-button plan-card-row-remove"
                          aria-label={zh ? `移除 ${m.model_display}` : `Remove ${m.model_display}`}
                          onClick={() => remove([m.id])}
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty picker-empty">
            <h3>{zh ? "还没有卡片" : "No cards yet"}</h3>
            <p>
              {zh
                ? "在上方先选套餐，再选模型，选好后显示卡片。"
                : "Choose a plan, then a model above to show its card."}
            </p>
          </div>
        )}
      </div>
      <ResizeHandle
        target={scrollRef}
        label={zh ? "拖动调整列表高度，双击恢复" : "Drag to resize the list · double-click to reset"}
      />
    </section>
  );
}
