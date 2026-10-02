import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "csv-parse/sync";
import stringWidth from "string-width";
import { renderResult } from "../src/output.js";
import type { Benchmark, DatasetContext, Metadata, PublicPoint, Result } from "../src/types.js";

const point: PublicPoint = {
  id: "droid_max::claude-opus-5.5", plan_id: "droid_max", plan: "Droid Max",
  plan_display: "Droid Max", model: "claude-opus-5.5", model_display: "Claude Opus 5.5",
  vendor: "Anthropic", company: "Anthropic", company_display: "Anthropic", channel: "Factory",
  label: "Droid Max × Claude Opus 5.5", billing: "subscription", confidence: "medium",
  price_usd: 200, original_price: 200, currency: "USD", monthly_yi: 50.52,
  monthly_tokens: 5052000000, real_usd_per_mtok: 0.039588282,
  list_blended_usd_per_mtok: 0.419, workload: "anthropic", data_date: "2026-09-29",
  data_date_kind: "sample", unmetered: false, promo_until: null,
  source: 'Original source: "quoted"\n第二行, evidence',
  note: "", decision_note: "Adopted allowance, with limitations",
  evidence: [{ label: "sample.json", url: "/data/evidence/sample.json" }],
};
const benchmark: Benchmark = {
  point_id: point.id, configuration_id: "aa_intelligence_index:6df46e4e9119d1e1",
  board: "aa_intelligence_index", variant: "Claude Opus 5.5 (max with fallback)",
  score: 57.6224, reasoning_effort: "max", agent_harness: null, service_mode: null,
  score_low: null, score_high: null, source: "https://example.com/benchmark",
  mapping_kind: "model_configuration_reference", mapping_confidence: "medium",
  mapping_note: "Exact served-model reference; quota-measurement effort is unverified.",
  quota_effort_matched: null, score_is_estimated: false, score_is_self_reported: false,
  best_tie_count: 1,
};
const meta: Metadata = {
  command: "price", resource: null, snapshot: "2026-10-01", source: "bundled",
  sourcePath: null, view: "price", board: null, boardSnapshot: null,
  total: 1, returned: 1, truncated: false, warnings: [],
};
const result = (rows: unknown[], changes: Partial<Metadata> = {}): Result => ({
  schemaVersion: 1, meta: { ...meta, ...changes }, rows,
});
const queryResult = result([{ rank: 1, point, benchmark: null }]);
const context: DatasetContext = {
  source: "bundled", sourcePath: null,
  data: {
    version: 1, generatedAt: meta.snapshot, points: [point], configurations: [], mappings: [benchmark],
    boards: { aa_intelligence_index: { name: "Intelligence Board", metric: "Intelligence Index", url: "https://example.com", snapshot: "2026-09-22" } },
    conventions: {
      usdPerCny: 6.7787, monthWeeks: 4,
      exchangeRate: { date: "2026-09-04", source: "Exchange source", labelEn: "", labelZh: "" },
      standardTokenMix: { cache: 0.97, input: 0.025, output: 0.005 },
      lowCacheTokenMix: { cache: 0.85, input: 0.145, output: 0.005 },
      anthropicTokenMix: { cache: 0.97, cacheWrite: 0.025, output: 0.005 },
    },
  },
};

function csvRecords(output: string): Record<string, string>[] {
  return parse(output, { columns: true });
}

/** Reassemble physical table lines into cells without assuming a wrap position. */
function renderedCells(output: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  for (const line of output.split("\n")) {
    if (/^[├└]/.test(line)) {
      if (row.length) rows.push(row);
      row = [];
    } else if (line.startsWith("│")) {
      const cells = line.split("│").slice(1, -1);
      cells.forEach((cell, column) => {
        row[column] = (row[column] ?? "") + cell.trim();
      });
    }
  }
  return rows;
}

// wrap-ansi normalizes canonically equivalent Unicode while adding line breaks.
const withoutWhitespace = (value: string) => value.normalize().replace(/\s/g, "");

