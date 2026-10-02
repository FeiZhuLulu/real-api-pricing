import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parse } from "csv-parse/sync";
import { unpackData } from "../../web/src/loadData.ts";
import { displayPlan, manufacturer } from "../../web/src/domain.ts";
import type { QueryRow, Result, ShowRow, SiteData } from "../src/types.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const main = join(root, "cli/dist/main.js");
const packed = JSON.parse(readFileSync(join(root, "cli/data/site.json"), "utf8"));
const data: SiteData = unpackData(packed);
const version = JSON.parse(readFileSync(join(root, "cli/package.json"), "utf8")).version;
const board = "aa_intelligence_index";
const first = data.points[0]!;
const second = data.points[1]!;

function run(args: string[], cwd = root) {
  const result = spawnSync(process.execPath, [main, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

function json<T = QueryRow>(args: string[], cwd = root): Result<T> {
  const result = run([...args, "--format", "json"], cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "", "JSON diagnostics belong in meta.warnings");
  const body = JSON.parse(result.stdout) as Result<T>;
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.meta.snapshot, data.generatedAt);
  assert.equal(body.meta.returned, body.rows.length);
  assert.equal(body.meta.truncated, body.meta.returned < body.meta.total);
  assert.ok(Array.isArray(body.meta.warnings));
  return body;
}

function fixture(body: unknown, check: (dir: string, path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "rap-test-"));
  const path = join(dir, "snapshot.json");
  try {
    writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body));
    check(dir, path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("compiled CLI uses its bundled snapshot offline from an unrelated cwd", () => {
  fixture(packed, (dir) => {
    const result = run(["price", "--company", "Anthropic", "--format", "json"], dir);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout) as Result<QueryRow>;
    assert.equal(body.meta.source, "bundled");
    assert.equal(body.meta.sourcePath, null);
    assert.equal(body.meta.total, data.points.filter((p) => p.vendor === "Anthropic").length);
    assert.ok(body.rows.every((r) => r.point.company === "Anthropic"));
    assert.equal(result.stderr, "");
  });
});

test("global data and output options work before and after commands", () => {
  fixture(packed, (dir, path) => {
    const before = run(["--data", "snapshot.json", "--format", "json", "price", "--limit", "2"], dir);
    const after = run(["price", "--limit", "2", "--data", "snapshot.json", "--format", "json"], dir);
    assert.equal(before.status, 0, before.stderr);
    assert.equal(after.status, 0, after.stderr);
    assert.deepEqual(JSON.parse(before.stdout), JSON.parse(after.stdout));
    const body = JSON.parse(before.stdout) as Result<QueryRow>;
    assert.equal(body.meta.source, "file");
    assert.equal(body.meta.sourcePath, resolve(path));
    assert.equal(body.meta.total, data.points.length);
    assert.equal(body.meta.returned, 2);
    assert.equal(body.meta.truncated, true);
    assert.deepEqual(body.rows.map((r) => r.rank), [1, 2]);
  });
});

test("public point fields preserve numeric precision and separate model, company, channel, plan", () => {
  const body = json(["query", "--plan", first.plan_id, "--model", first.model]);
  assert.equal(body.rows.length, 1);
  assert.deepEqual(body.meta, {
    command: "query", resource: null, snapshot: data.generatedAt, source: "bundled",
    sourcePath: null, view: "table", board: null, boardSnapshot: null,
    total: 1, returned: 1, truncated: false, warnings: body.meta.warnings,
  });
  const row = body.rows[0]!;
  assert.equal(row.rank, undefined);
  assert.equal(row.benchmark, null);
  assert.equal(row.point.company, first.vendor);
  assert.equal(row.point.company_display, manufacturer(first.vendor));
  assert.equal(row.point.channel, first.channel);
  assert.equal(row.point.plan_display, displayPlan(first.plan, "en"));
  for (const field of ["id", "model", "model_display", "vendor", "plan_id", "plan", "price_usd",
    "monthly_tokens", "real_usd_per_mtok", "confidence", "workload", "source", "decision_note", "evidence"] as const) {
    assert.deepEqual(row.point[field], first[field], field);
  }
});

test("table keeps the four independent identity columns and writes metadata to stderr", () => {
  const result = run(["price", "--company", "Anthropic", "--channel", "Factory", "--limit", "1"]);
  assert.equal(result.status, 0, result.stderr);
  for (const heading of ["Model", "Company", "Channel", "Plan", "USD/MTok", "Monthly tokens", "Rank"]) {
    assert.ok(result.stdout.includes(heading), heading);
  }
  assert.match(result.stdout, /Anthropic/);
  assert.match(result.stdout, /Factory/);
  assert.match(result.stderr, /Snapshot:/);
  assert.match(result.stderr, /Returned:\s*1/);
  assert.match(result.stderr, /Truncated:\s*true/);
  assert.ok(!result.stdout.includes("Snapshot:"));
});

test("CSV is parseable, has stable columns, and preserves raw numeric and boolean types as strings", () => {
  const result = run(["query", "--plan", first.plan_id, "--model", first.model, "--format", "csv"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.startsWith("\uFEFF"));
  const rows = parse(result.stdout, { columns: true }) as Record<string, string>[];
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]!), [
    "rank", "point_id", "model", "model_display", "company", "company_display", "channel", "plan_id",
    "plan", "plan_display", "billing", "price_usd", "monthly_tokens", "real_usd_per_mtok", "confidence",
    "workload", "data_date", "unmetered", "promo_until", "source", "decision_note", "evidence_json",
    "board", "configuration_id", "score", "benchmark_json",
  ]);
  assert.equal(rows[0]!.rank, "");
  assert.equal(rows[0]!.point_id, first.id);
  assert.equal(rows[0]!.real_usd_per_mtok, String(first.real_usd_per_mtok));
  assert.equal(rows[0]!.monthly_tokens, String(first.monthly_tokens));
  assert.equal(rows[0]!.unmetered, String(first.unmetered ?? false));
  assert.equal(rows[0]!.benchmark_json, "");
  assert.deepEqual(JSON.parse(rows[0]!.evidence_json!), first.evidence);
  assert.match(result.stderr, /Snapshot:/);
  assert.ok(!result.stdout.includes("Snapshot:"));
});

