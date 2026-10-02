import {
  defaultState,
  displayPlan,
  feeBands,
  manufacturer,
  rowsFor,
  tableRows,
  visiblePoints,
} from "../../web/src/domain.js";
import type { Mapping, Point, Row, SiteData, State } from "../../web/src/types.js";
import {
  CliError,
  type Benchmark,
  type DatasetContext,
  type ListOptions,
  type Metadata,
  type PublicPoint,
  type QueryOptions,
  type QueryRow,
  type Resource,
  type Result,
  type ShowRow,
  type Warning,
} from "./types.js";

const compareIds = (a: string, b: string) => a.localeCompare(b);
const unique = (values: string[]) => [...new Set(values)].sort(compareIds);

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(next[j]! + 1, previous[j + 1]! + 1,
        previous[j]! + Number(a[i] !== b[j])));
    previous = next;
  }
  return previous[b.length]!;
}

function checkIds(values: string[], allowed: string[], kind: string, data?: SiteData) {
  const valid = new Set(allowed);
  for (const value of values) {
    if (valid.has(value)) continue;
    let message = `Unknown ${kind} ID ${JSON.stringify(value)}.`;
    if (kind === "company" && data?.points.some((p) => p.channel === value))
      message += ` ${value} is a Channel. Use --channel ${value}.`;
    else {
      const candidates = allowed.map((id) => ({
        id, distance: editDistance(value.toLowerCase(), id.toLowerCase()),
      })).sort((a, b) => a.distance - b.distance || compareIds(a.id, b.id));
      const candidate = candidates[0];
      if (candidate && candidate.distance <= Math.max(2, Math.floor(value.length / 3)))
        message += ` Did you mean ${JSON.stringify(candidate.id)}?`;
    }
    throw new CliError(message);
  }
}

function checkBoard(data: SiteData, board?: string) {
  if (board !== undefined) checkIds([board], Object.keys(data.boards), "board");
}

function checkNumber(value: number | undefined, flag: string, integer = false, positive = false) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || (positive && value === 0) ||
      (integer && !Number.isSafeInteger(value)))
    throw new CliError(`--${flag} must be a ${positive ? "positive" : "non-negative"} ${integer ? "safe integer" : "finite number"}.`);
}

function checkBounds(min: number | undefined, max: number | undefined, kind: string, integer = false) {
  checkNumber(min, `min-${kind}`, integer);
  checkNumber(max, `max-${kind}`, integer);
  if (min !== undefined && max !== undefined && min > max)
    throw new CliError(`--min-${kind} cannot exceed --max-${kind}.`);
}

function inRange(value: number | null, min?: number, max?: number) {
  if (min === undefined && max === undefined) return true;
  return value !== null && (min === undefined || value >= min) && (max === undefined || value <= max);
}

export function publicPoint(point: Point): PublicPoint {
  return {
    ...point,
    company: point.vendor,
    company_display: manufacturer(point.vendor),
    plan_display: displayPlan(point.plan, "en"),
  };
}

/** A promotion's adopted values stay intact; expiry is a review warning only. */
function warningsFor(points: Point[]): Warning[] {
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  return points.flatMap((point): Warning[] => {
    if (!point.promo_until || point.promo_until >= today || seen.has(point.id)) return [];
    seen.add(point.id);
    return [{
      code: "expired_promotion",
      message: `Promotion expired on ${point.promo_until}; review the adopted price and allowance before relying on them.`,
      point_id: point.id,
    }];
  });
}

function result<T>(
  ctx: DatasetContext,
  command: Metadata["command"],
  rows: T[],
  options: {
    resource?: Resource;
    view?: Metadata["view"];
    board?: string;
    total?: number;
    warnings?: Warning[];
  } = {},
): Result<T> {
  const total = options.total ?? rows.length;
  return {
    schemaVersion: 1,
    meta: {
      command,
      resource: options.resource ?? null,
      snapshot: ctx.data.generatedAt,
      source: ctx.source,
      sourcePath: ctx.sourcePath,
      view: options.view ?? null,
      board: options.board ?? null,
      boardSnapshot: options.board ? ctx.data.boards[options.board]!.snapshot : null,
      total,
      returned: rows.length,
      truncated: rows.length < total,
      warnings: options.warnings ?? [],
    },
    rows,
  };
}

