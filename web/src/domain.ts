import type { State, SiteData, Row, Point, Group, FilterKey } from "./types";
import feeBandDefinitions from "../../config/allowance-fee-bands.json";
export const feeBands = feeBandDefinitions;
export function matchesFeeBand(fee: number | null, id: string): boolean {
  if (id === "all") return true;
  const band = feeBands.find((b) => b.id === id);
  return (
    fee !== null &&
    !!band &&
    (band.minInclusive ? fee >= band.min : fee > band.min) &&
    (band.maxInclusive ? fee <= band.max : fee < band.max)
  );
}
export const filterKeys: FilterKey[] = [
  "vendors",
  "channels",
  "plans",
  "billing",
  "confidence",
  "harness",
  "effort",
  "modes",
];
export const colors: Record<string, string> = {
  OpenAI: "#00A86B",
  Anthropic: "#F07826",
  xAI: "#B65CFF",
  Cursor: "#FFB81C",
  Kimi: "#2FA8FF",
  Zhipu: "#1E1E1E",
  MiniMax: "#D23A7D",
  Alibaba: "#FF4545",
  OpenCode: "#00B9A4",
  DeepSeek: "#1F75FE",
  Google: "#82BE2C",
  "Command Code": "#64748B",
  Ollama: "#A0785C",
  Xiaomi: "#FFA000",
  Tencent: "#26C6DA",
  StepFun: "#00F4E5",
  Devin: "#7C3AED",
};
export const defaultState = (): State => ({
  feeBand: "all",
  lang: "en",
  view: "pareto",
  board: "aa_intelligence_index",
  selected: null,
  vendors: [],
  channels: [],
  plans: [],
  billing: [],
  confidence: [],
  harness: [],
  effort: [],
  modes: [],
  configuration: "summary",
  frontier: true,
  labels: "frontier",
  find: "",
  lock: null,
  query: "",
  sort: "price",
  direction: "asc",
});
export const color = (p: Point) => colors[p.channel] || "#00A8A8";
/** Channel colour at a given alpha, for search-hit rings. */
export function colorAlpha(p: Point, alpha: number): string {
  const hex = color(p);
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
const matches = (items: string[], value: string | null) =>
  !items.length || items.includes(value ?? "unknown");
export function options(data: SiteData): Record<FilterKey, string[]> {
  const unique = (values: (string | null)[]) =>
    [...new Set(values.map((v) => v ?? "unknown"))].sort();
  return {
    vendors: unique(data.points.map((p) => p.vendor)),
    channels: unique(data.points.map((p) => p.channel)),
    plans: unique(data.points.map((p) => p.plan)),
    billing: unique(data.points.map((p) => p.billing)),
    confidence: unique(data.points.map((p) => p.confidence)),
    harness: unique(data.mappings.map((m) => m.agent_harness)),
    effort: unique(data.mappings.map((m) => m.reasoning_effort)),
    modes: unique(data.mappings.map((m) => m.service_mode)),
  };
}
export function visiblePoints(data: SiteData, s: State): Point[] {
  const chosen = s.selected === null ? null : new Set(s.selected);
  return data.points.filter(
    (p) =>
      (!chosen || chosen.has(p.id)) &&
      matches(s.vendors, p.vendor) &&
      matches(s.channels, p.channel) &&
      matches(s.plans, p.plan) &&
      matches(s.billing, p.billing) &&
      matches(s.confidence, p.confidence) &&
      (s.view !== "allowance" ||
        (p.billing !== "metered" &&
          p.monthly_yi !== null &&
          matchesFeeBand(p.price_usd, s.feeBand))),
  );
}
export function rowsFor(data: SiteData, s: State): Row[] {
  const byPoint = new Map<string, typeof data.mappings>();
  for (const m of data.mappings)
    if (
      m.board === s.board &&
      matches(s.harness, m.agent_harness) &&
      matches(s.effort, m.reasoning_effort) &&
      matches(s.modes, m.service_mode)
    )
      byPoint.set(m.point_id, [...(byPoint.get(m.point_id) || []), m]);
  return visiblePoints(data, s).flatMap((p) => {
    let mappings = byPoint.get(p.id) || [];
    if (s.configuration === "summary" && mappings.length)
      mappings = [mappings.reduce((a, b) => (a.score >= b.score ? a : b))];
    if (s.view !== "pareto") {
      const m = mappings.length
        ? mappings.reduce((a, b) => (a.score >= b.score ? a : b))
        : null;
      return [{ key: p.id, point: p, mapping: m, score: m?.score ?? null }];
    }
    return mappings.length
      ? mappings.map((m) => ({
          key: `${p.id}|${m.configuration_id}`,
          point: p,
          mapping: m,
          score: m.score,
        }))
      : [{ key: p.id, point: p, mapping: null, score: null }];
  });
}
export function tableRows(rows: Row[], s: State): Row[] {
  const q = s.query.toLocaleLowerCase().trim();
  const value = (r: Row): number | string | null =>
    s.sort === "model"
      ? r.point.model_display
      : s.sort === "plan"
        ? r.point.plan
        : s.sort === "score"
          ? r.score
          : s.sort === "allowance"
            ? r.point.monthly_yi
            : s.sort === "fee"
              ? r.point.price_usd
              : r.point.real_usd_per_mtok;
  return rows
    .filter(
      (r) =>
        !q ||
        `${r.point.label} ${displayPlan(r.point.plan, s.lang)} ${r.point.channel} ${r.mapping?.variant ?? ""}`
          .toLocaleLowerCase()
          .includes(q),
    )
    .sort((a, b) => {
      const av = value(a),
        bv = value(b);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === "string"
          ? av.localeCompare(String(bv))
          : Number(av) - Number(bv);
      return (
        (s.direction === "asc" ? 1 : -1) * cmp || a.key.localeCompare(b.key)
      );
    });
}
/** Unmetered ($0) groups are drawn this far to the right of the cheapest priced group. */
export const ZERO_SLOT_RATIO = 3.5;
export const isUnmetered = (p: Point) =>
  !!p.unmetered && p.real_usd_per_mtok === 0;
export function zeroSlot(prices: number[]): number {
  const priced = prices.filter((v) => v > 0);
  return (priced.length ? Math.min(...priced) : 0.001) / ZERO_SLOT_RATIO;
}
export function groups(rows: Row[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows)
    if (
      r.score !== null &&
      Number.isFinite(r.score) &&
      (r.point.real_usd_per_mtok > 0 || isUnmetered(r.point))
    ) {
      const key = `${r.point.real_usd_per_mtok}|${r.score}`;
      const g = map.get(key);
      if (g) g.rows.push(r);
      else
        map.set(key, {
          key,
          price: r.point.real_usd_per_mtok,
          plotPrice: r.point.real_usd_per_mtok,
          score: r.score,
          rows: [r],
        });
    }
  const out = [...map.values()];
  const slot = zeroSlot(out.map((g) => g.price));
  for (const g of out) if (g.price === 0) g.plotPrice = slot;
  return out;
}
export function pareto(gs: Group[]): Group[] {
  let best = -Infinity;
  const result: Group[] = [];
  for (const g of [...gs].sort(
    (a, b) => a.price - b.price || b.score - a.score,
  ))
    if (g.score > best) {
      result.push(g);
      best = g.score;
    }
  return result;
}
export function frontierPath(
  front: Group[],
  minPrice: number,
  maxPrice: number,
) {
  if (!front.length) return { x: [], y: [] };
  return {
    x: [minPrice, ...front.map((g) => g.plotPrice), maxPrice],
    y: [
      front[0].score,
      ...front.map((g) => g.score),
      front[front.length - 1].score,
    ],
  };
}
export type LockKind = "point" | "model" | "plan";
export interface Lock {
  kind: LockKind;
  value: string;
}
/** URL form "kind:value"; a point id itself contains "::", so split on the first colon only. */
export function serializeLock(l: Lock): string {
  return `${l.kind}:${l.value}`;
}
export function parseLock(raw: string): Lock | null {
  const i = raw.indexOf(":");
  if (i < 0) return null;
  const kind = raw.slice(0, i);
  const value = raw.slice(i + 1);
  if (kind !== "point" && kind !== "model" && kind !== "plan") return null;
  return value ? { kind, value } : null;
}
/** Marked hits are capped so a loose query cannot bury the chart in labels. */
export const SEARCH_MARK_CAP = 8;
/** Model name without the plan-generation tag: a model lock spans generations. */
export function modelFamilyLabel(p: Point): string {
  const tag = p.plan_gen ? ` (${p.plan_gen})` : "";
  return tag && p.model_display.endsWith(tag)
    ? p.model_display.slice(0, -tag.length)
    : p.model_display;
}
export function searchTokens(query: string): string[] {
  return query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
}
export function rowMatches(r: Row, tokens: string[], lang: string): boolean {
  if (!tokens.length) return false;
  const haystack = [
    r.point.model_display,
    r.point.model,
    r.point.label,
    displayPlan(r.point.plan, lang),
    r.point.plan,
    r.point.plan_en ?? "",
    r.point.channel,
    manufacturer(r.point.vendor),
    r.mapping?.variant ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase();
  // AND semantics: "kimi 199" must hit the plan name and the model together.
  return tokens.every((t) => haystack.includes(t));
}
/** Matching rows across the plotted groups, deduped by point id, in display order. */
export function searchMatches(
  gs: Group[],
  query: string,
  lang: string,
): Row[] {
  const tokens = searchTokens(query);
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const g of gs)
    for (const r of g.rows)
      if (!seen.has(r.point.id) && rowMatches(r, tokens, lang)) {
        seen.add(r.point.id);
        out.push(r);
      }
  const first = tokens[0] ?? "";
  return out.sort(
    (a, b) =>
      Number(b.point.model_display.toLocaleLowerCase().startsWith(first)) -
        Number(a.point.model_display.toLocaleLowerCase().startsWith(first)) ||
      a.point.real_usd_per_mtok - b.point.real_usd_per_mtok ||
      a.point.model_display.localeCompare(b.point.model_display),
  );
}
export interface SearchHits {
  /** Group keys to annotate. */
  keys: Set<string>;
  /** Live mode: matching points before the cap. Locked: points the lock covers. */
  total: number;
  /** Resolved lock, for the chip and the status line. */
  locked: { kind: LockKind; label: string; points: number } | null;
  /** True when a lock is set but nothing it names is in the current selection. */
  lockMissing: boolean;
}
export function searchHits(
  gs: Group[],
  query: string,
  lock: Lock | null,
  lang: string,
  cap = SEARCH_MARK_CAP,
): SearchHits {
  // A lock ignores the live query and is uncapped: it marks exactly what the
  // user chose — one point, a model across plans, or a plan across models.
  if (lock) {
    const hit =
      lock.kind === "point"
        ? (r: Row) => r.point.id === lock.value
        : lock.kind === "model"
          ? (r: Row) => r.point.model === lock.value
          : (r: Row) => r.point.plan_id === lock.value;
    const keys = new Set<string>();
    const ids = new Set<string>();
    let first: Row | null = null;
    for (const g of gs)
      for (const r of g.rows)
        if (hit(r)) {
          keys.add(g.key);
          ids.add(r.point.id);
          first ??= r;
        }
    if (!first)
      return { keys: new Set(), total: 0, locked: null, lockMissing: true };
    const label =
      lock.kind === "point"
        ? `${first.point.model_display} · ${displayPlan(first.point.plan, lang)}`
        : lock.kind === "model"
          ? modelFamilyLabel(first.point)
          : displayPlan(first.point.plan, lang);
    return {
      keys,
      total: ids.size,
      locked: { kind: lock.kind, label, points: ids.size },
      lockMissing: false,
    };
  }
  const matches = searchMatches(gs, query, lang);
  const rowGroup = new Map<Row, Group>();
  for (const g of gs) for (const r of g.rows) rowGroup.set(r, g);
  const keys = new Set<string>();
  for (const r of matches) {
    if (keys.size >= cap) break;
    const g = rowGroup.get(r);
    if (g) keys.add(g.key);
  }
  return { keys, total: matches.length, locked: null, lockMissing: false };
}
export interface SearchGroupCandidate {
  kind: "model" | "plan";
  /** point.model or point.plan_id. */
  value: string;
  /** modelFamilyLabel for models; displayPlan(plan, lang) for plans. */
  label: string;
  /** Distinct points this lock would mark. */
  points: number;
  /** Lowest real price among them. */
  cheapest: number;
  /** Representative row (the cheapest one) for logos and score. */
  row: Row;
  /** Best score among the points this lock covers. */
  score: number | null;
}
export interface SearchCandidates {
  models: SearchGroupCandidate[];
  plans: SearchGroupCandidate[];
  points: Row[];
}
export function searchCandidates(
  gs: Group[],
  query: string,
  lang: string,
): SearchCandidates {
  const tokens = searchTokens(query);
  // Scoped haystacks per candidate kind: matching "cursor" must list Cursor
  // plans but not the Grok model — locking that model would mark Grok points
  // served by other channels too.
  const modelHay = (r: Row) =>
    [r.point.model_display, r.point.model, manufacturer(r.point.vendor)]
      .join(" ")
      .toLocaleLowerCase();
  const planHay = (r: Row) =>
    [
      r.point.plan,
      displayPlan(r.point.plan, lang),
      r.point.plan_en ?? "",
      r.point.channel,
    ]
      .join(" ")
      .toLocaleLowerCase();
  const allIn = (hay: string) => tokens.every((t) => hay.includes(t));
  // The haystack decides only which slugs are listed; every statistic is
  // computed over all rows a lock would cover, so the subtitle never
  // promises less than locking delivers.
  const modelRows = new Map<string, Row[]>();
  const planRows = new Map<string, Row[]>();
  const modelHit = new Set<string>();
  const planHit = new Set<string>();
  for (const g of gs)
    for (const r of g.rows) {
      modelRows.set(r.point.model, [...(modelRows.get(r.point.model) || []), r]);
      planRows.set(r.point.plan_id, [...(planRows.get(r.point.plan_id) || []), r]);
      if (tokens.length && allIn(modelHay(r))) modelHit.add(r.point.model);
      if (tokens.length && allIn(planHay(r))) planHit.add(r.point.plan_id);
    }
  const cheapestRow = (rows: Row[]) =>
    rows.reduce((a, b) =>
      a.point.real_usd_per_mtok <= b.point.real_usd_per_mtok ? a : b,
    );
  const first = tokens[0] ?? "";
  const prefixed = (label: string) =>
    Number(label.toLocaleLowerCase().startsWith(first));
  const groupCandidate = (
    kind: "model" | "plan",
    value: string,
    label: string,
    rows: Row[],
  ): SearchGroupCandidate => {
    const row = cheapestRow(rows);
    const scores = rows
      .map((r) => r.score)
      .filter((s): s is number => s !== null);
    return {
      kind,
      value,
      label,
      points: new Set(rows.map((r) => r.point.id)).size,
      cheapest: row.point.real_usd_per_mtok,
      row,
      score: scores.length ? Math.max(...scores) : null,
    };
  };
  const models: SearchGroupCandidate[] = [...modelHit]
    .map((value) => {
      const rows = modelRows.get(value)!;
      return groupCandidate(
        "model",
        value,
        modelFamilyLabel(cheapestRow(rows).point),
        rows,
      );
    })
    .sort(
      (a, b) =>
        prefixed(b.label) - prefixed(a.label) ||
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        a.label.localeCompare(b.label),
    );
  const plans: SearchGroupCandidate[] = [...planHit]
    .map((value) => {
      const rows = planRows.get(value)!;
      return groupCandidate(
        "plan",
        value,
        displayPlan(cheapestRow(rows).point.plan, lang),
        rows,
      );
    })
    .sort(
      (a, b) =>
        prefixed(b.label) - prefixed(a.label) ||
        (a.row.point.price_usd ?? Infinity) -
          (b.row.point.price_usd ?? Infinity) ||
        a.label.localeCompare(b.label),
    );
  return { models, plans, points: searchMatches(gs, query, lang) };
}
export function serialize(s: State): string {
  const d = defaultState();
  const p = new URLSearchParams();
  // The URL language always wins over the stored preference, so it is written
  // even when it matches the default.
  p.set("lang", s.lang);
  if (s.view !== d.view) p.set("view", s.view);
  if (s.board !== d.board) p.set("board", s.board);
  if (s.configuration !== d.configuration) p.set("config", s.configuration);
  if (s.labels !== d.labels) p.set("labels", s.labels);
  if (s.feeBand !== d.feeBand) p.set("fee", s.feeBand);
  if (s.query) p.set("q", s.query);
  if (s.find) p.set("find", s.find);
  if (s.lock) p.set("lock", serializeLock(s.lock));
  if (s.sort !== d.sort) p.set("sort", s.sort);
  if (s.direction !== d.direction) p.set("dir", s.direction);
  if (!s.frontier) p.set("frontier", "0");
  if (s.selected !== null) {
    // An explicit empty selection serializes as a lone "sel=" so it stays
    // distinct from an absent parameter (which means "select everything").
    if (s.selected.length)
      for (const id of s.selected) p.append("sel", id);
    else p.set("sel", "");
  }
  for (const k of filterKeys) for (const v of s[k]) p.append(k, v);
  return "#" + p.toString();
}
export function restore(
  hash: string,
  data: SiteData,
  storedLang: string | null = null,
): { state: State; warning: boolean } {
  const state = defaultState();
  if (storedLang === "zh") state.lang = "zh";
  if (!hash || hash === "#") return { state, warning: false };
  const params = new URLSearchParams(hash.slice(1));
  const legacy = params.get("s");
  if (legacy !== null) return restoreLegacy(legacy, state, data);
  let warning = false;
  const enums: Record<string, [keyof State, string[]]> = {
    lang: ["lang", ["en", "zh"]],
    view: ["view", ["pareto", "price", "allowance", "method"]],
    config: ["configuration", ["all", "summary"]],
    labels: ["labels", ["frontier", "all", "none"]],
    fee: ["feeBand", ["all", ...feeBands.map((b) => b.id)]],
    sort: ["sort", ["price", "model", "plan", "score", "allowance", "fee"]],
    dir: ["direction", ["asc", "desc"]],
  };
  for (const [key, [field, values]] of Object.entries(enums)) {
    const value = params.get(key);
    if (value === null) continue;
    if (values.includes(value)) Object.assign(state, { [field]: value });
    else warning = true;
  }
  const board = params.get("board");
  if (board !== null) {
    if (Object.hasOwn(data.boards, board)) state.board = board;
    else warning = true;
  }
  const frontier = params.get("frontier");
  if (frontier !== null) {
    if (frontier === "0") state.frontier = false;
    else if (frontier === "1") state.frontier = true;
    else warning = true;
  }
  const query = params.get("q");
  if (query !== null) state.query = query;
  const find = params.get("find");
  if (find !== null) state.find = find;
  const lock = params.get("lock");
  if (lock !== null) {
    const parsed = parseLock(lock);
    const known =
      parsed &&
      (parsed.kind === "point"
        ? data.points.some((p) => p.id === parsed.value)
        : parsed.kind === "model"
          ? data.points.some((p) => p.model === parsed.value)
          : data.points.some((p) => p.plan_id === parsed.value));
    if (known) state.lock = parsed;
    else warning = true;
  }
  if (params.has("sel")) {
    const wanted = params.getAll("sel").filter((id) => id !== "");
    if (!wanted.length) state.selected = [];
    else {
      const ids = new Set(data.points.map((p) => p.id));
      state.selected = wanted.filter((id) => ids.has(id));
      if (state.selected.length !== wanted.length) warning = true;
    }
  }
  const opts = options(data);
  for (const k of filterKeys) {
    if (!params.has(k)) continue;
    const wanted = params.getAll(k);
    state[k] = wanted.filter((v) => opts[k].includes(v));
    if (state[k].length !== wanted.length) warning = true;
  }
  return { state, warning };
}
/** The original "#s=<json>" share format; kept so old links still resolve. */
function restoreLegacy(
  s: string,
  state: State,
  data: SiteData,
): { state: State; warning: boolean } {
  try {
    const raw = JSON.parse(s);
    if (!raw || raw.v !== 1) return { state, warning: true };
    let warning = false;
    const enums = {
      feeBand: ["all", ...feeBands.map((b) => b.id)],
      lang: ["en", "zh"],
      view: ["pareto", "price", "allowance", "method"],
      configuration: ["all", "summary"],
      labels: ["frontier", "all", "none"],
      sort: ["price", "model", "plan", "score", "allowance", "fee"],
      direction: ["asc", "desc"],
    };
    for (const [key, values] of Object.entries(enums)) {
      if (values.includes(raw[key])) Object.assign(state, { [key]: raw[key] });
      else if (raw[key] !== undefined) warning = true;
    }
    if (typeof raw.board === "string" && Object.hasOwn(data.boards, raw.board))
      state.board = raw.board;
    else if (raw.board !== undefined) warning = true;
    if (typeof raw.frontier === "boolean") state.frontier = raw.frontier;
    if (typeof raw.query === "string") state.query = raw.query;
    if (Array.isArray(raw.selected)) {
      const ids = new Set(data.points.map((p) => p.id));
      const selected: string[] = raw.selected.filter(
        (id: unknown) => typeof id === "string" && ids.has(id),
      );
      state.selected = selected;
      if (selected.length !== raw.selected.length) warning = true;
    } else if (raw.selected !== null && raw.selected !== undefined)
      warning = true;
    const opts = options(data);
    for (const k of filterKeys) {
      if (Array.isArray(raw[k])) {
        state[k] = raw[k].filter(
          (v: unknown) => typeof v === "string" && opts[k].includes(v),
        );
        if (state[k].length !== raw[k].length) warning = true;
      } else if (raw[k] !== undefined) warning = true;
    }
    return { state, warning };
  } catch {
    return { state, warning: true };
  }
}
export const number = (n: number | null, lang = "en", digits = 3) =>
  n === null
    ? "—"
    : new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
        maximumFractionDigits: digits,
      }).format(n);