test("CSV quotes multiline provenance and protects formula text without changing IDs or numeric cells", () => {
  const modified = structuredClone(packed);
  const point = modified.points[0];
  point.source = '=HYPERLINK("https://example.com", "demo")\nsecond line';
  point.decision_note = 'Quote "comma, newline\nend"';
  fixture(modified, (dir) => {
    const result = run(["query", "--data", "snapshot.json", "--plan", first.plan_id,
      "--model", first.model, "--format", "csv"], dir);
    assert.equal(result.status, 0, result.stderr);
    const rows = parse(result.stdout, { columns: true }) as Record<string, string>[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.source, "'" + point.source);
    assert.equal(rows[0]!.decision_note, point.decision_note);
    assert.equal(rows[0]!.point_id, first.id);
    assert.equal(rows[0]!.real_usd_per_mtok, String(first.real_usd_per_mtok));
  });
});

test("empty results succeed in JSON, CSV, and table without mixing diagnostics into stdout", () => {
  const args = ["price", "--search", "no-such-model-for-cli-test-9f04"];
  const body = json(args);
  assert.deepEqual(body.rows, []);
  assert.equal(body.meta.total, 0);
  const csv = run([...args, "--format", "csv"]);
  assert.equal(csv.status, 0, csv.stderr);
  assert.deepEqual(parse(csv.stdout, { columns: true }), []);
  assert.ok(csv.stdout.startsWith("rank,point_id,"));
  const table = run(args);
  assert.equal(table.status, 0, table.stderr);
  assert.match(table.stdout, /No matching results\./);
  assert.match(table.stderr, /Total:\s*0/);
});