function mappingMatches(mapping: Mapping, opts: QueryOptions): boolean {
  const matches = (selected: string[], value: string | null) =>
    !selected.length || selected.includes(value ?? "unknown");
  return matches(opts.harness, mapping.agent_harness) &&
    matches(opts.effort, mapping.reasoning_effort) &&
    matches(opts.modes, mapping.service_mode);
}

function bestMapping(mappings: Mapping[]): Benchmark | null {
  if (!mappings.length) return null;
  // Exactly the website's stable first-on-tie reduction.
  const best = mappings.reduce((a, b) => a.score >= b.score ? a : b);
  return { ...best, best_tie_count: mappings.filter((m) => m.score === best.score).length };
}

/** Strict dominance preserves every configuration/point tied at the same price and score. */
function frontierRows(rows: Row[]): Row[] {
  const scored = rows.filter((row) => row.score !== null);
  return scored.filter((row) => !scored.some((other) =>
    other.point.real_usd_per_mtok <= row.point.real_usd_per_mtok &&
    other.score! >= row.score! &&
    (other.point.real_usd_per_mtok < row.point.real_usd_per_mtok || other.score! > row.score!),
  ));
}

export function executeQuery(ctx: DatasetContext, opts: QueryOptions): Result<QueryRow> {
  const data = ctx.data;
  if (!["price", "allowance", "table"].includes(opts.view))
    throw new CliError(`Unknown view ${JSON.stringify(opts.view)}. Use price, allowance, or table.`);
  checkIds(opts.models, unique(data.points.map((p) => p.model)), "model");
  checkIds(opts.companies, unique(data.points.map((p) => p.vendor)), "company", data);
  checkIds(opts.channels, unique(data.points.map((p) => p.channel)), "channel");
  checkIds(opts.plans, unique(data.points.map((p) => p.plan_id)), "plan");
  checkIds(opts.billing, ["subscription", "metered"], "billing");
  checkIds(opts.confidence, ["high", "medium", "low"], "confidence");
  checkBoard(data, opts.board);
  checkIds(opts.harness, unique(data.mappings.map((m) => m.agent_harness ?? "unknown")), "harness");
  checkIds(opts.effort, unique(data.mappings.map((m) => m.reasoning_effort ?? "unknown")), "effort");
  checkIds(opts.modes, unique(data.mappings.map((m) => m.service_mode ?? "unknown")), "mode");
  checkIds([opts.feeBand], ["all", ...feeBands.map((b) => b.id)], "fee band");
  checkIds([opts.config], ["best", "all"], "config");
  checkBounds(opts.minFee, opts.maxFee, "fee");
  checkBounds(opts.minPrice, opts.maxPrice, "price");
  checkBounds(opts.minTokens, opts.maxTokens, "tokens", true);
  checkNumber(opts.minScore, "min-score");
  checkNumber(opts.limit, "limit", true, true);
  const sortMatch = /^(price|fee|allowance|score|model|plan)(?::(asc|desc))?$/.exec(opts.sort);
  if (!sortMatch) throw new CliError(`Invalid --sort ${JSON.stringify(opts.sort)}. Use price|fee|allowance|score|model|plan[:asc|desc].`);
  if (!opts.board) {
    const required = opts.harness.length ? "harness" : opts.effort.length ? "effort" :
      opts.modes.length ? "mode" : opts.config === "all" ? "config" :
      opts.minScore !== undefined ? "min-score" : opts.scoredOnly ? "scored-only" :
      opts.frontier ? "frontier" : sortMatch[1] === "score" ? "sort score" : null;
    if (required) throw new CliError(`--${required} requires --board.`);
  }
  if (opts.view !== "allowance" && opts.feeBand !== "all")
    throw new CliError("--fee-band requires the allowance view.");
  if (opts.view !== "table" && (opts.config === "all" || opts.minScore !== undefined || opts.scoredOnly || opts.frontier))
    throw new CliError("Score filters, frontier, and --config are available only with query --view table.");

  const selected = opts.models.length || opts.plans.length
    ? data.points.filter((p) => (!opts.models.length || opts.models.includes(p.model)) &&
      (!opts.plans.length || opts.plans.includes(p.plan_id))).map((p) => p.id)
    : null;
  const state: State = {
    ...defaultState(),
    lang: "en",
    view: opts.view,
    board: opts.board ?? defaultState().board,
    selected,
    vendors: opts.companies,
    channels: opts.channels,
    billing: opts.billing,
    confidence: opts.confidence,
    feeBand: opts.feeBand,
    harness: opts.harness,
    effort: opts.effort,
    modes: opts.modes,
    configuration: opts.view === "table" && opts.board && opts.config === "all" ? "all" : "summary",
    query: opts.search,
    sort: opts.view === "price" ? "price" : opts.view === "allowance" ? "allowance" : sortMatch[1]!,
    direction: opts.view === "allowance" ? "desc" : opts.view === "price" ? "asc" : (sortMatch[2] ?? "asc") as "asc" | "desc",
  };
  const points = visiblePoints(data, state).filter((p) =>
    inRange(p.price_usd, opts.minFee, opts.maxFee) &&
    inRange(p.real_usd_per_mtok, opts.minPrice, opts.maxPrice) &&
    inRange(p.monthly_tokens, opts.minTokens, opts.maxTokens),
  );
  let rows = tableRows(rowsFor({ ...data, points }, state), state).filter((row) =>
    (!opts.scoredOnly || row.score !== null) &&
    (opts.minScore === undefined || (row.score !== null && row.score >= opts.minScore)),
  );
  if (opts.frontier) rows = frontierRows(rows);
  const total = rows.length;
  const mappingsByPoint = new Map<string, Mapping[]>();
  if (opts.board && opts.config === "best")
    for (const mapping of data.mappings)
      if (mapping.board === opts.board && mappingMatches(mapping, opts))
        mappingsByPoint.set(mapping.point_id, [...(mappingsByPoint.get(mapping.point_id) ?? []), mapping]);
  const output = rows.slice(0, opts.limit).map((row, i): QueryRow => ({
    ...(opts.view === "table" ? {} : { rank: i + 1 }),
    point: publicPoint(row.point),
    benchmark: !opts.board || !row.mapping ? null : opts.config === "best"
      ? bestMapping(mappingsByPoint.get(row.point.id) ?? []) : { ...row.mapping },
  }));
  return result(ctx, opts.view === "table" ? "query" : opts.view, output, {
    view: opts.view,
    board: opts.board,
    total,
    warnings: warningsFor(output.map((row) => row.point)),
  });
}

