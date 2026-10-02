import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { defaultState, restore, rowsFor, tableRows } from "../../web/src/domain.ts";
import { unpackData } from "../../web/src/loadData.ts";
import type { Row, SiteData, State } from "../../web/src/types.ts";
import type { QueryRow, Result } from "../src/types.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const main = join(root, "cli/dist/main.js");
const packed = JSON.parse(readFileSync(join(root, "cli/data/site.json"), "utf8"));
const data: SiteData = unpackData(packed);
const board = "aa_intelligence_index";

function query(args: string[], cwd = root): Result<QueryRow> {
  const run = spawnSync(process.execPath, [main, ...args, "--format", "json"], {
    cwd, encoding: "utf8", timeout: 20_000, maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, "");
  return JSON.parse(run.stdout) as Result<QueryRow>;
}

function website(view: "price" | "allowance" | "table", options: Partial<State> = {}, dataset = data): Row[] {
  const state: State = {
    ...defaultState(), view, frontier: false, sort: view === "allowance" ? "allowance" : "price",
    direction: view === "allowance" ? "desc" : "asc", ...options,
  };
  return tableRows(rowsFor(dataset, state), state);
}

function pointIds(result: Result<QueryRow>) {
  return result.rows.map((r) => r.point.id);
}

for (const view of ["price", "allowance"] as const) {
  test(`${view} reproduces the requested Anthropic website link in exact ranking order`, () => {
    const { state, warning } = restore(`#lang=en&view=${view}&vendors=Anthropic`, data);
    assert.equal(warning, false);
    // Ranking components set the view's fixed sort before calling tableRows.
    state.sort = view === "price" ? "price" : "allowance";
    state.direction = view === "price" ? "asc" : "desc";
    const expected = tableRows(rowsFor(data, state), state);
    const result = query([view, "--company", "Anthropic"]);
    assert.deepEqual(pointIds(result), expected.map((r) => r.point.id));
    assert.equal(result.meta.command, view);
    assert.equal(result.meta.view, view);
    assert.equal(result.meta.total, expected.length);
    assert.deepEqual(result.rows.map((r) => r.rank), expected.map((_, i) => i + 1));
    assert.ok(result.rows.every((r) => r.benchmark === null));
    assert.equal(result.meta.board, null);
    assert.equal(result.meta.boardSnapshot, null);
  });

  test(`${view} alias produces identical JSON metadata and rows`, () => {
    const filters = ["--company", "Anthropic", "--limit", "4", "--board", board];
    assert.deepEqual(query(["query", "--view", view, ...filters]), query([view, ...filters]));
  });

  test(`${view} combines repeated company/vendor with OR and other dimensions with AND`, () => {
    const expected = website(view, { vendors: ["Anthropic", "OpenAI"], channels: ["Factory"] });
    const result = query([view, "--company", "Anthropic", "--vendor", "OpenAI",
      "--company", "Anthropic", "--channel", "Factory"]);
    assert.deepEqual(pointIds(result), expected.map((r) => r.point.id));
    assert.ok(result.rows.every((r) => r.point.channel === "Factory"));
    assert.ok(result.rows.some((r) => r.point.company === "Anthropic"));
    assert.ok(result.rows.some((r) => r.point.company === "OpenAI"));
  });

  test(`${view} uses the website's complete substring search and its implicit best configuration`, () => {
    for (const search of ["  CLAUDE  ", "Droid Max", "[AA estimate]", "sonnet factory"]) {
      const expected = website(view, { query: search });
      const result = query([view, "--search", search]);
      assert.deepEqual(pointIds(result), expected.map((r) => r.point.id), search);
      assert.ok(result.rows.every((r) => r.benchmark === null));
      assert.equal(result.meta.board, null);
    }
  });

  test(`${view} model, plan, billing and confidence filters preserve website order`, () => {
    const point = data.points.find((p) => p.vendor === "Anthropic" && p.billing !== "metered")!;
    const expected = website(view, {
      selected: data.points.filter((p) => p.model === point.model).map((p) => p.id),
      plans: [point.plan], billing: [point.billing], confidence: [point.confidence],
    });
    const result = query([view, "--model", point.model, "--plan", point.plan_id,
      "--billing", point.billing, "--confidence", point.confidence]);
    assert.deepEqual(pointIds(result), expected.map((r) => r.point.id));
  });

  test(`${view} with explicit board keeps all prices and chooses the same mapping as the website`, () => {
    const expected = website(view, { vendors: ["Anthropic"], board });
    const result = query([view, "--company", "Anthropic", "--board", board]);
    assert.deepEqual(pointIds(result), expected.map((r) => r.point.id));
    assert.equal(result.meta.boardSnapshot, data.boards[board]!.snapshot);
    assert.deepEqual(result.rows.map((r) => r.benchmark?.configuration_id ?? null),
      expected.map((r) => r.mapping?.configuration_id ?? null));
    assert.deepEqual(result.rows.map((r) => r.benchmark?.score ?? null), expected.map((r) => r.score));
  });
}

for (const band of ["all", "0-30", "30-100", "100-300"]) {
  test(`allowance fee band ${band} agrees with the live website domain`, () => {
    const expected = website("allowance", { feeBand: band, vendors: ["Anthropic"] });
    const result = query(["allowance", "--company", "Anthropic", "--fee-band", band]);
    assert.deepEqual(pointIds(result), expected.map((r) => r.point.id));
  });
}

test("allowance boundaries are inclusive at 30/100/300 and all preserves fees above 300", () => {
  const dir = mkdtempSync(join(tmpdir(), "rap-band-test-"));
  try {
    const fees = [0, 29.99, 30, 30.01, 100, 100.01, 300, 300.01];
    const body = {
      ...packed, mappings: [],
      points: fees.map((fee, i) => ({
        ...packed.points[0], id: `fee_${i}::${packed.points[0].model}`,
        plan_id: `fee_${i}`, plan: `Boundary fee ${fee}`, billing: "subscription",
        price_usd: fee, monthly_tokens: 1_000_000_000, monthly_yi: 10,
      })),
    };
    const path = join(dir, "boundaries.json");
    writeFileSync(path, JSON.stringify(body));
    const dataset = unpackData(body);
    for (const band of ["all", "0-30", "30-100", "100-300"]) {
      const expected = website("allowance", { feeBand: band }, dataset);
      const result = query(["allowance", "--data", path, "--fee-band", band]);
      assert.deepEqual(pointIds(result), expected.map((r) => r.point.id));
      const allowed = band === "all" ? fees : band === "0-30" ? [0, 29.99, 30]
        : band === "30-100" ? [30.01, 100] : [100.01, 300];
      assert.deepEqual(result.rows.map((r) => r.point.price_usd).sort((a, b) => a! - b!), allowed);
    }
    const intersection = query(["allowance", "--data", path, "--fee-band", "0-30", "--min-fee", "30"]);
    assert.equal(intersection.rows.length, 1);
    assert.equal(intersection.rows[0]!.point.price_usd, 30);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("API and unmetered prices remain in price view and cannot enter the allowance ranking", () => {
  const api = data.points.find((p) => p.billing === "metered")!;
  const promo = data.points.find((p) => p.unmetered && p.monthly_yi === null)!;
  for (const point of [api, promo]) {
    const price = query(["price", "--plan", point.plan_id, "--model", point.model]);
    assert.deepEqual(pointIds(price), [point.id]);
    const allowance = query(["allowance", "--plan", point.plan_id, "--model", point.model]);
    assert.deepEqual(allowance.rows, []);
  }
});

test("query best/all and configuration filtering match the website table's configuration scope", () => {
  for (const config of ["best", "all"] as const) {
    const expected = website("table", {
      vendors: ["Anthropic"], configuration: config === "best" ? "summary" : "all",
      board, effort: ["high"],
    });
    const result = query(["query", "--company", "Anthropic", "--board", board,
      "--config", config, "--effort", "high"]);
    assert.deepEqual(result.rows.map((r) => [r.point.id, r.benchmark?.configuration_id ?? null]),
      expected.map((r) => [r.point.id, r.mapping?.configuration_id ?? null]));
    assert.ok(result.rows.every((r) => r.rank === undefined));
  }
});

test("table custom score sorting uses original precision, retains missing scores last, and limits after sorting", () => {
  const expected = website("table", { board, sort: "score", direction: "desc" });
  const result = query(["query", "--board", board, "--sort", "score:desc", "--limit", "7"]);
  assert.equal(result.meta.total, expected.length);
  assert.equal(result.meta.returned, 7);
  assert.deepEqual(pointIds(result), expected.slice(0, 7).map((r) => r.point.id));
  assert.deepEqual(result.rows.map((r) => r.benchmark?.score ?? null), expected.slice(0, 7).map((r) => r.score));
  const all = query(["query", "--board", board, "--sort", "score:desc"]);
  assert.deepEqual(pointIds(all), expected.map((r) => r.point.id));
  const firstNull = all.rows.findIndex((r) => r.benchmark === null);
  assert.ok(firstNull >= 0, "real snapshot must exercise unscored rows");
  assert.ok(all.rows.slice(firstNull).every((r) => r.benchmark === null));
});

test("fee, price and token numeric filters include exact boundaries before applying limit", () => {
  const point = data.points.find((p) => p.billing !== "metered" && p.monthly_tokens !== null && p.price_usd !== null)!;
  const result = query(["query", "--min-fee", String(point.price_usd), "--max-fee", String(point.price_usd),
    "--min-price", String(point.real_usd_per_mtok), "--max-price", String(point.real_usd_per_mtok),
    "--min-tokens", String(point.monthly_tokens), "--max-tokens", String(point.monthly_tokens)]);
  assert.ok(result.rows.some((r) => r.point.id === point.id));
  assert.ok(result.rows.every((r) => r.point.price_usd === point.price_usd &&
    r.point.real_usd_per_mtok === point.real_usd_per_mtok && r.point.monthly_tokens === point.monthly_tokens));
});