test("show returns one complete point and all original mappings, optionally for one board", () => {
  const full = json<ShowRow>(["show", first.id]);
  assert.equal(full.meta.command, "show");
  assert.equal(full.meta.view, null);
  assert.equal(full.meta.total, 1);
  assert.equal(full.rows[0]!.point.id, first.id);
  assert.deepEqual(full.rows[0]!.benchmarks.map((m) => m.configuration_id).sort(),
    data.mappings.filter((m) => m.point_id === first.id).map((m) => m.configuration_id).sort());
  const selected = json<ShowRow>(["show", first.id, "--board", board]);
  assert.equal(selected.meta.board, board);
  assert.equal(selected.meta.boardSnapshot, data.boards[board]!.snapshot);
  assert.ok(selected.rows[0]!.benchmarks.every((m) => m.board === board));
  const result = run(["show", first.id, "--board", board, "--format", "csv"]);
  assert.equal(result.status, 0, result.stderr);
  const rows = parse(result.stdout, { columns: true }) as Record<string, string>[];
  assert.equal(rows.length, selected.rows[0]!.benchmarks.length);
  assert.ok(rows.every((r) => r.point_id === first.id && r.board === board));
  assert.ok(rows.every((r) => JSON.parse(r.benchmark_json!).configuration_id === r.configuration_id));
  assert.match(result.stderr, /exported[ _]rows:\s*\d+/i);
});

test("compare preserves input order and chooses a board's best mapped configuration", () => {
  const ids = [second.id, first.id];
  const plain = json(["compare", ...ids]);
  assert.deepEqual(plain.rows.map((r) => r.point.id), ids);
  assert.ok(plain.rows.every((r) => r.benchmark === null));
  const scored = json(["compare", ...ids, "--board", board]);
  assert.deepEqual(scored.rows.map((r) => r.point.id), ids);
  for (const row of scored.rows) {
    const mappings = data.mappings.filter((m) => m.point_id === row.point.id && m.board === board);
    const best = mappings.reduce<typeof mappings[number] | null>((a, b) => !a || b.score > a.score ? b : a, null);
    assert.equal(row.benchmark?.configuration_id ?? null, best?.configuration_id ?? null);
    assert.equal(row.benchmark?.score ?? null, best?.score ?? null);
  }
});

test("list resources count the selected scope instead of reporting global counts", () => {
  const scope = data.points.filter((p) => p.vendor === "Anthropic" && p.channel === "Factory");
  const models = json<Record<string, unknown>>(["list", "models", "--company", "Anthropic", "--channel", "Factory"]);
  assert.equal(models.meta.resource, "models");
  assert.deepEqual(models.rows.map((r) => r.model), [...new Set(scope.map((p) => p.model))].sort());
  for (const row of models.rows) {
    const points = scope.filter((p) => p.model === row.model);
    assert.equal(row.company, "Anthropic");
    assert.equal(row.points, points.length);
    assert.equal(row.plans, new Set(points.map((p) => p.plan_id)).size);
    assert.equal(row.channels, new Set(points.map((p) => p.channel)).size);
  }
  const companies = json<Record<string, unknown>>(["list", "companies", "--channel", "Factory", "--search", "Anthropic"]);
  assert.equal(companies.rows[0]!.points, scope.length);
  assert.equal(companies.rows[0]!.models, new Set(scope.map((p) => p.model)).size);
  const channels = json<Record<string, unknown>>(["list", "channels", "--company", "Anthropic", "--search", "Factory"]);
  assert.equal(channels.rows[0]!.points, scope.length);
  const plans = json<Record<string, unknown>>(["list", "plans", "--company", "Anthropic", "--channel", "Factory"]);
  assert.deepEqual(plans.rows.map((r) => r.plan_id), [...new Set(scope.map((p) => p.plan_id))].sort());
  assert.ok(plans.rows.every((r) => JSON.stringify(r.companies) === '["Anthropic"]'));
  const boards = json<Record<string, unknown>>(["list", "boards", "--search", board]);
  assert.equal(boards.rows.length, 1);
  assert.equal(boards.rows[0]!.board, board);
  assert.equal(boards.rows[0]!.snapshot, data.boards[board]!.snapshot);
  assert.equal(boards.rows[0]!.configurations, data.configurations.filter((c) => c.board === board).length);
});