test("JSON is an unmodified parseable schema object, with all warnings in metadata", () => {
  const r = result([{ rank: 1, point, benchmark }], {
    warnings: [{ code: "test", message: "Quota effort is unverified.", point_id: point.id }],
  });
  const output = renderResult(r, "json", context);
  assert.deepEqual(JSON.parse(output.stdout), r);
  assert.equal(output.stderr, "");
  assert.equal(JSON.parse(output.stdout).rows[0].point.real_usd_per_mtok, 0.039588282);
});

test("CSV retains quoted multiline sources, raw precision, nulls, booleans and JSON cells", () => {
  const output = renderResult(queryResult, "csv");
  const [row] = csvRecords(output.stdout);
  assert.equal(Object.keys(row!).length, 26);
  assert.equal(row!.source, point.source);
  assert.equal(row!.real_usd_per_mtok, "0.039588282");
  assert.equal(row!.rank, "1");
  assert.equal(row!.board, "");
  assert.equal(row!.benchmark_json, "");
  assert.equal(row!.unmetered, "false");
  assert.deepEqual(JSON.parse(row!.evidence_json!), point.evidence);
  assert.match(output.stderr, /Snapshot: 2026-10-01/);
  assert.match(output.stderr, /exported_rows: 1/);
});

test("CSV spreadsheet protection applies to source text without rewriting identifiers or numbers", () => {
  const unsafe: PublicPoint = {
    ...point, id: "=point::+model", model: "+model", plan_id: "-plan", price_usd: 0,
    source: '=HYPERLINK("https://example.com")', decision_note: " @SUM(1,2)",
    plan_display: "+unsafe plan", monthly_tokens: null, monthly_yi: null,
  };
  const [row] = csvRecords(renderResult(result([{ point: unsafe, benchmark: null }]), "csv").stdout);
  assert.equal(row!.source, `'${unsafe.source}`);
  assert.equal(row!.decision_note, `'${unsafe.decision_note}`);
  assert.equal(row!.plan_display, "'+unsafe plan");
  assert.equal(row!.point_id, "=point::+model");
  assert.equal(row!.model, "+model");
  assert.equal(row!.plan_id, "-plan");
  assert.equal(row!.price_usd, "0");
  assert.equal(row!.monthly_tokens, "");
});

test("table distinguishes Model, Company, Channel and Plan while rankings never include scores", () => {
  const output = renderResult(result([{ rank: 1, point, benchmark }], {
    board: benchmark.board, boardSnapshot: "2026-09-22",
  }), "table", context);
  for (const field of ["Rank", "Model", "Company", "Channel", "Plan", "Point ID"]) assert.ok(output.stdout.includes(field));
  assert.ok(output.stdout.includes("Anthropic"));
  assert.ok(output.stdout.includes("Factory"));
  assert.ok(output.stdout.includes("Droid Max"));
  assert.ok(output.stdout.includes(point.id));
  assert.ok(output.stdout.includes("$0.03959"));
  assert.ok(output.stdout.includes("5.052 B"));
  assert.ok(!output.stdout.includes(String(benchmark.score)));
});

test("show CSV expands configurations without changing detail metadata and retains mapping evidence", () => {
  const second = { ...benchmark, configuration_id: "aa_intelligence_index:other", score: 55, reasoning_effort: "high" };
  const r = result([{ point, benchmarks: [benchmark, second] }], { command: "show", view: null });
  const output = renderResult(r, "csv", context);
  const rows = csvRecords(output.stdout);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.configuration_id), [benchmark.configuration_id, second.configuration_id]);
  assert.equal(JSON.parse(rows[0]!.benchmark_json!).mapping_note, benchmark.mapping_note);
  assert.match(output.stderr, /Total: 1 \| Returned: 1/);
  assert.match(output.stderr, /exported_rows: 2/);
  assert.deepEqual(JSON.parse(renderResult(r, "json").stdout).rows[0].benchmarks, [benchmark, second]);
  const tableOutput = renderResult(r, "table", context).stdout;
  assert.ok(tableOutput.includes(point.source));
  assert.ok(tableOutput.includes(point.decision_note));
  assert.ok(tableOutput.includes(benchmark.configuration_id));
  assert.ok(tableOutput.includes(second.configuration_id));
  assert.ok(tableOutput.includes("2026-09-22"));
  assert.ok(tableOutput.includes("Intelligence Board"));
});

