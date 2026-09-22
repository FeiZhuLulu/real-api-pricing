import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import type { Lang, Row } from "./types";
import {
  type Lock,
  type SearchCandidates,
  type SearchGroupCandidate,
  type SearchHits,
  accessLine,
  displayPlan,
  number,
  price,
} from "./domain";
import { BrandMarks } from "./ProviderLogo";

const MODEL_CAP = 5;
const PLAN_CAP = 5;
const POINT_CAP = 6;
const LIST_ID = "chart-search-list";

type Entry =
  | { kind: "model" | "plan"; candidate: SearchGroupCandidate }
  | { kind: "point"; row: Row };

export default function ChartSearch({
  query,
  lock,
  candidates,
  hits,
  lang,
  onSearch,
}: {
  query: string;
  lock: Lock | null;
  candidates: SearchCandidates;
  hits: SearchHits;
  lang: Lang;
  onSearch: (find: string, lock: Lock | null) => void;
}) {
  const zh = lang === "zh";
  const [open, setOpen] = useState(() => !!(query || lock));
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const models = candidates.models.slice(0, MODEL_CAP);
  const plans = candidates.plans.slice(0, PLAN_CAP);
  const points = candidates.points.slice(0, POINT_CAP);
  // Keyboard highlight indexes one flat list; rendering splits it into
  // sections (models, then plans, then single points).
  const entries: Entry[] = [
    ...models.map((candidate) => ({ kind: "model" as const, candidate })),
    ...plans.map((candidate) => ({ kind: "plan" as const, candidate })),
    ...points.map((row) => ({ kind: "point" as const, row })),
  ];
  const showList = focused && !!query && !lock;

  useEffect(() => {
    if (open && !lock) input.current?.focus();
  }, [open, lock]);

  // Clicking away dismisses only the suggestion list, never the query.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        setFocused(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const choose = (e: Entry) => {
    setActive(-1);
    onSearch(
      query,
      e.kind === "point"
        ? { kind: "point", value: e.row.point.id }
        : { kind: e.kind, value: e.candidate.value },
    );
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!entries.length) return;
      e.preventDefault();
      setActive((a) =>
        e.key === "ArrowDown"
          ? Math.min(a + 1, entries.length - 1)
          : Math.max(a - 1, -1),
      );
    } else if (e.key === "Enter") {
      const e0 = active >= 0 ? entries[active] : entries[0];
      if (e0) {
        e.preventDefault();
        choose(e0);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (lock) onSearch(query, null);
      else if (query) onSearch("", null);
      else setOpen(false);
    }
  };

  let status = "";
  if (hits.locked) {
    const l = hits.locked;
    status =
      l.kind === "model"
        ? zh
          ? `已锁定模型 ${l.label} · ${l.points} 个点`
          : `Model locked: ${l.label} · ${l.points} points`
        : l.kind === "plan"
          ? zh
            ? `已锁定套餐 ${l.label} · ${l.points} 个点`
            : `Plan locked: ${l.label} · ${l.points} points`
          : zh
            ? `已锁定 ${l.label}`
            : `Locked ${l.label}`;
  } else if (hits.lockMissing)
    status = zh
      ? "锁定的数据点不在当前筛选范围内"
      : "The locked point is outside the current selection";
  else if (query)
    status =
      (zh
        ? `命中 ${hits.total} 个点 · 已标注 ${hits.keys.size} 个`
        : `${hits.total} matches · ${hits.keys.size} marked`) +
      (hits.total > hits.keys.size
        ? zh
          ? "（在列表中选一条可只标注它）"
          : " (pick one from the list to mark only that point)"
        : "");

  const chipPrefix = !hits.locked
    ? ""
    : hits.locked.kind === "model"
      ? zh
        ? "模型："
        : "Model: "
      : hits.locked.kind === "plan"
        ? zh
          ? "套餐："
          : "Plan: "
        : "";

  const optionBody = (e: Entry) => {
    if (e.kind === "point") {
      const r = e.row;
      return (
        <>
          <BrandMarks point={r.point} />
          <span>
            {r.point.model_display}
            <small>
              {displayPlan(r.point.plan, lang)} · {accessLine(r.point)} ·{" "}
              {price(r.point.real_usd_per_mtok)} · {number(r.score, lang)}
            </small>
          </span>
        </>
      );
    }
    const c = e.candidate;
    const small =
      e.kind === "model"
        ? zh
          ? `${c.points} 个套餐 · 最低 ${price(c.cheapest)}/MTok · 分数 ${number(c.score, lang)}`
          : `${c.points} plans · from ${price(c.cheapest)}/MTok · score ${number(c.score, lang)}`
        : (() => {
            const fee =
              c.row.point.billing === "metered"
                ? zh
                  ? "按量 API"
                  : "Metered API"
                : price(c.row.point.price_usd);
            return zh
              ? `${c.points} 个模型 · ${accessLine(c.row.point)} · 月费 ${fee}`
              : `${c.points} models · ${accessLine(c.row.point)} · ${fee}/mo`;
          })();
    return (
      <>
        <BrandMarks point={c.row.point} />
        <span>
          {c.label}
          <small>{small}</small>
        </span>
      </>
    );
  };

  if (!open)
    return (
      <button
        className="chart-search-toggle"
        aria-label={zh ? "搜索套餐与模型" : "Search plans and models"}
        title={zh ? "搜索套餐与模型" : "Search plans and models"}
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass size={18} />
      </button>
    );
  return (
    <div className="chart-search-root" ref={root}>
      <div className="chart-search" role="search">
        <MagnifyingGlass size={16} />
        {hits.locked && (
          <span className="chart-search-chip">
            <span className="chart-search-chip-label">
              {chipPrefix + hits.locked.label}
            </span>
            <button
              aria-label={zh ? "取消锁定" : "Clear lock"}
              title={zh ? "取消锁定" : "Clear lock"}
              onClick={() => {
                onSearch(query, null);
                input.current?.focus();
              }}
            >
              <X size={12} />
            </button>
          </span>
        )}
        <input
          ref={input}
          role="combobox"
          aria-expanded={showList}
          aria-controls={LIST_ID}
          aria-autocomplete="list"
          aria-activedescendant={
            active >= 0 ? `${LIST_ID}-option-${active}` : undefined
          }
          aria-label={zh ? "搜索套餐与模型" : "Search plans and models"}
          placeholder={
            zh ? "搜索套餐或模型并标注…" : "Search a plan or model to mark…"
          }
          value={query}
          onChange={(e) => {
            setActive(-1);
            // Typing always returns to the live match set: it drops the lock.
            onSearch(e.target.value, null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        {(query || lock) && (
          <button
            className="chart-search-clear"
            aria-label={zh ? "清空搜索" : "Clear search"}
            title={zh ? "清空搜索" : "Clear search"}
            onClick={() => {
              onSearch("", null);
              input.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {showList && (
        <div
          className="chart-search-list"
          role="listbox"
          id={LIST_ID}
          // Keep the input focused while a suggestion is clicked.
          onMouseDown={(e) => e.preventDefault()}
        >
          {(
            [
              {
                kind: "model",
                items: models,
                total: candidates.models.length,
                title: zh ? "模型（跨全部套餐）" : "Models (all plans)",
              },
              {
                kind: "plan",
                items: plans,
                total: candidates.plans.length,
                title: zh ? "套餐（跨全部模型）" : "Plans (all models)",
              },
              {
                kind: "point",
                items: points,
                total: candidates.points.length,
                title: zh ? "单个套餐 × 模型" : "Single plan × model",
              },
            ] as const
          ).map((sec) => {
            if (!sec.items.length) return null;
            const base =
              sec.kind === "model"
                ? 0
                : sec.kind === "plan"
                  ? models.length
                  : models.length + plans.length;
            return (
              <div key={sec.kind} role="presentation">
                <div className="chart-search-section" role="presentation">
                  {sec.title}
                </div>
                {sec.items.map((it, i) => {
                  const flat = base + i;
                  const entry: Entry =
                    sec.kind === "point"
                      ? { kind: "point", row: it as Row }
                      : {
                          kind: sec.kind,
                          candidate: it as SearchGroupCandidate,
                        };
                  return (
                    <button
                      key={`${entry.kind}:${sec.kind === "point" ? (it as Row).point.id : (it as SearchGroupCandidate).value}`}
                      id={`${LIST_ID}-option-${flat}`}
                      role="option"
                      aria-selected={flat === active}
                      className={`chart-search-option${flat === active ? " is-active" : ""}`}
                      onMouseEnter={() => setActive(flat)}
                      onClick={() => choose(entry)}
                    >
                      {optionBody(entry)}
                    </button>
                  );
                })}
                {sec.total > sec.items.length && (
                  <div className="chart-search-more">
                    {zh
                      ? `还有 ${sec.total - sec.items.length} 条`
                      : `${sec.total - sec.items.length} more`}
                  </div>
                )}
              </div>
            );
          })}
          {!entries.length && (
            <div className="chart-search-empty">
              {zh ? "没有匹配的套餐或模型" : "No matching plan or model"}
            </div>
          )}
        </div>
      )}
      {status && (
        <small className="chart-search-status" aria-live="polite">
          {status}
        </small>
      )}
    </div>
  );
}