test("list supports display-name search, limit, and preserves raw company IDs", () => {
  const result = json<Record<string, unknown>>(["list", "companies", "--search", "Meta"]);
  assert.ok(result.rows.some((r) => r.company === "Muse" && r.company_display === "Meta"));
  const limited = json<Record<string, unknown>>(["list", "models", "--limit", "1"]);
  assert.equal(limited.meta.total, new Set(data.points.map((p) => p.model)).size);
  assert.equal(limited.rows.length, 1);
  assert.equal(limited.meta.truncated, true);
});

test("info returns the current snapshot, independently counted resources, and adopted conventions", () => {
  const body = json<Record<string, any>>(["info"]);
  assert.equal(body.meta.command, "info");
  assert.equal(body.meta.total, 1);
  const info = body.rows[0]!;
  assert.equal(info.snapshot, data.generatedAt);
  assert.equal(info.source, "bundled");
  assert.equal(info.counts.points, data.points.length);
  assert.equal(info.counts.models, new Set(data.points.map((p) => p.model)).size);
  assert.equal(info.counts.companies, new Set(data.points.map((p) => p.vendor)).size);
  assert.equal(info.counts.channels, new Set(data.points.map((p) => p.channel)).size);
  assert.equal(info.counts.plans, new Set(data.points.map((p) => p.plan_id)).size);
  assert.equal(info.counts.boards, Object.keys(data.boards).length);
  assert.equal(info.counts.configurations, data.configurations.length);
  assert.equal(info.counts.mappings, data.mappings.length);
  assert.equal(info.conventions.monthWeeks, data.conventions.monthWeeks);
  assert.equal(info.conventions.usdPerCny, data.conventions.usdPerCny);
});