test("show without mappings exports one price row; empty queries preserve format contracts", () => {
  const show = result([{ point, benchmarks: [] }], { command: "show", view: null });
  assert.equal(csvRecords(renderResult(show, "csv").stdout).length, 1);
  assert.match(renderResult(show, "table").stdout, /No mapped benchmark configurations/);
  const empty = result([], { total: 0, returned: 0 });
  assert.equal(renderResult(empty, "table").stdout, "No matching results.\n");
  assert.deepEqual(JSON.parse(renderResult(empty, "json").stdout).rows, []);
  const csv = renderResult(empty, "csv");
  assert.equal(csvRecords(csv.stdout).length, 0);
  assert.equal(csv.stdout.trim().split(",").length, 26);
  assert.match(csv.stderr, /exported_rows: 0/);
});

test("API and unknown allowances use the website's dash; promos retain their qualifier and monthly fee", () => {
  const api = { ...point, billing: "metered", price_usd: null, monthly_tokens: null, monthly_yi: null };
  const unknown = { ...point, monthly_tokens: null, monthly_yi: null };
  const apiOutput = renderResult(result([{ point: api, benchmark: null }]), "table").stdout;
  assert.match(apiOutput, /—/);
  assert.match(apiOutput, /Metered API/);
  assert.ok(!apiOutput.includes("N/A"));
  const unknownOutput = renderResult(result([{ point: unknown, benchmark: null }]), "table").stdout;
  assert.match(unknownOutput, /—/);
  assert.ok(!unknownOutput.includes("Unknown"));
  const promo = { ...unknown, unmetered: true, promo_until: "2026-12-31", real_usd_per_mtok: 0, price_usd: 10 };
  const promoOutput = renderResult(result([{ point: promo, benchmark: null }]), "table").stdout;
  // Narrow columns may wrap, but every part of the qualification remains present.
  assert.ok(promoOutput.includes("2026-12-31"));
  assert.ok(promoOutput.includes("unmetered"));
  assert.ok(promoOutput.includes("10"));
});

test("displayed fees, billing and confidence match the rendered website labels and rounding", () => {
  const rounded = { ...point, price_usd: 199.99, confidence: "high" };
  const out = renderResult(result([{ point: rounded, benchmark: null }]), "table").stdout;
  assert.ok(out.includes("$200"));
  assert.ok(!out.includes("199.99"));
  assert.ok(out.includes("Subscription"));
  assert.ok(out.includes("High"));
  const cny = { ...point, price_usd: 39, original_price: 199, currency: "CNY" };
  const cnyOut = renderResult(result([{ point: cny, benchmark: null }]), "table").stdout;
  assert.ok(cnyOut.includes("$39"));
  assert.ok(cnyOut.includes("¥199"));
  const unknownOriginal = { ...cny, original_price: null };
  const unknownOut = renderResult(result([{ point: unknownOriginal, benchmark: null }]), "table").stdout;
  assert.ok(unknownOut.includes("$39"));
  assert.ok(!unknownOut.includes("¥null"));
  assert.equal(JSON.parse(renderResult(result([{ point: unknownOriginal, benchmark: null }]), "json").stdout).rows[0].point.original_price, null);
  assert.equal(JSON.parse(renderResult(result([{ point: rounded, benchmark: null }]), "json").stdout).rows[0].point.price_usd, 199.99);
});

test("table scores and effort labels follow website table precision while details use detail precision", () => {
  const b = { ...benchmark, score: 57.6223698102963 };
  const query = result([{ point, benchmark: b }], { command: "query", view: "table", board: b.board });
  const out = renderResult(query, "table").stdout;
  assert.ok(out.includes("57.62"));
  assert.ok(!out.includes("57.622"));
  assert.ok(out.includes("Max"));
  assert.ok(out.includes("Medium"));
  const show = result([{ point, benchmarks: [b] }], { command: "show", view: null });
  const detail = renderResult(show, "table", context).stdout;
  assert.ok(detail.includes("$0.0395883"));
  assert.ok(detail.includes("57.6224"));
  assert.equal(JSON.parse(renderResult(show, "json").stdout).rows[0].benchmarks[0].score, b.score);
  assert.equal(csvRecords(renderResult(query, "csv").stdout)[0]!.score, String(b.score));
});

