import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultState, rowsFor, tableRows } from "../../web/src/domain.js";
import { unpackData } from "../../web/src/loadData.js";
import type { Configuration, Mapping, Point, SiteData } from "../../web/src/types.js";
import { executeCompare, executeInfo, executeList, executeQuery, executeShow } from "../src/query.js";
import { CliError, type DatasetContext, type QueryOptions } from "../src/types.js";

const options = (overrides: Partial<QueryOptions> = {}): QueryOptions => ({
  view: "table", models: [], companies: [], channels: [], plans: [], billing: [], confidence: [],
  search: "", feeBand: "all", harness: [], effort: [], modes: [], config: "best",
  scoredOnly: false, frontier: false, sort: "price:asc", ...overrides,
});

function point(id: string, overrides: Partial<Point> = {}): Point {
  return {
    id: `${id}::model-a`, plan_id: id, plan: `Plan ${id}`, model: "model-a", model_display: "Model A",
    vendor: "Anthropic", channel: "Factory", label: `Model A · Plan ${id}`,
    billing: "subscription", confidence: "medium", price_usd: 30, original_price: 30, currency: "USD",
    monthly_yi: 10, monthly_tokens: 1_000_000_000, real_usd_per_mtok: 0.1,
    list_blended_usd_per_mtok: null, source: "fixture source", note: "", decision_note: "fixture adopted basis",
    evidence: [], ...overrides,
  };
}

function mapping(id: string, pointId: string, score: number, overrides: Partial<Mapping> = {}): Mapping {
  return {
    configuration_id: id, point_id: pointId, board: "aa_intelligence_index", variant: "Model A max",
    score, score_low: null, score_high: null, agent_harness: null, reasoning_effort: "max",
    service_mode: null, source: "benchmark fixture", mapping_kind: "family",
    mapping_confidence: "medium", mapping_note: "", quota_effort_matched: null, ...overrides,
  };
}

function fixture(): DatasetContext {
  const points = [
    point("free", { real_usd_per_mtok: 0, monthly_yi: null, monthly_tokens: null, unmetered: true, promo_until: "2000-01-01", price_usd: 20 }),
    point("small", { price_usd: 30, monthly_yi: 1, monthly_tokens: 100_000_000 }),
    point("mid", { price_usd: 100, monthly_yi: 2, monthly_tokens: 200_000_000, real_usd_per_mtok: 0.2 }),
    point("large", { price_usd: 300, monthly_yi: 4, monthly_tokens: 400_000_000, real_usd_per_mtok: 0.2 }),
    point("api", { price_usd: null, monthly_yi: null, monthly_tokens: null, billing: "metered", real_usd_per_mtok: 0.3 }),
    point("unknown", { monthly_yi: null, monthly_tokens: null, price_usd: 301, real_usd_per_mtok: 0.4 }),
    point("meta", { vendor: "Muse", channel: "Muse", model: "model-b", model_display: "Model B", id: "meta::model-b", plan: "Kimi 会员 199", real_usd_per_mtok: 0.5, price_usd: 301 }),
  ];
  const mappings = [
    // First input mapping wins the tie even though z sorts after a.
    mapping("z-best-first", points[1]!.id, 40),
    mapping("a-best-tie", points[1]!.id, 40, { reasoning_effort: "high", variant: "Model A high" }),
    mapping("low-score", points[2]!.id, 30, { reasoning_effort: "low" }),
    mapping("other-board", points[3]!.id, 99, { board: "another_board" }),
  ];
  return {
    source: "bundled", sourcePath: null,
    data: {
      version: 1, generatedAt: "2001-01-01", points, mappings,
      configurations: mappings.map(({ point_id: _p, mapping_kind: _k, mapping_confidence: _c, mapping_note: _n, quota_effort_matched: _q, ...config }) => ({ ...config, model: "model-a" } as Configuration)),
      boards: {
        aa_intelligence_index: { name: "Intelligence", metric: "Score", snapshot: "2000-12-31", url: "https://example.org" },
        another_board: { name: "Another board", metric: "Success %", snapshot: "2000-12-30", url: "https://example.org" },
      },
      conventions: {
        usdPerCny: 0.15, monthWeeks: 4,
        exchangeRate: { date: "2000-12-01", source: "fixture", labelEn: "fixture", labelZh: "样本" },
        standardTokenMix: { cache: .97, input: .025, output: .005 },
        lowCacheTokenMix: { cache: .85, input: .145, output: .005 },
        anthropicTokenMix: { cache: .97, cacheWrite: .025, output: .005 },
      },
    },
  };
}