export function executeList(ctx: DatasetContext, resource: Resource, opts: ListOptions): Result {
  const data = ctx.data;
  if (!["models", "companies", "channels", "plans", "boards"].includes(resource))
    throw new CliError(`Unknown list resource ${JSON.stringify(resource)}.`);
  if ((resource === "companies" || resource === "boards") && opts.companies.length)
    throw new CliError(`--company is not supported by list ${resource}.`);
  if ((resource === "channels" || resource === "boards") && opts.channels.length)
    throw new CliError(`--channel is not supported by list ${resource}.`);
  checkIds(opts.companies, unique(data.points.map((p) => p.vendor)), "company", data);
  checkIds(opts.channels, unique(data.points.map((p) => p.channel)), "channel");
  checkNumber(opts.limit, "limit", true, true);
  const points = visiblePoints(data, { ...defaultState(), vendors: opts.companies, channels: opts.channels });
  const grouped = new Map<string, Point[]>();
  if (resource !== "boards")
    for (const point of points) {
      const id = resource === "models" ? point.model : resource === "companies" ? point.vendor :
        resource === "channels" ? point.channel : point.plan_id;
      grouped.set(id, [...(grouped.get(id) ?? []), point]);
    }
  const count = (ps: Point[], field: "model" | "plan_id" | "channel") => new Set(ps.map((p) => p[field])).size;
  const rows: Record<string, unknown>[] = resource === "boards"
    ? Object.keys(data.boards).sort(compareIds).map((board) => ({
      board,
      name: data.boards[board]!.name,
      metric: data.boards[board]!.metric,
      snapshot: data.boards[board]!.snapshot,
      configurations: data.configurations.filter((c) => c.board === board).length,
    }))
    : [...grouped].sort(([a], [b]) => compareIds(a, b)).map(([id, ps]) => {
      const point = ps[0]!;
      const stats = { models: count(ps, "model"), plans: count(ps, "plan_id"), points: ps.length };
      if (resource === "models") return {
        model: id, model_display: point.model_display, company: point.vendor,
        company_display: manufacturer(point.vendor), plans: stats.plans,
        channels: count(ps, "channel"), points: stats.points,
      };
      if (resource === "companies") return { company: id, company_display: manufacturer(id), ...stats };
      if (resource === "channels") return { channel: id, ...stats };
      return {
        plan_id: id, plan_display: displayPlan(point.plan, "en"), channel: point.channel,
        companies: unique(ps.map((p) => p.vendor)), models: stats.models, points: stats.points,
      };
    });
  const query = opts.search.toLocaleLowerCase().trim();
  const searched = rows.filter((row) => {
    const text = resource === "models" ? `${row.model} ${row.model_display}` :
      resource === "companies" ? `${row.company} ${row.company_display}` :
      resource === "channels" ? String(row.channel) : resource === "plans" ? `${row.plan_id} ${row.plan_display}` :
      `${row.board} ${row.name}`;
    return !query || text.toLocaleLowerCase().includes(query);
  });
  return result(ctx, "list", searched.slice(0, opts.limit), { resource, total: searched.length });
}