test("custom dataset source path remains visible in diagnostics and info CSV has stable columns", () => {
  const r = result([{ point, benchmark: null }], { source: "file", sourcePath: "/tmp/custom data.json" });
  assert.match(renderResult(r, "csv").stderr, /Source: file: \/tmp\/custom data.json/);
  const info = result([{
    snapshot: "2026-10-01", source: "file", source_path: "/tmp/custom data.json", datasetVersion: 1,
    counts: { points: 1, models: 1, companies: 1, channels: 1, plans: 1, boards: 1, configurations: 1, mappings: 1 },
    conventions: { ...context.data.conventions, subscriptionPriceAssumption: "Full use", allowancesAcrossModels: "Alternative use", measuredWorkload: "Raw sample tokens" },
  }], { command: "info", view: null });
  const [row] = csvRecords(renderResult(info, "csv").stdout);
  assert.deepEqual(Object.keys(row!), ["snapshot", "source", "source_path", "counts_json", "conventions_json"]);
  assert.equal(row!.source_path, "/tmp/custom data.json");
  assert.equal(JSON.parse(row!.counts_json!).points, 1);
  assert.ok(renderResult(info, "table").stdout.includes("1 USD = 6.7787 CNY"));
  assert.ok(!renderResult(info, "table").stdout.includes("1 USD = 0.1475"));
});

test("ranking and query summaries explain the active order, fee band and configuration selection", () => {
  const ranking = renderResult(queryResult, "table");
  assert.match(ranking.stderr, /Order: USD\/MTok ascending; ties by Point ID/);
  const allowance = renderResult(result([{ rank: 1, point, benchmark: null }], { command: "allowance", view: "allowance" }), "csv", context, {
    feeBand: "0-30", sort: "allowance:desc", config: "best",
  });
  assert.match(allowance.stderr, /Order: monthly tokens descending/);
  assert.match(allowance.stderr, /Fee band: 0-30/);
  const query = renderResult(result([{ point, benchmark }], {
    command: "query", view: "table", board: benchmark.board, boardSnapshot: "2026-09-22",
  }), "table", context, { feeBand: "all", sort: "score", config: "all" });
  assert.match(query.stderr, /Config: all/);
  assert.match(query.stderr, /Order: score:asc/);
  assert.equal(renderResult(queryResult, "json", context, { feeBand: "all", sort: "price:asc", config: "best" }).stderr, "");
});

test("narrow terminals retain each complete price-point identifier on a continuation and redirected output stays stable", () => {
  const tty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  const columns = Object.getOwnPropertyDescriptor(process.stdout, "columns");
  try {
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
    Object.defineProperty(process.stdout, "columns", { configurable: true, value: 80 });
    const narrow = renderResult(queryResult, "table").stdout;
    assert.ok(narrow.includes(`Point ID: ${point.id}`));
    assert.ok(!narrow.includes("…"));
    assert.ok(narrow.split("\n").every((line) => line.length <= 80));
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: false });
    const redirected = renderResult(queryResult, "table").stdout;
    Object.defineProperty(process.stdout, "columns", { configurable: true, value: 260 });
    assert.equal(renderResult(queryResult, "table").stdout, redirected);
  } finally {
    if (tty) Object.defineProperty(process.stdout, "isTTY", tty); else delete (process.stdout as unknown as Record<string, unknown>).isTTY;
    if (columns) Object.defineProperty(process.stdout, "columns", columns); else delete (process.stdout as unknown as Record<string, unknown>).columns;
  }
});