export const price = (n: number | null) =>
  n === null
    ? "—"
    : n === 0
      ? "≈$0"
      : "$" +
      new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 }).format(n);
export const allowance = (p: Point, lang: string) =>
  p.monthly_yi === null
    ? "—"
    : number(lang === "zh" ? p.monthly_yi : p.monthly_yi / 10, lang, 3) +
      (lang === "zh" ? " 亿" : " B");
/** Quota-basis line for the detail panel: which workload the capacity assumes. */
export function workloadLine(
  p: Point,
  conventions: SiteData["conventions"],
  lang: string,
): string {
  const zh = lang === "zh";
  const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;
  if (p.workload === "lowCache") {
    const m = conventions.lowCacheTokenMix;
    return zh
      ? `低缓存负载 —— 缓存读 ${pct(m.cache)} / 输入 ${pct(m.input)} / 输出 ${pct(m.output)}`
      : `Low-cache workload — ${pct(m.cache)} cache reads / ${pct(m.input)} input / ${pct(m.output)} output`;
  }
  if (p.workload === "measuredMix") {
    const m = conventions.mimoMeasuredTokenMix;
    return zh
      ? `用户面板实测负载 —— 缓存读 ${pct(m.cache)} / 输入 ${pct(m.input)} / 输出 ${pct(m.output)}`
      : `Panel-measured workload — ${pct(m.cache)} cache reads / ${pct(m.input)} input / ${pct(m.output)} output`;
  }
  if (p.workload === "standard") {
    const m = conventions.standardTokenMix;
    return zh
      ? `标准负载 —— 缓存读 ${pct(m.cache)} / 输入 ${pct(m.input)} / 输出 ${pct(m.output)}`
      : `Standard workload — ${pct(m.cache)} cache reads / ${pct(m.input)} input / ${pct(m.output)} output`;
  }
  return zh
    ? "实测口径 —— 面板/日志 raw token 直测或同源派生，不经负载折算"
    : "Measured real usage — raw tokens, no workload conversion";
}