const ids = (ctx: ReturnType<typeof executeQuery>) => ctx.rows.map((row) => row.point.id);

test("price ranking retains API, unknown allowance and unscored promotions, then limits", () => {
  const ctx = fixture();
  const full = executeQuery(ctx, options({ view: "price", companies: ["Anthropic"] }));
  assert.deepEqual(ids(full), ["free::model-a", "small::model-a", "large::model-a", "mid::model-a", "api::model-a", "unknown::model-a"]);
  assert.ok(full.rows.every((row) => row.benchmark === null));
  assert.equal(full.meta.board, null);
  assert.equal(full.meta.boardSnapshot, null);
  const limited = executeQuery(ctx, options({ view: "price", companies: ["Anthropic"], limit: 2 }));
  assert.deepEqual(limited.rows.map((row) => row.rank), [1, 2]);
  assert.equal(limited.meta.total, full.rows.length);
  assert.equal(limited.meta.returned, 2);
  assert.equal(limited.meta.truncated, true);
  assert.equal(limited.meta.warnings[0]?.point_id, "free::model-a");
  assert.equal(limited.rows[0]?.point.real_usd_per_mtok, 0);
  assert.equal(limited.rows[0]?.point.price_usd, 20);
});

test("allowance filters use exact website band boundaries and intersect fee/token ranges", () => {
  const ctx = fixture();
  assert.deepEqual(ids(executeQuery(ctx, options({ view: "allowance", companies: ["Anthropic"] }))),
    ["large::model-a", "mid::model-a", "small::model-a"]);
  for (const [feeBand, expected] of [["0-30", "small"], ["30-100", "mid"], ["100-300", "large"]])
    assert.deepEqual(ids(executeQuery(ctx, options({ view: "allowance", feeBand }))), [`${expected}::model-a`]);
  assert.deepEqual(ids(executeQuery(ctx, options({ view: "allowance", minFee: 30, maxFee: 100, minTokens: 100_000_000, maxTokens: 200_000_000 }))),
    ["mid::model-a", "small::model-a"]);
  assert.equal(executeQuery(ctx, options({ minFee: 0, plans: ["api"] })).rows.length, 0);
  assert.equal(executeQuery(ctx, options({ minTokens: 0, plans: ["unknown"] })).rows.length, 0);
});

test("company and channel filter independently, and public fields retain raw IDs and English display", () => {
  const ctx = fixture();
  assert.equal(executeQuery(ctx, options({ companies: ["Anthropic"], channels: ["Factory"] })).rows.length, 6);
  const row = executeQuery(ctx, options({ companies: ["Muse"] })).rows[0]!;
  assert.equal(row.point.company, "Muse");
  assert.equal(row.point.company_display, "Meta");
  assert.equal(row.point.plan_display, "Kimi Allegretto");
  assert.equal(row.point.plan, "Kimi 会员 199");
  assert.throws(() => executeQuery(ctx, options({ companies: ["Meta"] })), /Unknown company ID/);
  assert.throws(() => executeQuery(ctx, options({ companies: ["Factory"] })), /Factory is a Channel/);
});

test("search is trimmed whole substring and uses the implicit board's first best variant without exporting a benchmark", () => {
  const ctx = fixture();
  const hit = executeQuery(ctx, options({ search: "  model a max  " }));
  assert.deepEqual(ids(hit), ["small::model-a", "mid::model-a"]);
  assert.ok(hit.rows.every((row) => row.benchmark === null));
  assert.equal(executeQuery(ctx, options({ search: "model max" })).rows.length, 0);
  assert.equal(executeQuery(ctx, options({ search: "model a high" })).rows.length, 0);
});

test("best mapping ties retain first input, config all expands rows and configuration filters keep missing points", () => {
  const ctx = fixture();
  const best = executeQuery(ctx, options({ plans: ["small"], board: "aa_intelligence_index" }));
  assert.equal(best.rows[0]?.benchmark?.configuration_id, "z-best-first");
  assert.equal(best.rows[0]?.benchmark?.best_tie_count, 2);
  assert.equal(best.meta.boardSnapshot, "2000-12-31");
  const all = executeQuery(ctx, options({ plans: ["small", "large"], board: "aa_intelligence_index", config: "all" }));
  assert.deepEqual(all.rows.map((row) => row.benchmark?.configuration_id ?? null), ["a-best-tie", "z-best-first", null]);
  assert.ok(all.rows.every((row) => !Object.hasOwn(row, "rank")));
  const filtered = executeQuery(ctx, options({ board: "aa_intelligence_index", effort: ["high"] }));
  assert.equal(filtered.meta.total, ctx.data.points.length);
  assert.equal(filtered.rows.find((row) => row.point.plan_id === "small")?.benchmark?.best_tie_count, 1);
  assert.equal(executeQuery(ctx, options({ board: "aa_intelligence_index", effort: ["high"], scoredOnly: true })).rows.length, 1);
});

