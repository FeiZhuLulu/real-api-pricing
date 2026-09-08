import test from "node:test";
import { wheelRange } from "./wheelZoom";
import { unpackData } from "./loadData";
import assert from "node:assert/strict";

test("Wheel zoom preserves cursor anchor and reversed logarithmic axis direction", () => {
  for (const range of [[1, -3], [1400, 1700]]) {
    const fraction = 0.27;
    const anchor = range[0] + (range[1] - range[0]) * fraction;
    const zoomed = wheelRange(range, fraction, -100);
    assert.ok(Math.abs(zoomed[0] + (zoomed[1] - zoomed[0]) * fraction - anchor) < 1e-9);
    assert.equal(Math.sign(zoomed[1] - zoomed[0]), Math.sign(range[1] - range[0]));
    assert.ok(Math.abs(zoomed[1] - zoomed[0]) < Math.abs(range[1] - range[0]));
    const restored = wheelRange(zoomed, fraction, 100);
    restored.forEach((n, i) => assert.ok(Math.abs(n - range[i]) < 1e-9));
  }
});
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import {
  matchesFeeBand,
  feeBands,
  allowance,
  csv,
  defaultState,
  accessLine,
  displayPlan,
  isThirdParty,
  manufacturer,
  frontierPath,
  groups,
  pareto,
  restore,
  rowsFor,
  serialize,
  tableRows,
  visiblePoints,
} from "./domain";
import type { Point, Row, SiteData } from "./types";
const data: SiteData = unpackData(JSON.parse(
  readFileSync(new URL("../public/data/site.json", import.meta.url), "utf8"),
));