function pointFor(data: SiteData, id: string): Point {
  checkIds([id], data.points.map((p) => p.id), "point");
  return data.points.find((point) => point.id === id)!;
}

export function executeShow(ctx: DatasetContext, id: string, board?: string): Result<ShowRow> {
  checkBoard(ctx.data, board);
  const point = pointFor(ctx.data, id);
  const benchmarks = ctx.data.mappings.filter((mapping) =>
    mapping.point_id === id && (board === undefined || mapping.board === board),
  ).map((mapping) => ({ ...mapping }));
  return result(ctx, "show", [{ point: publicPoint(point), benchmarks }], {
    board, warnings: warningsFor([point]),
  });
}

export function executeCompare(ctx: DatasetContext, ids: string[], board?: string): Result<QueryRow> {
  checkBoard(ctx.data, board);
  if (ids.length < 2) throw new CliError("compare requires at least two distinct point IDs.");
  if (new Set(ids).size !== ids.length) throw new CliError("compare requires distinct point IDs; duplicate IDs were supplied.");
  const points = ids.map((id) => pointFor(ctx.data, id));
  const rows = points.map((point): QueryRow => ({
    point: publicPoint(point),
    benchmark: board === undefined ? null : bestMapping(ctx.data.mappings.filter((mapping) =>
      mapping.point_id === point.id && mapping.board === board,
    )),
  }));
  return result(ctx, "compare", rows, { board, warnings: warningsFor(points) });
}

export function executeInfo(ctx: DatasetContext): Result {
  const data = ctx.data;
  return result(ctx, "info", [{
    snapshot: data.generatedAt,
    source: ctx.source,
    source_path: ctx.sourcePath,
    datasetVersion: data.version,
    counts: {
      points: data.points.length,
      models: new Set(data.points.map((p) => p.model)).size,
      companies: new Set(data.points.map((p) => p.vendor)).size,
      channels: new Set(data.points.map((p) => p.channel)).size,
      plans: new Set(data.points.map((p) => p.plan_id)).size,
      boards: Object.keys(data.boards).length,
      configurations: data.configurations.length,
      mappings: data.mappings.length,
    },
    conventions: {
      ...data.conventions,
      subscriptionPriceAssumption: "Full use of the adopted allowance",
      allowancesAcrossModels: "Alternative use; do not add together",
      measuredWorkload: "Raw sample tokens; not workload-normalized",
    },
  }]);
}