test("frontier excludes only strictly dominated rows and applies before limit", () => {
  const ctx = fixture();
  ctx.data.mappings = [
    mapping("small-first", "small::model-a", 40),
    mapping("small-tie", "small::model-a", 40),
    mapping("large-tie", "large::model-a", 50),
    mapping("mid-tie", "mid::model-a", 50),
    mapping("api-dominated", "api::model-a", 30),
  ];
  const result = executeQuery(ctx, options({ board: "aa_intelligence_index", config: "all", frontier: true }));
  assert.deepEqual(ids(result), ["small::model-a", "small::model-a", "large::model-a", "mid::model-a"]);
  const limited = executeQuery(ctx, options({ board: "aa_intelligence_index", config: "all", frontier: true, limit: 1 }));
  assert.equal(limited.meta.total, 4);
  assert.equal(limited.meta.returned, 1);
});

test("score thresholds are inclusive and null sorts last in either direction", () => {
  const ctx = fixture();
  assert.deepEqual(ids(executeQuery(ctx, options({ board: "aa_intelligence_index", minScore: 40 }))), ["small::model-a"]);
  for (const sort of ["fee:asc", "fee:desc"])
    assert.equal(executeQuery(ctx, options({ sort })).rows.at(-1)?.point.plan_id, "api");
  assert.deepEqual(ids(executeQuery(ctx, options({ board: "aa_intelligence_index", sort: "score:desc", scoredOnly: true }))),
    ["small::model-a", "mid::model-a"]);
});

test("bad IDs, enum values, unsafe bounds, and missing board are usage errors", () => {
  const ctx = fixture();
  const bad: Partial<QueryOptions>[] = [
    { models: ["missing"] }, { companies: ["Antropic"] }, { channels: ["missing"] }, { plans: ["missing"] },
    { board: "missing" }, { billing: ["annual"] }, { confidence: ["excellent"] }, { feeBand: "20-90" },
    { minFee: -1 }, { maxPrice: Infinity }, { minFee: 100, maxFee: 30 },
    { minTokens: 1.5 }, { maxTokens: Number.MAX_SAFE_INTEGER + 1 }, { limit: 0 }, { limit: 1.5 },
    { effort: ["max"] }, { harness: ["unknown"] }, { modes: ["unknown"] },
    { config: "all" }, { scoredOnly: true }, { minScore: 0 }, { frontier: true }, { sort: "score:desc" },
    { sort: "price:up" }, { config: "wrong" as QueryOptions["config"] },
  ];
  for (const opts of bad)
    assert.throws(() => executeQuery(ctx, options(opts)), (error) => error instanceof CliError && error.exitCode === 2);
  assert.throws(() => executeQuery(ctx, options({ companies: ["Antropic"] })), /Did you mean "Anthropic"/);
  assert.throws(() => executeQuery(ctx, options({ view: "price", feeBand: "0-30" })), /requires the allowance view/);
});

test("list statistics are distinct within the filter scope and resource search follows aggregation", () => {
  const ctx = fixture();
  const models = executeList(ctx, "models", { companies: ["Anthropic"], channels: ["Factory"], search: "model a" });
  assert.deepEqual(models.rows, [{ model: "model-a", model_display: "Model A", company: "Anthropic", company_display: "Anthropic", plans: 6, channels: 1, points: 6 }]);
  const companies = executeList(ctx, "companies", { companies: [], channels: ["Factory"], search: "" });
  assert.deepEqual(companies.rows, [{ company: "Anthropic", company_display: "Anthropic", models: 1, plans: 6, points: 6 }]);
  const plans = executeList(ctx, "plans", { companies: [], channels: [], search: "allegretto" });
  assert.deepEqual(plans.rows, [{ plan_id: "meta", plan_display: "Kimi Allegretto", channel: "Muse", companies: ["Muse"], models: 1, points: 1 }]);
  const channels = executeList(ctx, "channels", { companies: ["Anthropic"], channels: [], search: "" });
  assert.deepEqual(channels.rows, [{ channel: "Factory", models: 1, plans: 6, points: 6 }]);
  const boards = executeList(ctx, "boards", { companies: [], channels: [], search: "", limit: 1 });
  assert.equal(boards.meta.total, 2);
  assert.equal((boards.rows[0] as Record<string, unknown>).configurations, 3);
  assert.throws(() => executeList(ctx, "boards", { companies: ["Anthropic"], channels: [], search: "" }), /not supported by list boards/);
});