test("Packed website mappings restore every original field without data loss", () => {
  const raw = JSON.parse(readFileSync(new URL("../../derived/benchmark-points.json", import.meta.url), "utf8"));
  assert.deepEqual(data.mappings, raw);
});
test("Monthly fee bands have exact non-overlapping boundaries and preserve all eligible allowances", () => {
  for (const [fee, expected] of [
    [0, "0-30"],
    [30, "0-30"],
    [30.01, "30-100"],
    [99.99, "30-100"],
    [100, "30-100"],
    [300, "100-300"],
    [300.01, undefined],
  ] as const) {
    assert.deepEqual(
      feeBands.filter((b) => matchesFeeBand(fee, b.id)).map((b) => b.id),
      expected ? [expected] : [],
    );
  }
  assert.equal(matchesFeeBand(null, "0-30"), false);
  const s = { ...defaultState(), view: "allowance" as const };
  const all = visiblePoints(data, s);
  const split = feeBands.flatMap((b) =>
    visiblePoints(data, { ...s, feeBand: b.id }),
  );
  assert.equal(new Set(split.map((p) => p.id)).size, split.length);
  assert.deepEqual(
    new Set(split.map((p) => p.id)),
    new Set(
      all
        .filter(
          (p) => p.price_usd !== null && p.price_usd >= 0 && p.price_usd <= 300,
        )
        .map((p) => p.id),
    ),
  );
  const filtered = { ...s, feeBand: "100-300" };
  assert.equal(restore(serialize(filtered), data).state.feeBand, "100-300");
  assert.equal(
    visiblePoints(data, { ...filtered, view: "price" }).length,
    data.points.length,
  );
});
const adopted = parse(
  readFileSync(new URL("../../data/adopted.csv", import.meta.url), "utf8"),
  { columns: true, skip_empty_lines: true, bom: true },
) as Record<string, string>[];
test("All source point values and stable IDs survive the adapter, including null API fees", () => {
  assert.equal(data.points.length, adopted.length);
  assert.equal(new Set(data.points.map((p) => p.id)).size, adopted.length);
  for (const a of adopted) {
    const p = data.points.find(
      (p) => p.id === `${a.plan_id}::${a.served_model}`,
    )!;
    assert.ok(p);
    assert.equal(p.real_usd_per_mtok, Number(a.real_usd_per_mtok));
    assert.equal(p.price_usd, a.price_usd === "" ? null : Number(a.price_usd));
    assert.equal(
      p.monthly_tokens,
      a.monthly_tokens === "" ? null : Number(a.monthly_tokens),
    );
  }
});
test("Default selection includes every adopted point, including unscored models", () => {
  const rows = rowsFor(data, defaultState());
  assert.equal(new Set(rows.map((r) => r.point.id)).size, data.points.length);
  assert.ok(rows.some((r) => r.score === null));
});
test("All four boards preserve all references; optional summary takes only matching maximum", () => {
  for (const board of Object.keys(data.boards)) {
    const s = { ...defaultState(), board };
    const rows = rowsFor(data, s);
    assert.equal(
      rows.filter((r) => r.mapping).length,
      data.mappings.filter((m) => m.board === board).length,
    );
    const summary = rowsFor(data, { ...s, configuration: "summary" });
    assert.equal(summary.length, data.points.length);
    for (const r of summary) {
      const originals = rows.filter(
        (rr) => rr.point.id === r.point.id && rr.score !== null,
      );
      assert.equal(
        r.score,
        originals.length ? Math.max(...originals.map((rr) => rr.score!)) : null,
      );
    }
  }
});
test("Channels and model developers are separate, and filter dimensions intersect", () => {
  const s = {
    ...defaultState(),
    vendors: ["DeepSeek"],
    channels: ["OpenCode"],
    billing: ["subscription"],
  };
  const ps = visiblePoints(data, s);
  assert.ok(ps.length);
  assert.ok(
    ps.every((p) => p.vendor === "DeepSeek" && p.channel === "OpenCode"),
  );
  assert.equal(
    visiblePoints(data, { ...s, confidence: ["not-present"] }).length,
    0,
  );
});
test("Empty model selection stays empty; null selection means all; individual selection is exact", () => {
  assert.equal(rowsFor(data, { ...defaultState(), selected: [] }).length, 0);
  const id = data.points[0].id;
  assert.deepEqual(
    [
      ...new Set(
        rowsFor(data, { ...defaultState(), selected: [id] }).map(
          (r) => r.point.id,
        ),
      ),
    ],
    [id],
  );
});
test("Monthly allowance excludes APIs, preserves unscored subscriptions and does not duplicate configurations", () => {
  const rows = rowsFor(data, { ...defaultState(), view: "allowance" });
  assert.equal(
    rows.length,
    data.points.filter((p) => p.billing !== "metered" && p.monthly_yi !== null)
      .length,
  );
  assert.ok(rows.every((r) => r.point.billing !== "metered"));
  assert.equal(new Set(rows.map((r) => r.point.id)).size, rows.length);
});
test("Harness/effort/mode filters constrain scores without silently losing unscored plans", () => {
  const rows = rowsFor(data, {
    ...defaultState(),
    harness: ["Codex"],
    effort: ["xhigh"],
  });
  assert.equal(new Set(rows.map((r) => r.point.id)).size, data.points.length);
  assert.ok(rows.some((r) => r.mapping));
  assert.ok(
    rows
      .filter((r) => r.mapping)
      .every(
        (r) =>
          r.mapping!.agent_harness === "Codex" &&
          r.mapping!.reasoning_effort === "xhigh",
      ),
  );
});
const point = (id: string, price: number): Point => ({
  ...data.points[0],
  id,
  real_usd_per_mtok: price,
});
const row = (id: string, price: number, score: number | null): Row => ({
  key: id,
  point: point(id, price),
  score,
  mapping: null,
});
test("Strict dominance retains both identical plans and drops equal-price lower scores/equal-score dearer plans", () => {
  const rows = [
    row("a", 1, 10),
    row("b", 1, 10),
    row("c", 1, 9),
    row("d", 2, 10),
    row("e", 3, 12),
    row("f", 0.5, null),
  ];
  const gs = groups(rows);
  assert.equal(gs.length, 4);
  const front = pareto(gs);
  assert.deepEqual(
    front.flatMap((g) => g.rows.map((r) => r.key)),
    ["a", "b", "e"],
  );
});
test("Four-board frontiers agree with independent pairwise dominance", () => {
  for (const board of Object.keys(data.boards)) {
    const gs = groups(rowsFor(data, { ...defaultState(), board }));
    const expected = gs.filter(
      (g) =>
        !gs.some(
          (other) =>
            other.price <= g.price &&
            other.score >= g.score &&
            (other.price < g.price || other.score > g.score),
        ),
    );
    assert.deepEqual(
      pareto(gs)
        .map((g) => g.key)
        .sort(),
      expected.map((g) => g.key).sort(),
    );
  }
});
test("Frontier endpoints extend cheapest score right and highest score left on reversed log axis", () => {
  const f = pareto(groups([row("cheap", 1, 10), row("best", 3, 12)]));
  assert.deepEqual(frontierPath(f, 0.1, 10), {
    x: [0.1, 1, 3, 10],
    y: [10, 10, 12, 12],
  });
  assert.deepEqual(frontierPath([], 1, 2), { x: [], y: [] });
});
test("Share links round-trip language, board, exact empty selection and all view settings", () => {
  const s = {
    ...defaultState(),
    lang: "zh" as const,
    view: "allowance" as const,
    selected: [],
    board: "aa_coding_agent_index",
    channels: ["Cursor"],
    labels: "none" as const,
    frontier: false,
    query: "Luna / 中文",
    direction: "desc" as const,
  };
  const restored = restore(serialize(s), data);
  assert.deepEqual(restored.state, s);
  assert.equal(restored.warning, false);
});
test("Invalid saved values are ignored with notice; explicit language overrides local preference", () => {
  const s = {
    ...defaultState(),
    selected: [data.points[0].id, "removed-id"],
    channels: ["removed-channel"],
    board: "__proto__",
  };
  const result = restore(serialize(s), data, "zh");
  assert.equal(result.warning, true);
  assert.equal(result.state.lang, "en");
  assert.equal(result.state.board, "arena_code");
  assert.deepEqual(result.state.selected, [data.points[0].id]);
  assert.deepEqual(result.state.channels, []);
  assert.equal(restore("#s=%notjson", data).warning, true);
  assert.equal(restore("", data, "zh").state.lang, "zh");
});
test("Table search, numeric ordering and CSV reflect the entire selected table rather than a page", () => {
  const s = {
    ...defaultState(),
    query: "Luna",
    sort: "allowance",
    direction: "desc" as const,
  };
  const rs = tableRows(rowsFor(data, s), s);
  assert.ok(rs.length);
  assert.ok(rs.every((r) => r.point.label.includes("Luna")));
  assert.ok(rs[0].point.monthly_yi! >= rs.at(-1)!.point.monthly_yi!);
  const exported = parse(csv(rs, "en"), { bom: true, columns: true }) as Record<
    string,
    string
  >[];
  assert.equal(exported.length, rs.length);
  assert.equal(
    Number(exported[0]["Real price USD/MTok"]),
    rs[0].point.real_usd_per_mtok,
  );
});
test("Third-party access lines put the reseller before the model manufacturer", () => {
  const muse = data.points.find(
    (p) => p.vendor === "Muse" && p.channel === "OpenCode",
  )!;
  const glm = data.points.find(
    (p) => p.vendor === "Zhipu" && p.channel === "Zhipu",
  )!;
  assert.equal(manufacturer("Muse"), "Meta");
  assert.equal(isThirdParty(muse), true);
  assert.equal(accessLine(muse), "OpenCode | Meta");
  assert.equal(isThirdParty(glm), false);
  assert.equal(accessLine(glm), "Zhipu");
  const step = data.points.find(
    (p) => p.vendor === "StepFun" && p.channel === "Command Code",
  )!;
  assert.equal(step.model_display.includes("Step"), true);
  assert.equal(accessLine(step), "Command Code | StepFun");
});
test("Language conversion only changes display units and labels", () => {
  const p = { ...data.points[0], monthly_yi: 77.37 };
  assert.equal(allowance(p, "en"), "7.737 B");
  assert.equal(allowance(p, "zh"), "77.37 亿");
  assert.equal(
    displayPlan("GLM (老客 ¥149) 闲时", "en"),
    "GLM (v2 ¥149) Off-peak",
  );
});
test("CSV escapes formula-like text and embedded quotes without changing numeric source values", () => {
  const r = row("csv", 0.002, 20);
  r.point = { ...r.point, model_display: '=BAD("x")' };
  const parsed = parse(csv([r], "en"), { bom: true, columns: true }) as Record<
    string,
    string
  >[];
  assert.equal(parsed[0].Model, '\'=BAD("x")');
  assert.equal(parsed[0]["Real price USD/MTok"], "0.002");
});
