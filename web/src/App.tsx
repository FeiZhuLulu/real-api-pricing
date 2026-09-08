import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChartBar,
  ChartScatter,
  Check,
  CheckSquare,
  CaretDown,
  DownloadSimple,
  FunnelSimple,
  GithubLogo,
  Globe,
  Info,
  LinkSimple,
  MagnifyingGlass,
  SlidersHorizontal,
  Table,
  X,
} from "@phosphor-icons/react";
import Chart from "./Chart";
import HeaderActions from "./HeaderActions";
import { unpackData } from "./loadData";
import Ranking from "./Ranking";
import ProviderLogo, { BrandMarks } from "./ProviderLogo";
import { feeBands } from "./domain";
import type { ChartHandle } from "./Chart";
import Modal from "./Modal";
import type {
  FilterKey,
  Lang,
  Point,
  Row,
  SiteData,
  State,
  View,
} from "./types";
import {
  accessLine,
  allowance,
  color,
  csv,
  defaultState,
  displayPlan,
  filterKeys,
  groups,
  manufacturer,
  number,
  options,
  pareto,
  price,
  restore,
  rowsFor,
  safeUrl,
  serialize,
  tableRows,
  visiblePoints,
} from "./domain";

const REPO = "https://github.com/FeiZhuLulu/real-api-pricing";
const boardLabels: Record<string, string> = {
  arena_code: "Code Arena",
  arena_agent_mode: "Agent Arena",
  aa_intelligence_index: "AA Intelligence",
  aa_coding_agent_index: "AA Coding Agent",
};
const boardZh: Record<string, string> = {
  arena_code: "Code Arena · 网页开发",
  arena_agent_mode: "Agent Arena",
  aa_intelligence_index: "AA 智力榜",
  aa_coding_agent_index: "AA 编程 Agent",
};
const filterLabels: Record<FilterKey, [string, string]> = {
  vendors: ["Model developer", "模型厂商"],
  channels: ["Access channel", "订阅渠道"],
  plans: ["Plan", "套餐"],
  billing: ["Billing", "计费方式"],
  confidence: ["Quota confidence", "额度置信度"],
  harness: ["Agent harness", "Agent 框架"],
  effort: ["Reasoning effort", "推理强度"],
  modes: ["Service mode", "服务模式"],
};
function localLanguage() {
  try {
    return localStorage.getItem("pricing-language");
  } catch {
    return null;
  }
}
function saveLanguage(lang: Lang) {
  try {
    localStorage.setItem("pricing-language", lang);
  } catch {
    /* Storage is optional. */
  }
}
function downloadText(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function CheckBox({
  checked,
  mixed = false,
  onChange,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  );
}

export default function App() {
  const [data, setData] = useState<SiteData | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/data/site.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(unpackData)
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setLoadError(String(e));
      });
    return () => abort.abort();
  }, []);
  if (loadError)
    return (
      <main className="boot">
        <ChartScatter size={36} />
        <h1>Data is unavailable</h1>
        <p>{loadError}</p>
        <button onClick={() => location.reload()}>Try again</button>
        <a href={REPO}>Open the source data</a>
      </main>
    );
  if (!data)
    return (
      <main className="boot">
        <ChartScatter size={36} />
        <h1>Real API Pricing</h1>
        <p>Loading the latest data…</p>
      </main>
    );
  return <Explorer data={data} />;
}
function Explorer({ data }: { data: SiteData }) {
  const initial = useMemo(
    () => restore(location.hash, data, localLanguage()),
    [data],
  );
  const [state, setState] = useState<State>(initial.state);
  const [warning, setWarning] = useState(initial.warning);
  const [panel, setPanel] = useState<
    "models" | "filters" | "display" | "download" | "share" | null
  >(null);
  const [detail, setDetail] = useState<Row[] | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const tableScroll = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState("");
  const chart = useRef<ChartHandle | null>(null);
  const zh = state.lang === "zh";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const patch = (update: Partial<State>) =>
    setState((s) => ({ ...s, ...update }));
  useEffect(() => {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    document.title = zh
      ? "真实 API 定价 · 价格背后的能力"
      : "Real API Pricing — The cost behind the capability";
    saveLanguage(state.lang);
  }, [state.lang, zh]);
  useEffect(() => {
    const hash = serialize(state);
    if (location.hash !== hash)
      history.replaceState(
        null,
        "",
        location.pathname + location.search + hash,
      );
  }, [state]);
  useEffect(() => {
    const change = () => {
      const parsed = restore(location.hash, data, localLanguage());
      setState(parsed.state);
      setWarning(parsed.warning);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [data]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const rows = useMemo(() => rowsFor(data, state), [data, state]);
  const shown = useMemo(() => tableRows(rows, state), [rows, state]);
  const pts = useMemo(() => visiblePoints(data, state), [data, state]);
  const gs = useMemo(() => groups(rows), [rows]);
  const front = useMemo(() => pareto(gs), [gs]);
  const frontRows = new Set(front.flatMap((g) => g.rows.map((r) => r.key)));
  const opts = useMemo(() => options(data), [data]);
  const selectedIds = useMemo(
    () => new Set(state.selected ?? data.points.map((p) => p.id)),
    [state.selected, data],
  );
  const models = useMemo(() => {
    const map = new Map<string, Point[]>();
    for (const p of data.points)
      map.set(p.model, [...(map.get(p.model) || []), p]);
    return [...map].sort((a, b) =>
      a[1][0].model_display.localeCompare(b[1][0].model_display),
    );
  }, [data]);
  const noScore = pts.filter(
    (p) => !rows.some((r) => r.point.id === p.id && r.score !== null),
  );
  const activeFilters = filterKeys.flatMap((k) =>
    state[k].map((v) => ({ k, v })),
  );
  const changeSelection = (ids: string[], checked: boolean) => {
    const next = new Set(selectedIds);
    for (const id of ids) checked ? next.add(id) : next.delete(id);
    patch({ selected: next.size === data.points.length ? null : [...next] });
  };
  const toggleFilter = (k: FilterKey, v: string) =>
    patch({
      [k]: state[k].includes(v)
        ? state[k].filter((x) => x !== v)
        : [...state[k], v],
    });
  const reset = () => {
    setState({
      ...defaultState(),
      lang: state.lang,
      view: state.view,
      board: state.board,
    });
    setWarning(false);
  };
  const filterValue = (v: string) =>
    v === "unknown"
      ? t("Unknown / unreported", "未知 / 未报告")
      : v === "subscription"
        ? t("Subscription", "订阅")
        : v === "metered"
          ? t("Metered API", "按量 API")
          : v === "high"
            ? t("High", "高")
            : v === "medium"
              ? t("Medium", "中")
              : v === "low"
                ? t("Low", "低")
                : displayPlan(v, state.lang);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setToast(
        t(
          "Link copied. Your current view and filters are included.",
          "已复制链接，包含当前视图和筛选。",
        ),
      );
    } catch {
      setPanel("share");
    }
  };
  const tab = (view: View, en: string, cn: string) => (
    <button
      className={state.view === view ? "view-tab active" : "view-tab"}
      aria-pressed={state.view === view}
      onClick={() => patch({ view })}
    >
      {view === "pareto" ? <ChartScatter size={17} /> : <ChartBar size={17} />}{" "}
      <span>
        {t(en, cn)}
        <small>
          {view === "pareto"
            ? t(
                "All scored models + current frontier",
                "全部有分模型与当前前沿",
              )
            : view === "price"
              ? t(
                  "Every subscription and API price",
                  "全部订阅与 API 的真实单价",
                )
              : t("All adopted subscription allowances", "全部已采用订阅额度")}
        </small>
      </span>
    </button>
  );
  const sort = (key: string) =>
    patch({
      sort: key,
      direction:
        state.sort === key && state.direction === "asc" ? "desc" : "asc",
    });
  const sortHead = (key: string, en: string, cn: string) => (
    <th
      aria-sort={
        state.sort === key
          ? state.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button onClick={() => sort(key)}>
        {t(en, cn)}
        {state.sort === key ? (
          state.direction === "asc" ? (
            <ArrowUp size={13} />
          ) : (
            <ArrowDown size={13} />
          )
        ) : (
          <CaretDown size={12} className="faint" />
        )}
      </button>
    </th>
  );
  const rowSignature = shown.map((row) => row.key).join("|");
  useEffect(() => {
    if (tableScroll.current) tableScroll.current.scrollTop = 0;
  }, [rowSignature]);
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              patch({ view: "pareto" });
            }}
          >
            <ChartScatter size={27} weight="bold" />
            <span>Real API Pricing</span>
          </a>
          <nav aria-label={t("Main navigation", "主导航")}>
            <button
              className={
                state.view !== "method" ? "nav-link current" : "nav-link"
              }
              onClick={() => patch({ view: "pareto" })}
            >
              {t("Explore", "数据探索")}
            </button>
            <button
              className={
                state.view === "method" ? "nav-link current" : "nav-link"
              }
              onClick={() => patch({ view: "method" })}
            >
              {t("Methodology", "方法与来源")}
            </button>
          </nav>
          <div className="header-actions">
            <HeaderActions lang={state.lang} />
            <button
              className="language"
              onClick={() => patch({ lang: zh ? "en" : "zh" })}
              aria-label={t("Switch to Chinese", "切换为英文")}
            >
              <Globe size={17} />
              <span>{zh ? "EN" : "中文"}</span>
            </button>
            <a
              href={REPO}
              className="icon-button github"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <GithubLogo size={22} />
            </a>
          </div>
        </div>
      </header>
      <main className="page">
        {warning && (
          <div className="notice" role="status">
            <Info size={18} />
            {t(
              "Some saved settings are no longer available and were ignored. Review the selection below.",
              "部分分享设置已失效并被忽略，请检查当前选择。",
            )}
            <button
              className="icon-button"
              aria-label={t("Dismiss", "关闭")}
              onClick={() => setWarning(false)}
            >
              <X />
            </button>
          </div>
        )}
        {state.view === "method" ? (
          <Method
            data={data}
            zh={zh}
            onBack={() => patch({ view: "pareto" })}
          />
        ) : (
          <>
            <section className="intro">
              <div className="eyebrow">
                {t(
                  "INDEPENDENT DATA · OPEN METHODOLOGY",
                  "独立数据 · 公开口径",
                )}
              </div>
              <h1>
                {zh ? (
                  <>
                    看清能力背后的
                    <br className="mobile-break" />
                    真实价格。
                  </>
                ) : (
                  "The cost behind the capability."
                )}
              </h1>
              <p>
                {t(
                  "Compare what you actually pay for AI — across subscriptions, models, and benchmarks.",
                  "从订阅、模型到评测榜单，比较你真正付出的 AI 使用成本。",
                )}
              </p>
              <div className="intro-meta">
                <span className="live-dot" />
                {data.points.length}{" "}
                {t("plan × model points", "套餐 × 模型数据点")}
                <span className="meta-separator">/</span>
                {Object.keys(data.boards).length}{" "}
                {t("independent leaderboards", "独立榜单")}
                <span className="meta-separator">/</span>
                <span>
                  {t("Dataset snapshot", "数据快照")}{" "}
                  {String(data.generatedAt).slice(0, 10)}
                </span>
              </div>
            </section>
            <div className="view-tabs" aria-label={t("Data views", "数据视图")}>
              {tab("pareto", "Price vs. capability", "价格 × 能力")}
              {tab("price", "Real price", "真实单价")}
              {tab("allowance", "Monthly allowance", "月额度")}
              <button
                className="view-tab"
                onClick={() => {
                  const table = document.getElementById("all-data");
                  table?.scrollIntoView({ behavior: "smooth", block: "start" });
                  table?.focus({ preventScroll: true });
                }}
              >
                <Table size={17} />
                <span>
                  {t("Full data table", "完整数据表")}
                  <small>
                    {t(
                      "Plans, configurations and evidence",
                      "套餐、评测配置与可追溯来源",
                    )}
                  </small>
                </span>
              </button>
            </div>
            <section
              className="workspace"
              aria-label={t("Data explorer", "数据浏览器")}
            >
              {state.view === "pareto" && (
                <div
                  className="board-tabs"
                  aria-label={t("Leaderboards", "榜单")}
                >
                  {Object.keys(data.boards).map((id) => (
                    <button
                      key={id}
                      className={
                        state.board === id ? "board-tab selected" : "board-tab"
                      }
                      aria-pressed={state.board === id}
                      onClick={() => patch({ board: id })}
                    >
                      {(zh ? boardZh : boardLabels)[id] || data.boards[id].name}
                    </button>
                  ))}
                </div>
              )}
              <div className="chart-heading">
                <div>
                  <h2>
                    {state.view === "pareto"
                      ? t("Price meets performance", "真实单价与模型能力")
                      : state.view === "price"
                        ? t(
                            "Every model. Its real price.",
                            "每个模型的真实单价。",
                          )
                        : t(
                            "How much can you actually use?",
                            "每月实际能用多少？",
                          )}
                  </h2>
                  <p>
                    {state.view === "pareto" ? (
                      <>
                        {data.boards[state.board].metric}
                        {data.boards[state.board].name.match(/\bv\d+(?:\.\d+)+/)?.[0] &&
                          ` ${data.boards[state.board].name.match(/\bv\d+(?:\.\d+)+/)![0]}`}
                        {" · "}
                        {state.board === "arena_code"
                          ? t("WebDev Overall · ", "网页开发 Overall · ")
                          : ""}
                        {t("Snapshot", "快照")}{" "}
                        {data.boards[state.board].snapshot}{" "}
                        <a
                          href={data.boards[state.board].url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t(
                            "Open benchmark source",
                            "打开榜单来源",
                          )}
                        >
                          <ArrowUpRight size={14} />
                        </a>
                      </>
                    ) : state.view === "price" ? (
                      t(
                        "Monthly subscription fee ÷ usable tokens. Metered APIs use the standard workload.",
                        "订阅月费 ÷ 可用 token；按量 API 采用项目标准负载。",
                      )
                    ) : (
                      t(
                        "Saturated use · all token types · subscription plans only",
                        "饱和使用 · 全口径 token · 仅订阅套餐",
                      )
                    )}
                  </p>
                </div>
                <div className="chart-actions">
                  <button
                    className="icon-button"
                    title={t("Share current view", "分享当前视图")}
                    aria-label={t("Share current view", "分享当前视图")}
                    onClick={() => void copy()}
                  >
                    <LinkSimple size={19} />
                  </button>
                  <button
                    className="icon-button"
                    title={t("Download", "下载")}
                    aria-label={t("Download", "下载")}
                    onClick={() => setPanel("download")}
                  >
                    <DownloadSimple size={19} />
                  </button>
                  <button
                    className="icon-button"
                    title={t("Chart settings", "图表设置")}
                    aria-label={t("Chart settings", "图表设置")}
                    onClick={() => setPanel("display")}
                  >
                    <SlidersHorizontal size={19} />
                  </button>
                </div>
              </div>
              <div className="toolbar">
                <button
                  className="select-models"
                  onClick={() => setPanel("models")}
                >
                  <CheckSquare size={18} />
                  <span>{t("Models & plans", "模型与套餐")}</span>
                  <span className="count">
                    {selectedIds.size} / {data.points.length}
                  </span>
                  <CaretDown size={14} />
                </button>
                <button
                  className={
                    activeFilters.length
                      ? "filter-button has-filters"
                      : "filter-button"
                  }
                  onClick={() => setPanel("filters")}
                >
                  <FunnelSimple size={17} />
                  {t("Filters", "筛选")}
                  {activeFilters.length > 0 && (
                    <span className="count">{activeFilters.length}</span>
                  )}
                </button>
                {state.view === "pareto" && (
                  <label className="config-select">
                    <span className="sr-only">
                      {t("Benchmark configurations", "评测配置")}
                    </span>
                    <select
                      value={state.configuration}
                      onChange={(e) =>
                        patch({
                          configuration: e.target
                            .value as State["configuration"],
                        })
                      }
                    >
                      <option value="all">
                        {t(
                          "All configurations · reference",
                          "全部配置 · 参考映射",
                        )}
                      </option>
                      <option value="summary">
                        {t(
                          "Highest-score summary · reference",
                          "最高分汇总 · 参考",
                        )}
                      </option>
                    </select>
                  </label>
                )}
                <span className="toolbar-space" />
                <span className="results-count">
                  {pts.length} {t("points in view", "个数据点")}
                </span>
              </div>
              {(activeFilters.length > 0 || state.selected !== null) && (
                <div className="chips">
                  {state.selected !== null && (
                    <button onClick={() => patch({ selected: null })}>
                      {selectedIds.size} {t("selected points", "已选数据点")}
                      <X size={12} />
                    </button>
                  )}
                  {activeFilters.map(({ k, v }) => (
                    <button key={k + v} onClick={() => toggleFilter(k, v)}>
                      {filterLabels[k][zh ? 1 : 0]}: {filterValue(v)}
                      <X size={12} />
                    </button>
                  ))}
                  <button className="clear-all" onClick={reset}>
                    {t("Reset all", "重置全部")}
                  </button>
                </div>
              )}
              <div className="legend">
                {[...new Set(pts.map((p) => p.channel))].sort().map((c) => (
                  <span key={c}>
                    <i
                      style={{
                        background: color(pts.find((p) => p.channel === c)!),
                      }}
                    />
                    {c}
                  </span>
                ))}
                {state.view === "pareto" && state.frontier && (
                  <span className="frontier-legend">
                    <i />
                    {t("Frontier of current selection", "当前筛选前沿")}
                  </span>
                )}
              </div>
              {state.view === "allowance" && (
                <div
                  className="fee-bands"
                  aria-label={t("Monthly subscription fee", "订阅月费分档")}
                >
                  <strong>{t("Monthly fee", "按订阅月费")}</strong>
                  <div>
                    <button
                      aria-pressed={state.feeBand === "all"}
                      onClick={() => patch({ feeBand: "all" })}
                    >
                      {t("All", "全部")}
                    </button>
                    {feeBands.map((b) => (
                      <button
                        key={b.id}
                        aria-pressed={state.feeBand === b.id}
                        title={zh ? b.labelZh : b.labelEn}
                        onClick={() => patch({ feeBand: b.id })}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <small>
                    {t(
                      "USD per month · CNY plans use the project exchange rate. All includes plans over $300.",
                      "美元 / 月 · 人民币套餐按项目汇率折算；全部包含超过 $300 的套餐。",
                    )}
                  </small>
                </div>
              )}
              {!pts.length || (state.view === "pareto" && !gs.length) ? (
                <div className="empty">
                  <ChartScatter size={35} />
                  <h3>{t("No points to plot", "没有可绘制的数据点")}</h3>
                  <p>
                    {pts.length
                      ? t(
                          "These models have no matching score for this benchmark configuration. Their data is still in the table.",
                          "当前模型没有匹配的榜单配置分数，仍可在表格中查看。",
                        )
                      : t(
                          "Try another selection or clear your filters.",
                          "请调整选择或清除筛选。",
                        )}
                  </p>
                  <button onClick={reset}>
                    {t("Reset selection", "恢复全部数据")}
                  </button>
                </div>
              ) : state.view !== "pareto" ? (
                <Ranking
                  rows={rows}
                  state={state}
                  onSelect={setDetail}
                  handle={chart}
                  onQuery={(query) => patch({ query })}
                />
              ) : (
                <Chart
                  rows={rows}
                  state={state}
                  data={data}
                  onSelect={setDetail}
                  handle={chart}
                />
              )}
              <div className="chart-foot">
                <div>
                  <Info size={15} />
                  <span>
                    {state.view === "pareto"
                      ? t(
                          "Further right is cheaper. Higher is more capable. Click a point to see its evidence.",
                          "越右越便宜，越高能力越强。点击数据点查看证据。",
                        )
                      : t(
                          "Scroll inside the list to browse all results. Select any row to inspect its sources.",
                          "在列表窗口内滚动浏览全部结果，点击任意一行查看来源。",
                        )}
                  </span>
                </div>
                {state.view === "pareto" && (
                  <span>
                    {gs.length} {t("plotted coordinates", "绘制坐标")} ·{" "}
                    {front.length} {t("frontier coordinates", "前沿坐标")}
                  </span>
                )}
              </div>
              {state.view === "pareto" && noScore.length > 0 && (
                <details className="unscored">
                  <summary>
                    {noScore.length}{" "}
                    {t(
                      "points without a matching score",
                      "个数据点缺少匹配分数",
                    )}
                  </summary>
                  <p>
                    {t(
                      "No archived score matches this model and the current configuration filters. No score is inferred.",
                      "当前模型与配置筛选没有匹配的存档分数，不推算补分。",
                    )}
                  </p>
                  <div>
                    {noScore.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setDetail([
                            { key: p.id, point: p, mapping: null, score: null },
                          ])
                        }
                      >
                        {p.model_display} · {displayPlan(p.plan, state.lang)}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </section>
            <div className="method-note">
              <Info size={16} />
              <p>
                {t(
                  "A price floor at saturated use. All tokens count; a month is 4 weeks, except Kimi’s independent 5-week pool. Model allowances within a plan are alternatives, not additive.",
                  "这是饱和使用时的价格下限。所有 token 均计入；默认月为 4 周，Kimi 独立月池为周池的 5 倍。同套餐不同模型额度不能相加。",
                )}{" "}
                <button onClick={() => patch({ view: "method" })}>
                  {t("Read the methodology", "查看完整口径")}
                  <ArrowUpRight size={13} />
                </button>
              </p>
            </div>
            <section className="data-section" id="all-data" tabIndex={-1}>
              <div className="table-heading">
                <div>
                  <h2>{t("The data, in detail.", "数据明细。")}</h2>
                  <p>
                    {t(
                      "Every plan, configuration, and source — ready to explore.",
                      "查看每个套餐、评测配置与数据来源。",
                    )}
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    downloadText(
                      csv(shown, state.lang),
                      "real-api-pricing-selection.csv",
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <DownloadSimple size={16} />
                  {t("Export CSV", "导出 CSV")}
                </button>
              </div>
              <div className="table-tools">
                <label className="search">
                  <MagnifyingGlass size={17} />
                  <input
                    aria-label={t("Search table", "搜索表格")}
                    placeholder={t(
                      "Search models, plans or configurations…",
                      "搜索模型、套餐或配置…",
                    )}
                    value={state.query}
                    onChange={(e) => patch({ query: e.target.value })}
                  />
                  {state.query && (
                    <button
                      className="icon-button"
                      onClick={() => patch({ query: "" })}
                      aria-label={t("Clear search", "清空搜索")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <span>
                  {shown.length} {t("rows", "行")}
                  {state.view !== "pareto" && (
                    <span className="table-reference">
                      {" "}
                      ·{" "}
                      {t(
                        "Score: highest matching reference",
                        "分数：匹配配置最高参考值",
                      )}
                    </span>
                  )}
                </span>
              </div>
              <div className="table-scroll" ref={tableScroll} role="region" tabIndex={0} aria-label={t("Scrollable data table", "可滚动数据明细表")}>
                <table>
                  <thead>
                    <tr>
                      <th className="row-number">#</th>
                      {sortHead("model", "Model", "模型")}
                      {sortHead("plan", "Plan / channel", "套餐 / 渠道")}
                      {sortHead(
                        "price",
                        "Real price / MTok",
                        "真实单价 / MTok",
                      )}
                      {sortHead("fee", "Monthly fee", "订阅月费")}
                      {sortHead("allowance", "Monthly tokens", "月 token")}
                      {sortHead("score", "Score", "分数")}
                      <th>{t("Quota confidence", "额度置信度")}</th>
                      <th>
                        <span className="sr-only">{t("Details", "详情")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => (
                      <tr
                        key={r.key}
                        onClick={() => setDetail([r])}
                        className={
                          frontRows.has(r.key) && state.view === "pareto"
                            ? "frontier-row"
                            : ""
                        }
                      >
                        <td className="row-number">{i + 1}</td>
                        <td>
                          <button
                            className="model-cell"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail([r]);
                            }}
                          >
                            <i
                              className="vendor-dot"
                              style={{ background: color(r.point) }}
                            />
                            <span>
                              <strong className="model-with-logo">
                                <BrandMarks point={r.point} />
                                {r.point.model_display}
                              </strong>
                              {r.mapping && state.view === "pareto" && (
                                <small>
                                  {r.mapping.agent_harness ??
                                    t("Unreported harness", "未报告框架")}{" "}
                                  ·{" "}
                                  {r.mapping.reasoning_effort ??
                                    t("Unreported effort", "未报告强度")}
                                  {r.mapping.service_mode
                                    ? " · " + r.mapping.service_mode
                                    : ""}
                                </small>
                              )}
                            </span>
                          </button>
                        </td>
                        <td>
                          <strong className="plan-name">
                            {displayPlan(r.point.plan, state.lang)}
                          </strong>
                          <small>
                            {accessLine(r.point)} · {filterValue(r.point.billing)}
                          </small>
                        </td>
                        <td className="numeric real-price">
                          {price(r.point.real_usd_per_mtok)}
                        </td>
                        <td className="numeric">
                          {r.point.billing === "metered"
                            ? "—"
                            : price(r.point.price_usd)}
                          {r.point.currency === "CNY" && (
                            <small>¥{r.point.original_price}</small>
                          )}
                        </td>
                        <td className="numeric">
                          {allowance(r.point, state.lang)}
                        </td>
                        <td className="numeric">
                          {number(r.score, state.lang, 2)}
                          {r.mapping?.score_is_estimated && <small>{t("AA estimate", "AA 估计值")}</small>}
                        </td>
                        <td>
                          <span className={`confidence ${r.point.confidence}`}>
                            <i />
                            {filterValue(r.point.confidence)}
                          </span>
                        </td>
                        <td>
                          <ArrowUpRight size={15} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!shown.length && (
                  <div className="empty table-empty">
                    {t(
                      "No matching rows. Try clearing the table search.",
                      "没有匹配行，请尝试清除表格搜索。",
                    )}
                  </div>
                )}
              </div>
              <p className="ranking-status">{shown.length} {t("rows · scroll inside the table", "行 · 在表格内滚动浏览")}</p>
            </section>
          </>
        )}
      </main>
      <footer>
        <span>Real API Pricing</span>
        <p>
          {t(
            "Transparent numbers. Informed choices.",
            "透明的数据，更有依据的选择。",
          )}
        </p>
        <a
          href={`${REPO}/blob/main/SOURCES.md`}
          target="_blank"
          rel="noreferrer"
        >
          {t("Sources & attribution", "来源与署名")}
          <ArrowUpRight size={13} />
        </a>
        <a href="/data/points.json" download>
          {t("Open data", "开放数据")}
          <ArrowUpRight size={13} />
        </a>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {panel && (
        <Modal
          title={
            panel === "models"
              ? t("Choose models & plans", "选择模型与套餐")
              : panel === "filters"
                ? t("Refine your view", "筛选数据")
                : panel === "display"
                  ? t("Chart settings", "图表设置")
                  : panel === "share"
                    ? t("Share this view", "分享当前视图")
                    : t("Take the data with you", "下载图表与数据")
          }
          onClose={() => setPanel(null)}
          wide={panel === "models" || panel === "filters"}
          closeLabel={t("Close", "关闭")}
        >
          {panel === "models" && (
            <>
              <p className="panel-description">
                {t(
                  "Choose a model, then refine its access channels and plans. All selections update the chart and table together.",
                  "选择整个模型，或展开选择具体渠道和套餐。图表与表格同步更新。",
                )}
              </p>
              <label className="search">
                <MagnifyingGlass size={18} />
                <input
                  autoFocus
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder={t(
                    "Search any model, channel or plan…",
                    "搜索模型、渠道或套餐…",
                  )}
                  aria-label={t("Search model selection", "搜索模型选择")}
                />
              </label>
              <div className="selection-actions">
                <span>
                  {selectedIds.size} / {data.points.length}{" "}
                  {t("selected", "已选择")}
                </span>
                <button onClick={() => patch({ selected: null })}>
                  {t("Select all", "全选")}
                </button>
                <button onClick={() => patch({ selected: [] })}>
                  {t("Clear", "清空")}
                </button>
                <button
                  onClick={() => {
                    patch({ selected: null });
                    setModelSearch("");
                  }}
                >
                  {t("Restore default", "恢复默认")}
                </button>
              </div>
              <div className="model-list">
                {models
                  .filter(([, points]) =>
                    points.some((p) =>
                      `${p.model_display} ${p.channel} ${displayPlan(p.plan, state.lang)}`
                        .toLowerCase()
                        .includes(modelSearch.toLowerCase()),
                    ),
                  )
                  .map(([id, points]) => {
                    const selected = points.filter((p) =>
                      selectedIds.has(p.id),
                    ).length;
                    return (
                      <details key={id} className="model-group">
                        <summary>
                          <span onClick={(e) => e.stopPropagation()}>
                            <CheckBox
                              checked={selected === points.length}
                              mixed={selected > 0 && selected < points.length}
                              onChange={() =>
                                changeSelection(
                                  points.map((p) => p.id),
                                  selected !== points.length,
                                )
                              }
                              label={points[0].model_display}
                            />
                          </span>
                          <span className="model-summary">
                            <strong className="model-with-logo">
                              <ProviderLogo provider={manufacturer(points[0].vendor)} />
                              {points[0].model_display}
                            </strong>
                            <small>
                              {manufacturer(points[0].vendor)} · {points.length}{" "}
                              {t("plans", "个套餐")}
                            </small>
                          </span>
                          <span className="selection-fraction">
                            {selected}/{points.length}
                          </span>
                          <CaretDown size={14} />
                        </summary>
                        <div className="plan-options">
                          {[...new Set(points.map((p) => p.channel))].map(
                            (channel) => (
                              <div key={channel}>
                                <h4>{channel}</h4>
                                {points
                                  .filter((p) => p.channel === channel)
                                  .map((p) => (
                                    <label key={p.id}>
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.has(p.id)}
                                        onChange={() =>
                                          changeSelection(
                                            [p.id],
                                            !selectedIds.has(p.id),
                                          )
                                        }
                                      />
                                      <span>
                                        {displayPlan(p.plan, state.lang)}
                                      </span>
                                      <small>
                                        {price(p.real_usd_per_mtok)} / MTok
                                      </small>
                                    </label>
                                  ))}
                              </div>
                            ),
                          )}
                        </div>
                      </details>
                    );
                  })}
              </div>
              <div className="panel-bottom">
                <button className="primary" onClick={() => setPanel(null)}>
                  {t("Show selection", "查看所选数据")}
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </>
          )}
          {panel === "filters" && (
            <>
              <p className="panel-description">
                {t(
                  "Selections within a group are combined. Different groups narrow the results together. Configuration filters affect score references; unscored plans remain in the table.",
                  "同组条件取并集，不同组共同筛选。评测配置筛选影响分数参考，无匹配分数的套餐仍保留在表格中。",
                )}
              </p>
              <div className="filter-grid">
                {filterKeys.map((k) => (
                  <fieldset key={k}>
                    <legend>
                      {filterLabels[k][zh ? 1 : 0]}{" "}
                      {state[k].length > 0 && (
                        <button onClick={() => patch({ [k]: [] })}>
                          {t("Clear", "清除")}
                        </button>
                      )}
                    </legend>
                    <div className="filter-options">
                      {opts[k].map((v) => (
                        <label key={v}>
                          <input
                            type="checkbox"
                            checked={state[k].includes(v)}
                            onChange={() => toggleFilter(k, v)}
                          />
                          {filterValue(v)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="panel-bottom">
                <button
                  onClick={() =>
                    patch(Object.fromEntries(filterKeys.map((k) => [k, []])))
                  }
                >
                  {t("Clear all filters", "清除全部筛选")}
                </button>
                <button className="primary" onClick={() => setPanel(null)}>
                  {t("Show results", "查看结果")} · {pts.length}
                </button>
              </div>
            </>
          )}
          {panel === "display" && (
            <div className="settings">
              <label>
                <span>
                  {t("Show frontier of current selection", "显示当前筛选前沿")}
                </span>
                <input
                  type="checkbox"
                  checked={state.frontier}
                  onChange={(e) => patch({ frontier: e.target.checked })}
                />
              </label>
              <label>
                <span>{t("Point labels", "数据点标签")}</span>
                <select
                  value={state.labels}
                  onChange={(e) =>
                    patch({ labels: e.target.value as State["labels"] })
                  }
                >
                  <option value="frontier">
                    {t("Frontier only", "仅前沿")}
                  </option>
                  <option value="all">{t("All points", "全部数据点")}</option>
                  <option value="none">{t("None", "不显示")}</option>
                </select>
              </label>
              <p className="panel-description">
                {t(
                  "These settings apply to the price–capability chart. All data remains visible regardless of label density. Drag to pan; double-click to reset the chart.",
                  "设置作用于价格 × 能力图。标签密度不改变数据集。拖动平移，双击恢复图表。",
                )}
              </p>
            </div>
          )}
          {panel === "download" && (
            <div className="download-list">
              <h3>{t("Current selection", "当前选择")}</h3>
              {(["png", "svg"] as const).map((format) => (
                <button
                  key={format}
                  disabled={!chart.current || state.view === "method"}
                  onClick={async () => {
                    try {
                      await chart.current?.download(format);
                      setToast(t("Chart exported.", "图表已导出。"));
                    } catch {
                      setToast(
                        t(
                          "Could not export the chart. Please try again.",
                          "图表导出失败，请重试。",
                        ),
                      );
                    }
                  }}
                >
                  <DownloadSimple />
                  {t("Chart", "图表")} · {format.toUpperCase()}
                  <ArrowUpRight />
                </button>
              ))}
              <button
                onClick={() =>
                  downloadText(
                    csv(shown, state.lang),
                    "real-api-pricing-selection.csv",
                    "text/csv;charset=utf-8",
                  )
                }
              >
                <DownloadSimple />
                {t("Table", "表格")} · CSV
                <ArrowUpRight />
              </button>
              <h3>{t("Complete source data", "完整源数据")}</h3>
              {[
                "adopted.csv",
                "points.json",
                "benchmark-configurations.json",
                "benchmark-points.json",
                "conventions.json",
              ].map((f) => (
                <a key={f} href={"/data/" + f} download>
                  <DownloadSimple />
                  {f}
                  <ArrowUpRight />
                </a>
              ))}
            </div>
          )}
          {panel === "share" && (
            <>
              <p>
                {t(
                  "Copy this link to restore the same view and filters.",
                  "复制链接即可恢复相同视图和筛选。",
                )}
              </p>
              <textarea
                className="share-url"
                readOnly
                value={location.href}
                onFocus={(e) => e.target.select()}
                aria-label={t("Share link", "分享链接")}
              />
            </>
          )}
        </Modal>
      )}
      {detail && (
        <Modal
          title={t("Behind the number", "数据背后的依据")}
          wide
          onClose={() => setDetail(null)}
          closeLabel={t("Close", "关闭")}
        >
          <Details rows={detail} data={data} lang={state.lang} />
        </Modal>
      )}
    </>
  );
}
function Details({
  rows,
  data,
  lang,
}: {
  rows: Row[];
  data: SiteData;
  lang: Lang;
}) {
  const zh = lang === "zh";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const points = [...new Map(rows.map((r) => [r.point.id, r.point])).values()];
  return (
    <div className="details-content">
      {rows.length > 1 && (
        <p className="reference-note">
          {t(
            "This coordinate contains multiple plan/configuration references. Each is retained below.",
            "此坐标包含多个套餐或评测配置，以下逐一保留。",
          )}
        </p>
      )}
      {points.map((p) => (
        <article key={p.id}>
          <div className="detail-title">
            <span className="vendor-dot" style={{ background: color(p) }} />
            <h3 className="model-with-logo">
              <BrandMarks point={p} />
              {p.model_display}
            </h3>
          </div>
          <p>
            {displayPlan(p.plan, lang)} · {accessLine(p)}
          </p>
          <div className="detail-metrics">
            <div>
              <small>{t("Real price / MTok", "真实单价 / MTok")}</small>
              <strong>{price(p.real_usd_per_mtok)}</strong>
            </div>
            <div>
              <small>{t("Monthly tokens", "月 token")}</small>
              <strong>{allowance(p, lang)}</strong>
            </div>
            <div>
              <small>{t("Quota confidence", "额度置信度")}</small>
              <strong>
                {zh
                  ? ({ high: "高", medium: "中", low: "低" }[p.confidence] ??
                    p.confidence)
                  : p.confidence}
              </strong>
            </div>
          </div>
          <div className="formula">
            {p.billing === "metered" ? (
              t(
                "Metered API · public token prices weighted by the project standard workload.",
                "按量 API · 三段公开标价按项目标准负载加权。",
              )
            ) : (
              <>
                {price(p.price_usd)} {t("/ month", "/ 月")}
                {p.currency === "CNY" ? ` (¥${p.original_price})` : ""} ÷{" "}
                {number(p.monthly_tokens, lang, 0)} tokens × 1,000,000 ≈{" "}
                {price(p.real_usd_per_mtok)} / MTok
              </>
            )}
          </div>
          <h4>
            {t(
              "Adoption evidence · original source text",
              "采用依据 · 原始来源文字",
            )}
          </h4>
          <p className="original-text">{p.source}</p>
          {p.decision_note && (
            <p className="original-text">{p.decision_note}</p>
          )}
          {p.note && p.note !== p.decision_note && (
            <p className="original-text">{p.note}</p>
          )}
          <div className="source-links">
            {p.evidence.map((e, i) => (
              <a key={i} href={safeUrl(e.url)} target="_blank" rel="noreferrer">
                {e.label}
                <ArrowUpRight size={13} />
              </a>
            ))}
            <a
              href={`${REPO}/tree/main/data/research`}
              target="_blank"
              rel="noreferrer"
            >
              {t("Browse the public evidence archive", "浏览公开证据存档")}
              <ArrowUpRight size={13} />
            </a>
          </div>
          <h4>{t("Benchmark references", "评测配置参考")}</h4>
          {rows
            .filter((r) => r.point.id === p.id && r.mapping)
            .map((r) => {
              const m = r.mapping!;
              return (
                <section className="configuration-detail" key={r.key}>
                  <strong>{m.variant}</strong>
                  <dl>
                    <dt>{t("Score", "分数")}</dt>
                    <dd>{number(m.score, lang, 4)}{m.score_is_estimated ? t(" · AA estimate; independent evaluation pending", " · AA 估计值，独立评测待完成") : ""}</dd>
                    <dt>{t("Score interval", "分数区间")}</dt>
                    <dd>
                      {number(m.score_low, lang)} – {number(m.score_high, lang)}
                    </dd>
                    <dt>Harness / effort / mode</dt>
                    <dd>
                      {m.agent_harness ?? "—"} / {m.reasoning_effort ?? "—"} /{" "}
                      {m.service_mode ?? "—"}
                    </dd>
                    <dt>{t("Mapping confidence", "映射置信度")}</dt>
                    <dd>{m.mapping_confidence}</dd>
                    <dt>
                      {t(
                        "Source task cost (mean / median)",
                        "来源任务成本（均值 / 中位数）",
                      )}
                    </dt>
                    <dd>
                      {m.mean_cost_usd_per_task == null
                        ? "—"
                        : price(m.mean_cost_usd_per_task)}{" "}
                      /{" "}
                      {m.median_cost_usd_per_task == null
                        ? "—"
                        : price(m.median_cost_usd_per_task)}
                    </dd>
                  </dl>
                  <p>
                    {t(
                      "This is a reference mapping, not a benchmark of this subscription/API channel. Harness and quota-measurement effort alignment are unverified. Source task costs are not subscription task costs.",
                      "这是参考映射，并非该订阅/API 渠道的评测。产品框架和额度实测推理强度的对应关系未经验证。来源任务成本不等于订阅任务成本。",
                    )}
                  </p>
                  <p className="original-text">{m.mapping_note}</p>
                  <a href={safeUrl(m.source)} target="_blank" rel="noreferrer">
                    {data.boards[m.board]?.name ?? m.board}
                    <ArrowUpRight size={14} />
                  </a>
                </section>
              );
            })}
          {!rows.some((r) => r.point.id === p.id && r.mapping) && (
            <p>
              {t(
                "No score matches the selected benchmark and configuration filters.",
                "所选榜单与配置筛选没有匹配分数。",
              )}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
function Method({
  data,
  zh,
  onBack,
}: {
  data: SiteData;
  zh: boolean;
  onBack: () => void;
}) {
  const t = (en: string, cn: string) => (zh ? cn : en);
  const mix = data.conventions.standardTokenMix;
  return (
    <section className="method-page">
      <div className="eyebrow">
        {t("HOW TO READ THE DATA", "如何理解这些数据")}
      </div>
      <h1>{t("Every number has a story.", "每个数字，都有依据。")}</h1>
      <p className="method-lead">
        {t(
          "Our contribution is the real price axis. Capability scores come from independent leaderboards, with their original context preserved.",
          "本项目的核心是可信的真实单价轴。能力分数引用独立榜单，并保留原始评测语境。",
        )}
      </p>
      <div className="big-formula">
        <span>{t("Real unit price", "真实单价")}</span>
        <strong>
          {t(
            "Monthly fee ÷ usable monthly tokens",
            "订阅月费 ÷ 每月实际可用 token",
          )}
        </strong>
        <small>USD / 1,000,000 tokens</small>
      </div>
      <div className="method-grid">
        <article>
          <h2>
            01 <span>{t("A floor, not a promise", "价格下限")}</span>
          </h2>
          <p>
            {t(
              "Allowances assume saturated use. Lower usage increases your effective price. All token types count equally: input, output, cache reads, and cache writes in measured totals. We do not adjust for tokenizer differences or utilization.",
              "额度按饱和使用估算；实际使用不足时单价更高。输入、输出、缓存读写一视同仁，实测采用工具上报 total。不进行分词器或利用率二阶修正。",
            )}
          </p>
          <p>
            {t(
              `A month defaults to ${data.conventions.monthWeeks} weeks. Kimi has an independent monthly pool equal to five weekly pools. Model allowances within the same plan are alternatives and must not be summed.`,
              `默认月为 ${data.conventions.monthWeeks} 周；Kimi 独立月池等于周池的 5 倍。同套餐不同模型额度为替代关系，不可相加。`,
            )}
          </p>
        </article>
        <article>
          <h2>
            02 <span>{t("One comparison workload", "统一比较负载")}</span>
          </h2>
          <p>
            {t(
              "Dollar/credit pools priced at public rates and metered APIs are converted using the same three-part workload. Direct total-token measurements are not normalized again. Vendor dashboard dollars are calibrated from measured usage, not treated as public-price dollars.",
              "按公开标价记账的美元/credits 池与按量 API，使用统一三段负载折算。直接 total-token 实测不重复归一。厂商面板额度美元使用实测标定，不当成公开标价美元。",
            )}
          </p>
          <div className="mix-values">
            <span>
              <b>{number(mix.cache * 100, "en", 3)}%</b>
              {t("Cache reads", "缓存读取")}
            </span>
            <span>
              <b>{number(mix.input * 100, "en", 3)}%</b>
              {t("Fresh input", "普通输入")}
            </span>
            <span>
              <b>{number(mix.output * 100, "en", 3)}%</b>
              {t("Output", "输出")}
            </span>
          </div>
          <p>
            {t(
              "This is a comparison convention, not a measured workload. Cache-write charges are not modeled separately, so converted allowances may be overstated where they apply.",
              "这是比较基准，不代表实测负载。折算未单列缓存写入费用，另收写入费的渠道可能高估可用额度。",
            )}
          </p>
        </article>
        <article>
          <h2>
            03 <span>{t("Keep the benchmark context", "保留评测语境")}</span>
          </h2>
          <p>
            {t(
              "Each leaderboard uses one selected snapshot; different benchmark versions are never mixed. Code Arena refers to WebDev Overall, not general coding ability. All configurations in that snapshot are shown by default; highest-score summaries are optional references. Harness, reasoning effort, service mode, and known score intervals are retained.",
              "每张榜单使用一份选定快照，不混合不同版本的分数。Code Arena 指 WebDev Overall，不代表通用编程能力。默认保留该快照的全部配置，最高分汇总仅为可选参考。保留框架、推理强度、模式与已知分数区间。",
            )}
          </p>
          <p>
            {t(
              "Mappings do not verify a subscription’s harness or quota-measurement effort. Missing scores remain missing. Qualitative confidence is not a numerical error bar, and score intervals do not change frontier membership.",
              "参考映射不验证订阅框架或额度实测强度。缺分不补分。定性置信度不等于数值误差条；分数区间不改变前沿成员。",
            )}
          </p>
        </article>
        <article>
          <h2>
            04 <span>{t("Follow the evidence", "追溯证据")}</span>
          </h2>
          <p>
            {t(
              "High: dashboard back-calculations, controlled saturation measurements, or official absolute-token/credit tables. Medium: usage logs plus quota reports, or official ratios applied to a strong baseline. Low: single reports, third-party summaries, and cross-plan assumptions.",
              "高：面板反推、受控饱和实测、官方绝对 token/积分表。中：用量日志与额度口述、官方倍率与高等级基准。低：单一口述、第三方综述与跨套餐假设。",
            )}
          </p>
          <p>
            {t(
              "Conflicting historical evidence is archived. The adopted decision and its rationale are exposed for every point. Original evidence text is preserved in its source language.",
              "矛盾的历史证据完整存档。每个点展示采用值、取舍理由及来源，原始证据文字保留原语言。",
            )}
          </p>
        </article>
      </div>
      <section className="method-sources">
        <h2>{t("Independent leaderboards", "独立榜单来源")}</h2>
        {Object.entries(data.boards).map(([id, b]) => (
          <a key={id} href={b.url} target="_blank" rel="noreferrer">
            <span>
              {b.name}
              <small>
                {b.metric} · {t("Snapshot", "快照")} {b.snapshot}
              </small>
            </span>
            <ArrowUpRight size={18} />
          </a>
        ))}
        <p>
          {t("Currency conversion", "货币换算")}：1 USD ={" "}
          {data.conventions.usdPerCny} CNY ·{" "}
          {data.conventions.exchangeRate.date} ·{" "}
          <a
            href={data.conventions.exchangeRate.source}
            target="_blank"
            rel="noreferrer"
          >
            {zh
              ? data.conventions.exchangeRate.labelZh
              : data.conventions.exchangeRate.labelEn}
          </a>
        </p>
        <p>
          <a
            href={`${REPO}/blob/main/SOURCES.md`}
            target="_blank"
            rel="noreferrer"
          >
            {t("Full attribution & licensing", "完整署名与许可")}
          </a>{" "}
          ·{" "}
          <a href="/data/adopted.csv" download>
            {t("Download adopted data", "下载采用数据")}
          </a>{" "}
          ·{" "}
          <a href="/data/benchmark-configurations.json" download>
            {t("All benchmark configurations", "全部评测配置")}
          </a>
        </p>
      </section>
      <button className="primary" onClick={onBack}>
        {t("Explore the data", "探索数据")}
        <ArrowUpRight size={17} />
      </button>
    </section>
  );
}