test("show preserves complete evidence and all boards; compare is ordered, strict, and uses best ties", () => {
  const ctx = fixture();
  const show = executeShow(ctx, "large::model-a");
  assert.equal(show.rows[0]?.benchmarks[0]?.board, "another_board");
  assert.equal(show.rows[0]?.point.source, "fixture source");
  assert.equal(executeShow(ctx, "large::model-a", "aa_intelligence_index").rows[0]?.benchmarks.length, 0);
  assert.equal(show.meta.total, 1);
  const compared = executeCompare(ctx, ["mid::model-a", "small::model-a"], "aa_intelligence_index");
  assert.deepEqual(ids(compared), ["mid::model-a", "small::model-a"]);
  assert.equal(compared.rows[1]?.benchmark?.best_tie_count, 2);
  assert.ok(executeCompare(ctx, ["mid::model-a", "small::model-a"]).rows.every((row) => row.benchmark === null));
  assert.throws(() => executeCompare(ctx, ["small::model-a"]), /at least two/);
  assert.throws(() => executeCompare(ctx, ["small::model-a", "small::model-a"]), /duplicate/);
  assert.throws(() => executeCompare(ctx, ["small::model-a", "missing"]), /Unknown point ID/);
  assert.throws(() => executeShow(ctx, "small::model-a", "missing"), /Unknown board ID/);
});

test("info counts local dataset dimensions without merging company display aliases", () => {
  const ctx = fixture();
  const row = executeInfo({ ...ctx, source: "file", sourcePath: "/tmp/site.json" }).rows[0] as Record<string, unknown>;
  assert.equal(row.snapshot, "2001-01-01");
  assert.equal(row.source, "file");
  assert.equal(row.source_path, "/tmp/site.json");
  assert.deepEqual(row.counts, { points: 7, models: 2, companies: 2, channels: 2, plans: 7, boards: 2, configurations: 4, mappings: 4 });
  assert.equal((row.conventions as Record<string, unknown>).monthWeeks, 4);
});

const live: DatasetContext = {
  data: unpackData(JSON.parse(readFileSync(new URL("../data/site.json", import.meta.url), "utf8"))),
  source: "bundled", sourcePath: null,
};

test("live price and allowance IDs match website domain ordering under every company and fee band", () => {
  const companies = [...new Set(live.data.points.map((point) => point.vendor))];
  for (const view of ["price", "allowance"] as const)
    for (const company of companies)
      for (const feeBand of view === "allowance" ? ["all", "0-30", "30-100", "100-300"] : ["all"]) {
        const state = {
          ...defaultState(), view, vendors: [company], feeBand,
          sort: view === "price" ? "price" : "allowance",
          direction: view === "price" ? "asc" as const : "desc" as const,
        };
        const websiteIds = tableRows(rowsFor(live.data, state), state).map((row) => row.point.id);
        assert.deepEqual(ids(executeQuery(live, options({ view, companies: [company], feeBand }))), websiteIds,
          `${view} ${company} ${feeBand}`);
      }
});

test("live website parity covers third-party channels, billing, confidence and whole-substring search", () => {
  const cases = [
    { companies: ["Anthropic"], channels: ["Factory"] },
    { companies: ["Anthropic"], billing: ["metered"] },
    { companies: ["Anthropic"], confidence: ["medium"] },
    { search: "  sonnet 5.5  " },
    { search: "max with fallback" },
    { search: "sonnet factory" },
  ];
  for (const view of ["price", "allowance"] as const)
    for (const selected of cases) {
      const opts = options({ ...selected, view });
      const state = {
        ...defaultState(), view, vendors: opts.companies, channels: opts.channels,
        billing: opts.billing, confidence: opts.confidence, query: opts.search,
        sort: view === "price" ? "price" : "allowance",
        direction: view === "price" ? "asc" as const : "desc" as const,
      };
      assert.deepEqual(ids(executeQuery(live, opts)), tableRows(rowsFor(live.data, state), state).map((row) => row.point.id));
    }
});