/** Official metered API list prices, shown next to the workload basis. */
export function listPriceLine(p: Point, lang: string): string {
  const lp = p.list_price;
  if (!lp) return "";
  const sym = lp.currency === "CNY" ? "¥" : "$";
  const f = (n: number) =>
    sym + new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 }).format(n);
  const parts = `${f(lp.cached)} / ${f(lp.input)} / ${f(lp.output)}`;
  return lang === "zh"
    ? `官方 API 标价：缓存读 / 输入 / 输出 = ${parts}（每 MTok）`
    : `Official API list (cached / in / out, per MTok): ${parts}`;
}
export const safeUrl = (url: string) =>
  /^https?:\/\//i.test(url) || url.startsWith("/data/") ? url : undefined;
export const manufacturer = (vendor: string) =>
  vendor === "Muse" ? "Meta" : vendor === "Cognition" ? "Devin" : vendor;
/** Short promo/unmetered qualifier for a $0 point, or "" for priced points. */
export function unmeteredNote(p: Point, lang: string): string {
  if (!isUnmetered(p)) return "";
  const until = p.promo_until;
  if (!until) return lang === "zh" ? "不计额度" : "unmetered";
  return lang === "zh"
    ? `促销至 ${until}，不计额度`
    : `promo until ${until}, unmetered`;
}
/** Short badge for a vendor self-reported score. */
export function selfReportTag(lang: string): string {
  return lang === "zh" ? "厂商自报" : "self-reported";
}
/** Localize the bracketed provenance tags baked into variant names. */
export function variantLabel(variant: string, lang: string): string {
  if (lang !== "zh") return variant;
  return variant
    .replaceAll("[vendor self-report]", "[厂商自报]")
    .replaceAll("[AA estimate]", "[AA 估计值]");
}
export const isThirdParty = (p: Point) => p.channel !== manufacturer(p.vendor);
export const accessLine = (p: Point) =>
  isThirdParty(p)
    ? `${p.channel} | ${manufacturer(p.vendor)}`
    : p.channel;