test("help, version, and the default invocation do not load an unreadable data file", () => {
  const missing = join(tmpdir(), "rap-no-such-snapshot-19fc.json");
  for (const args of [[], ["--help"], ["price", "--help"], ["allowance", "--help"],
    ["query", "--help"], ["list", "models", "--help"], ["show", "--help"], ["compare", "--help"],
    ["info", "--help"], ["--version"]]) {
    const result = run(["--data", missing, ...args]);
    assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr}`);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, args.includes("--version") ? new RegExp(version.replaceAll(".", "\\.")) : /Usage:/);
  }
});

const invalid: [string, string[]][] = [
  ["unknown command", ["unknown-command"]],
  ["deleted language option", ["price", "--lang", "en"]],
  ["unknown company", ["price", "--company", "Factory"]],
  ["unknown model", ["price", "--model", "unknown-model"]],
  ["unknown channel", ["price", "--channel", "unknown-channel"]],
  ["unknown plan", ["price", "--plan", "unknown-plan"]],
  ["unknown board", ["query", "--board", "unknown-board"]],
  ["unknown point", ["show", "unknown::point"]],
  ["duplicate comparison", ["compare", first.id, first.id]],
  ["one-item comparison", ["compare", first.id]],
  ["partial comparison failure", ["compare", first.id, "unknown::point"]],
  ["unexpected positional argument", ["price", "unexpected"]],
  ["unknown format", ["price", "--format", "yaml"]],
  ["unknown view", ["query", "--view", "pareto"]],
  ["unknown billing", ["query", "--billing", "free"]],
  ["unknown confidence", ["query", "--confidence", "sure"]],
  ["negative price", ["query", "--min-price", "-1"]],
  ["non-finite price", ["query", "--max-price", "Infinity"]],
  ["NaN fee", ["query", "--min-fee", "NaN"]],
  ["fractional token count", ["query", "--min-tokens", "1.5"]],
  ["unsafe token count", ["query", "--max-tokens", "9007199254740992"]],
  ["zero limit", ["query", "--limit", "0"]],
  ["fractional limit", ["query", "--limit", "1.5"]],
  ["reversed fee range", ["query", "--min-fee", "100", "--max-fee", "30"]],
  ["reversed price range", ["query", "--min-price", "1", "--max-price", "0.1"]],
  ["reversed token range", ["query", "--min-tokens", "2", "--max-tokens", "1"]],
  ["fee band in price", ["price", "--fee-band", "all"]],
  ["fee band in table", ["query", "--fee-band", "all"]],
  ["unknown fee band", ["allowance", "--fee-band", "cheap"]],
  ["frontier without board", ["query", "--frontier"]],
  ["scored-only without board", ["query", "--scored-only"]],
  ["minimum score without board", ["query", "--min-score", "0"]],
  ["explicit config without board", ["query", "--config", "best"]],
  ["harness without board", ["query", "--harness", "unknown"]],
  ["effort without board", ["query", "--effort", "high"]],
  ["mode without board", ["query", "--mode", "unknown"]],
  ["score sort without board", ["query", "--sort", "score:desc"]],
  ["unknown sort", ["query", "--sort", "value:asc"]],
  ["unknown sort direction", ["query", "--sort", "price:up"]],
  ["unknown config", ["query", "--board", board, "--config", "summary"]],
  ["price sorting override", ["price", "--sort", "price:asc"]],
  ["ranked query sorting override", ["query", "--view", "price", "--sort", "price:asc"]],
  ["ranking config override", ["allowance", "--board", board, "--config", "best"]],
  ["ranking score filter", ["price", "--board", board, "--min-score", "0"]],
  ["ranking scored-only", ["allowance", "--board", board, "--scored-only"]],
  ["ranking frontier", ["query", "--view", "price", "--board", board, "--frontier"]],
  ["show does not filter", ["show", first.id, "--company", "OpenAI"]],
  ["compare does not limit", ["compare", first.id, second.id, "--limit", "1"]],
  ["unknown list resource", ["list", "vendors"]],
  ["boards cannot filter company", ["list", "boards", "--company", "Anthropic"]],
  ["companies cannot filter company", ["list", "companies", "--vendor", "Anthropic"]],
  ["channels cannot filter channel", ["list", "channels", "--channel", "Factory"]],
];

for (const [name, args] of invalid) {
  test(`invalid arguments: ${name}`, () => {
    const result = run(args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "", "arguments errors must not return partial data");
    assert.match(result.stderr, /error:/i);
  });
}

test("missing, invalid JSON, and malformed snapshots fail with exit 1 and no partial stdout", () => {
  const missing = run(["info", "--data", join(tmpdir(), "no-rap-data-42cb.json")]);
  assert.equal(missing.status, 1, missing.stderr);
  assert.equal(missing.stdout, "");
  for (const body of ["{ invalid JSON", {}, { ...packed, version: 999 }]) {
    fixture(body, (dir) => {
      const result = run(["info", "--data", "snapshot.json", "--format", "json"], dir);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /error:/i);
    });
  }
});

for (const format of ["table", "csv", "json"]) {
  test(`closing a large ${format} output pipe early emits neither a stack trace nor success metadata`, () => {
    const result = spawnSync("bash", ["-o", "pipefail", "-c",
      '"$1" "$2" query --board aa_intelligence_index --config all --format "$3" | head -c 1 >/dev/null',
      "rap-pipe-test", process.execPath, main, format], { encoding: "utf8", cwd: root, timeout: 20_000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });
}