test("CJK plan names survive ranking, query and list cell wrapping without truncation", () => {
  const plan = "MiMo Token Plan 夜间0.8× · 第二行套餐优惠";
  const unicodePoint = { ...point, plan, plan_display: plan, model_display: "MiMo 🚀 e\u0301" };
  for (const [r, column] of [
    [result([{ rank: 1, point: unicodePoint, benchmark: null }]), 4],
    [result([{ point: unicodePoint, benchmark: null }], { command: "query", view: "table" }), 3],
    [result([{ plan_id: point.plan_id, plan_display: plan, channel: "Factory", companies: ["Anthropic"], models: 1, points: 1 }],
      { command: "list", resource: "plans", view: null }), 1],
  ] as const) {
    const out = renderResult(r, "table").stdout;
    assert.ok(!out.includes("…"), out);
    assert.equal(withoutWhitespace(renderedCells(out)[1]![column]!), withoutWhitespace(plan));
    assert.ok(out.split("\n").every((line) => stringWidth(line) <= 180));
  }
});

test("narrow terminals preserve wide Unicode columns and spanning identifier and promotion rows", () => {
  const tty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  const columns = Object.getOwnPropertyDescriptor(process.stdout, "columns");
  try {
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
    Object.defineProperty(process.stdout, "columns", { configurable: true, value: 80 });
    const unicodePoint = {
      ...point, id: `夜间套餐${"完整标识符".repeat(12)}::模型🚀`,
      model_display: "模型🚀 e\u0301", company_display: "公司甲", channel: "渠道乙",
      plan_display: "MiMo Token Plan 夜间0.8×", unmetered: true,
      monthly_tokens: null, monthly_yi: null, real_usd_per_mtok: 0,
      promo_until: "2026-12-31", price_usd: 20,
    };
    const out = renderResult(result([{ rank: 1, point: unicodePoint, benchmark: null }]), "table").stdout;
    const cells = renderedCells(out);
    for (const [column, expected] of [
      [1, unicodePoint.model_display], [2, unicodePoint.company_display],
      [3, unicodePoint.channel], [4, unicodePoint.plan_display],
    ] as const) assert.equal(withoutWhitespace(cells[1]![column]!), withoutWhitespace(expected));
    assert.equal(withoutWhitespace(cells[2]![0]!), withoutWhitespace(`Point ID: ${unicodePoint.id}`));
    assert.equal(cells[3]![0], "Promotion: promo until 2026-12-31, unmetered · $20 / mo");
    assert.ok(!out.includes("…"), out);
    assert.ok(!out.includes("\ufffd"), out);
    assert.ok(out.split("\n").every((line) => stringWidth(line) <= 80));
  } finally {
    if (tty) Object.defineProperty(process.stdout, "isTTY", tty); else delete (process.stdout as unknown as Record<string, unknown>).isTTY;
    if (columns) Object.defineProperty(process.stdout, "columns", columns); else delete (process.stdout as unknown as Record<string, unknown>).columns;
  }
});

test("Unicode comparison headers and detail benchmark cells retain every character", () => {
  const plan = `MiMo 夜间优惠套餐${"说明".repeat(16)} 0.8×`;
  const variant = `评测配置${"推理强度与服务模式".repeat(8)} e\u0301 🚀`;
  const unicodePoint = { ...point, plan_display: plan };
  const b = { ...benchmark, variant };
  const compare = result([
    { point: unicodePoint, benchmark: b },
    { point: { ...unicodePoint, id: "other::model", plan_display: plan + "（第二套餐）" }, benchmark: b },
  ], { command: "compare", view: null, board: benchmark.board });
  const show = result([{ point: unicodePoint, benchmarks: [b] }], { command: "show", view: null });
  for (const r of [compare, show]) {
    const out = renderResult(r, "table", context).stdout;
    const values = renderedCells(out).flat().map(withoutWhitespace);
    assert.ok(values.includes(withoutWhitespace(plan)), out);
    assert.ok(values.includes(withoutWhitespace(variant)), out);
    assert.ok(!out.includes("…"), out);
    assert.ok(out.split("\n").every((line) => stringWidth(line) <= 180));
  }
});