export function displayPlan(plan: string, lang: string): string {
  if (plan.startsWith("GLM "))
    plan = plan.replaceAll("老客", "v2").replaceAll("新客", "v3");
  if (lang === "zh") return plan;
  const words: Record<string, string> = {
    // Same-name CN/global tiers are merged into one point priced at the
    // international USD list; English shows the international tier name.
    "Kimi 会员 199": "Kimi Allegretto",
    "Kimi 会员 99": "Kimi Moderato",
    "Kimi 会员 699": "Kimi Allegro",
    "Kimi 会员 49": "Kimi Andante (CN)",
    "Kimi 会员 ": "Kimi CN CNY ",
    阿里云百炼: "Alibaba Cloud CN",
    新客: "New",
    老客: "Existing",
    闲时: "Off-peak",
    中间值: "Midpoint",
    忙时: "Peak",
    "促销至 ": "promo until ",
  };
  return Object.entries(words).reduce(
    (s, [from, to]) => s.replaceAll(from, to),
    plan,
  );
}
export function csv(rows: Row[], lang: string): string {
  const headings =
    lang === "zh"
      ? [
          "数据点ID",
          "模型",
          "渠道",
          "套餐",
          "计费",
          "月费 USD",
          "原币价格",
          "币种",
          "月 token",
          "真实单价 USD/MTok",
          "额度置信度",
          "评测配置",
          "分数",
          "AA 估计值",
          "厂商自报",
          "Harness",
          "Effort",
          "分数来源",
          "采用依据",
        ]
      : [
          "Point ID",
          "Model",
          "Channel",
          "Plan",
          "Billing",
          "Monthly fee USD",
          "Original price",
          "Currency",
          "Monthly tokens",
          "Real price USD/MTok",
          "Quota confidence",
          "Benchmark configuration",
          "Score",
          "AA estimated score",
          "Vendor self-reported",
          "Harness",
          "Effort",
          "Score source",
          "Adoption source",
        ];
  const escape = (v: unknown) => {
    let t = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      headings,
      ...rows.map((r) => [
        r.point.id,
        r.point.model_display,
        r.point.channel,
        displayPlan(r.point.plan, lang),
        r.point.billing,
        r.point.billing === "metered" ? null : r.point.price_usd,
        r.point.original_price,
        r.point.currency,
        r.point.monthly_tokens,
        r.point.real_usd_per_mtok,
        r.point.confidence,
        r.mapping?.variant,
        r.score,
        r.mapping?.score_is_estimated,
        r.mapping?.score_is_self_reported,
        r.mapping?.agent_harness,
        r.mapping?.reasoning_effort,
        r.mapping?.source,
        r.point.source,
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n")
  );
}
