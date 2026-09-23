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
  effortLabel,
  isThirdParty,
  manufacturer,
  frontierPath,
  groups,
  pareto,
  restore,
  rowsFor,
  type Lock,
  SEARCH_MARK_CAP,
  color,
  colorAlpha,
  modelFamilyLabel,
  searchCandidates,
  searchHits,
  searchMatches,
  serialize,
  tableRows,
  visiblePoints,
} from "./domain";
import {
  FRONTIER_RADIUS,
  placeTextLabels,
  placementRect,
} from "./chartLabels";
import {
  boxToView,
  formatTickPrice,
  hitTest,
  homeView,
  makeBox,
  panBy,
  priceTicks,
  scoreTicks,
  toPixel,
  zoomAt,
} from "./chartScene";
import { channelColors, dotColors, luminance } from "./palette";
import { readFileSync as readConfig } from "node:fs";
import type { Group, Point, Row, SiteData } from "./types";
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
test("DeepSeek V4.1 Flash uses official USD off-peak and peak API prices", () => {
  const offPeak = data.points.find((p) => p.id === "deepseek_v41_flash_offpeak::deepseek-v4.1-flash")!;
  const peak = data.points.find((p) => p.id === "deepseek_v41_flash_peak::deepseek-v4.1-flash")!;
  // Standard mix 97/2.5/0.5 × list $0.006/$0.30/$1.20 = $0.01932 peak; off-peak is half.
  assert.equal(offPeak.real_usd_per_mtok, 0.00966);
  assert.equal(peak.real_usd_per_mtok, 0.01932);
});
test("Step Plan CN uses official Credit pools and CNY list prices", () => {
  const mini35 = data.points.find((p) => p.id === "stepfun_mini_cn::step-3.5-flash")!;
  const max37 = data.points.find((p) => p.id === "stepfun_max_cn::step-3.7-flash")!;
  // Low-cache mix 85/14.5/0.5 × ¥0.14/¥0.70/¥2.10 = ¥0.231/MTok against the ¥400 credit pool.
  assert.equal(mini35.monthly_yi, 17.316);
  assert.equal(mini35.real_usd_per_mtok, 0.00417);
  assert.equal(mini35.channel, "StepFun");
  assert.equal(max37.monthly_yi, 858.83);
  assert.equal(accessLine(mini35), "StepFun");
});
test("Devin Pro SWE-2 is an unmetered $0 promo point that joins and leads the TB4 frontier on a dedicated slot", () => {
  const p = data.points.find((p) => p.id === "devin_pro::swe-2")!;
  assert.ok(p);
  assert.equal(p.real_usd_per_mtok, 0);
  assert.equal(p.unmetered, true);
  assert.equal(p.promo_until, "2026-10-31");
  assert.equal(p.monthly_yi, null);
  assert.equal(p.channel, "Devin");
  assert.equal(accessLine(p), "Devin");
  const rows = rowsFor(data, { ...defaultState(), board: "terminal_bench_4" });
  const gs = groups(rows);
  const zero = gs.find((g) => g.price === 0)!;
  assert.ok(zero, "unmetered group is plotted");
  assert.ok(zero.plotPrice > 0 && zero.plotPrice < Math.min(...gs.filter((g) => g.price > 0).map((g) => g.price)));
  assert.equal(zero.rows[0].mapping?.score_is_self_reported, true);
  const front = pareto(gs);
  assert.equal(front[0].key, zero.key);
  assert.ok(front.every((g, i) => i === 0 || g.price > 0));
  // Allowance ranking has no token denominator for it; price ranking keeps it.
  assert.ok(!rowsFor(data, { ...defaultState(), view: "allowance" }).some((r) => r.point.id === p.id));
  assert.ok(rowsFor(data, { ...defaultState(), view: "price" }).some((r) => r.point.id === p.id));
});
test("DeepSWE keeps effort levels and vendor provenance through the adapter", () => {
  const state = { ...defaultState(), board: "deepswe_1_1", configuration: "all" as const };
  const rows = rowsFor(data, state);
  const astra = rows.filter((r) => r.point.id === "chatgpt_plus::gpt-6-astra");
  assert.equal(astra.length, 5);
  assert.equal(astra.reduce((best, r) => r.score! > best.score! ? r : best).mapping?.reasoning_effort, "xhigh");
  const low = rowsFor(data, { ...state, effort: ["low"] });
  assert.equal(low.filter((r) => r.point.id === "chatgpt_plus::gpt-6-astra").length, 1);
  const deepseek = rows.find((r) => r.point.id === "opencode_go::deepseek-v4.1-flash")!;
  assert.equal(deepseek.score, 74.2);
  assert.equal(deepseek.mapping?.score_is_self_reported, true);
  assert.equal(deepseek.mapping?.agent_harness, "mini-SWE");
});
test("Command Code GOAT DeepSeek V4.1 Flash uses $40 monthly credits", () => {
  const p = data.points.find((p) => p.id === "command_code_goat::deepseek-v4.1-flash")!;
  // $40 allowance ÷ off-peak (97/2.5/0.5 × $0.003/$0.15/$0.60 = $0.00966/MTok).
  assert.equal(p.monthly_yi, 41.408);
  assert.equal(p.real_usd_per_mtok, 0.00241);
});
test("Default selection includes every adopted point, including unscored models", () => {
  const rows = rowsFor(data, defaultState());
  assert.equal(new Set(rows.map((r) => r.point.id)).size, data.points.length);
  assert.ok(rows.some((r) => r.score === null));
});
test("All boards preserve all references; optional summary takes only matching maximum", () => {
  for (const board of Object.keys(data.boards)) {
    const s = { ...defaultState(), board, configuration: "all" as const };
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
    board: "terminal_bench_4",
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
test("All board frontiers agree with independent pairwise dominance", () => {
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
    channels: ["Cursor", "OpenAI"],
    labels: "none" as const,
    frontier: false,
    query: "Luna / 中文 mix",
    direction: "desc" as const,
  };
  const hash = serialize(s);
  assert.ok(!hash.includes("%7B"), "short params, not a JSON blob");
  const restored = restore(hash, data);
  assert.deepEqual(restored.state, s);
  assert.equal(restored.warning, false);
});
test("Default state serializes to a minimal hash and selection states stay distinct", () => {
  assert.equal(serialize(defaultState()), "#lang=en");
  const ids = [data.points[0].id, data.points[1].id];
  assert.deepEqual(
    restore(serialize({ ...defaultState(), selected: ids }), data).state
      .selected,
    ids,
  );
  assert.deepEqual(
    restore(serialize({ ...defaultState(), selected: [] }), data).state
      .selected,
    [],
  );
  assert.equal(
    restore(serialize({ ...defaultState(), frontier: false }), data).state
      .frontier,
    false,
  );
  assert.equal(
    restore(serialize(defaultState()), data).state.selected,
    null,
  );
});
test("Legacy #s=<json> share links still restore with the same validation", () => {
  const legacy =
    "#s=" +
    encodeURIComponent(
      JSON.stringify({ v: 1, view: "price", channels: ["Cursor"] }),
    );
  const restored = restore(legacy, data);
  assert.equal(restored.warning, false);
  assert.equal(restored.state.view, "price");
  assert.deepEqual(restored.state.channels, ["Cursor"]);
});
test("Unknown enum values in a short link warn and fall back to defaults", () => {
  const restored = restore("#lang=zh&view=nope", data);
  assert.equal(restored.warning, true);
  assert.equal(restored.state.view, "pareto");
  assert.equal(restored.state.lang, "zh");
  assert.equal(restore("#board=__proto__", data).warning, true);
  assert.equal(restore("#board=__proto__", data).state.board, "aa_intelligence_index");
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
  assert.equal(result.state.board, "aa_intelligence_index");
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
  // Every archived reasoning-effort level has a Chinese label.
  for (const e of new Set(data.configurations.map((c) => c.reasoning_effort)))
    if (e !== null) assert.notEqual(effortLabel(e, "zh"), e, `${e} is translated`);
  assert.equal(effortLabel("xhigh", "zh"), "超高");
  assert.equal(effortLabel("max", "en"), "Max");
  assert.equal(effortLabel(null, "zh"), null);
});
test("Chart names never overlap each other and leave the plot rather than collide", () => {
  const box = { left: 60, top: 20, right: 660, bottom: 420, width: 600, height: 400 };
  const group = (id: string, name: string): Group => {
    const r = row(id, 0.01, 1500);
    r.point = { ...r.point, model_display: name };
    return { key: id, price: 0.01, plotPrice: 0.01, score: 1500, rows: [r] };
  };
  const place = (
    spots: { x: number; y: number }[],
    names: string[],
    area = box,
  ) => {
    const gs = names.map((n, i) => group(`g${i}`, n));
    const markers = gs.map((g, i) => ({
      key: g.key,
      x: spots[i].x,
      y: spots[i].y,
      r: FRONTIER_RADIUS,
    }));
    const anchors = new Map(markers.map((m) => [m.key, m]));
    const placements = placeTextLabels(gs, anchors, markers, area, false);
    const rects = placements.map((p) => {
      const m = anchors.get(p.key)!;
      return placementRect(p, m.x, m.y);
    });
    return { placements, rects, markers };
  };
  const names = [
    "Claude Opus 5",
    "GPT 5.6 Luna",
    "GLM 5.3 Flash",
    "DeepSeek V4 Flash",
    "Kimi K3",
    "月之暗面 K2.7 标准",
  ];
  const spread = names.map((_, i) => ({ x: 120 + i * 95, y: 80 + (i % 3) * 90 }));
  const wide = place(spread, names);
  assert.equal(wide.placements.length, names.length);
  wide.rects.forEach((a, i) => {
    assert.ok(a.left >= box.left && a.right <= box.right, `${i} inside x`);
    assert.ok(a.top >= box.top && a.bottom <= box.bottom, `${i} inside y`);
    wide.rects.slice(i + 1).forEach((b) => {
      const overlap =
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      assert.ok(!overlap, "names must not overlap");
    });
    // The name stays beside its own marker instead of floating away.
    const m = wide.markers[i];
    assert.ok(
      Math.hypot(
        Math.min(Math.abs(a.left - m.x), Math.abs(a.right - m.x)),
        Math.min(Math.abs(a.top - m.y), Math.abs(a.bottom - m.y)),
      ) <= FRONTIER_RADIUS + 60,
    );
  });
  // With no room left, names are dropped instead of stacked on each other.
  const tight = { left: 0, top: 0, right: 220, bottom: 90, width: 220, height: 90 };
  const crowded = place(
    names.map((_, i) => ({ x: 100 + (i % 2) * 10, y: 40 + i * 6 })),
    names,
    tight,
  );
  assert.ok(crowded.placements.length < names.length);
  crowded.rects.forEach((a, i) =>
    crowded.rects.slice(i + 1).forEach((b) => {
      const overlap =
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      assert.ok(!overlap, "crowded names must not overlap");
    }),
  );
});
test("Labels yield to ordinary points when every candidate slot is occupied", () => {
  const r = row("blocked", 0.01, 1500);
  r.point = { ...r.point, model_display: "Claude Opus 5" };
  const g: Group = { key: r.key, price: 0.01, plotPrice: 0.01, score: 1500, rows: [r] };
  const anchor = { key: g.key, x: 120, y: 100, r: FRONTIER_RADIUS };
  const dots = [];
  for (let x = 6; x < 240; x += 12)
    for (let y = 6; y < 200; y += 12)
      dots.push({ key: `dot-${x}-${y}`, x, y, r: 6 });
  assert.deepEqual(placeTextLabels([g], new Map([[g.key, anchor]]), dots,
    { left: 0, top: 0, right: 240, bottom: 200, width: 240, height: 200 }, false), []);
});
test("Chart search AND-matches plan, channel and model fields and dedupes points", () => {
  const gs = groups(
    rowsFor(data, { ...defaultState(), configuration: "all" }),
  );
  // Multi-token AND is order-independent: the plan tier and vendor must both hit.
  const forward = searchMatches(gs, "kimi 199", "en");
  const backward = searchMatches(gs, "199 kimi", "en");
  assert.deepEqual(
    forward.map((r) => r.point.id).sort(),
    ["kimi_allegretto_cn::kimi-k2.7-code", "kimi_allegretto_cn::kimi-k3"],
  );
  assert.deepEqual(
    backward.map((r) => r.point.id).sort(),
    forward.map((r) => r.point.id).sort(),
  );
  // Cross-field hits: localized plan name, channel and model slug.
  const allegretto = searchMatches(gs, "Allegretto", "en");
  assert.ok(allegretto.length);
  assert.ok(allegretto.every((r) => r.point.plan_en === "Kimi Allegretto"));
  const opencode = searchMatches(gs, "OpenCode", "en");
  assert.ok(opencode.length);
  assert.ok(opencode.every((r) => r.point.channel === "OpenCode"));
  const deepseek = searchMatches(gs, "deepseek", "en");
  assert.ok(deepseek.length);
  assert.ok(deepseek.every((r) => r.point.id.includes("deepseek")));
  // One row per point id even when a point maps to several configurations.
  const broad = searchMatches(gs, "glm", "en");
  assert.equal(new Set(broad.map((r) => r.point.id)).size, broad.length);
});
test("Chart search lock overrides the live match set and reports a missing lock", () => {
  const gs = groups(
    rowsFor(data, { ...defaultState(), configuration: "all" }),
  );
  const lockId = "kimi_allegretto_cn::kimi-k3";
  // A point id can map to several configurations, hence several groups.
  const expectedKeys = new Set(
    gs
      .filter((g) => g.rows.some((r) => r.point.id === lockId))
      .map((g) => g.key),
  );
  const locked = searchHits(gs, "opencode", { kind: "point", value: lockId }, "en");
  assert.deepEqual(locked.keys, expectedKeys);
  assert.equal(locked.total, 1);
  assert.equal(locked.locked?.kind, "point");
  assert.equal(locked.locked?.points, 1);
  assert.equal(locked.lockMissing, false);
  const missing = searchHits(gs, "", { kind: "point", value: "not-a-point" }, "en");
  assert.equal(missing.lockMissing, true);
  assert.equal(missing.keys.size, 0);
  assert.equal(missing.total, 0);
  assert.equal(missing.locked, null);
  // A loose query marks at most SEARCH_MARK_CAP groups but still counts all.
  const broad = searchHits(gs, "5", null, "en");
  assert.ok(broad.total > SEARCH_MARK_CAP);
  assert.ok(broad.keys.size <= SEARCH_MARK_CAP);
  const idle = searchHits(gs, "", null, "en");
  assert.equal(idle.keys.size, 0);
  assert.equal(idle.total, 0);
});
test("Chart search model and plan locks cover every matching group uncapped", () => {
  const gs = groups(
    rowsFor(data, { ...defaultState(), configuration: "all" }),
  );
  const modelIds = new Set(
    gs
      .flatMap((g) => g.rows)
      .filter((r) => r.point.model === "glm-5.3")
      .map((r) => r.point.id),
  );
  const modelHit = searchHits(gs, "zzz", { kind: "model", value: "glm-5.3" }, "en");
  assert.deepEqual(
    modelHit.keys,
    new Set(
      gs
        .filter((g) => g.rows.some((r) => r.point.model === "glm-5.3"))
        .map((g) => g.key),
    ),
  );
  assert.equal(modelHit.total, modelIds.size);
  assert.ok(modelHit.total > SEARCH_MARK_CAP);
  assert.equal(modelHit.locked?.kind, "model");
  assert.equal(modelHit.locked?.points, modelIds.size);
  assert.equal(modelHit.locked?.label, "GLM 5.3");
  assert.equal(modelHit.lockMissing, false);
  const planIds = new Set(
    gs
      .flatMap((g) => g.rows)
      .filter((r) => r.point.plan_id === "command_code_goat")
      .map((r) => r.point.id),
  );
  const planHit = searchHits(
    gs,
    "",
    { kind: "plan", value: "command_code_goat" },
    "en",
  );
  assert.deepEqual(
    planHit.keys,
    new Set(
      gs
        .filter((g) => g.rows.some((r) => r.point.plan_id === "command_code_goat"))
        .map((g) => g.key),
    ),
  );
  assert.equal(planHit.total, planIds.size);
  assert.ok(planHit.total > SEARCH_MARK_CAP);
  assert.equal(planHit.locked?.kind, "plan");
  assert.equal(planHit.locked?.points, planIds.size);
  assert.equal(planHit.locked?.label, displayPlan("Command Code GOAT", "en"));
  const gone = searchHits(gs, "", { kind: "model", value: "not-a-model" }, "en");
  assert.equal(gone.lockMissing, true);
  assert.equal(gone.locked, null);
});
test("Chart search candidates match each kind against its own scope", () => {
  const gs = groups(
    rowsFor(data, { ...defaultState(), configuration: "all" }),
  );
  // "cursor" is a channel: it must list Cursor plans but never the Grok model,
  // whose model-level lock would mark Grok points on other channels too.
  const cursor = searchCandidates(gs, "cursor", "en");
  assert.ok(cursor.plans.length);
  assert.ok(cursor.plans.every((c) => c.row.point.channel === "Cursor"));
  assert.equal(cursor.models.length, 0);
  assert.ok(searchCandidates(gs, "claude", "en").models.length);
  assert.ok(searchCandidates(gs, "anthropic", "en").models.length);
  const c = searchCandidates(gs, "kimi 199", "en");
  assert.deepEqual(
    c.points.map((r) => r.point.id),
    searchMatches(gs, "kimi 199", "en").map((r) => r.point.id),
  );
});
test("Model family labels strip only the plan-generation tag", () => {
  const k3 = data.points.find((p) => p.model_display === "Kimi K3 (v1)")!;
  assert.equal(k3.plan_gen, "v1");
  assert.equal(modelFamilyLabel(k3), "Kimi K3");
  const untagged = data.points.find((p) => !p.plan_gen)!;
  assert.equal(modelFamilyLabel(untagged), untagged.model_display);
  // A tag that does not match the display suffix is never stripped.
  assert.equal(
    modelFamilyLabel({ ...k3, plan_gen: "v9" }),
    "Kimi K3 (v1)",
  );
});
test("Model lock labels and coverage are generation-independent", () => {
  const gs = groups(
    rowsFor(data, { ...defaultState(), configuration: "all" }),
  );
  const candidate = searchCandidates(gs, "glm 5.3", "en").models.find(
    (c) => c.value === "glm-5.3",
  )!;
  const hits = searchHits(gs, "", { kind: "model", value: "glm-5.3" }, "en");
  assert.ok(!candidate.label.includes("(v"));
  assert.equal(candidate.label, hits.locked!.label);
  // A generation-bearing query narrows the matched rows, but the lock still
  // covers the whole family — the candidate's numbers must promise that.
  const genQuery = "glm 5.3 v3";
  const scoped = searchCandidates(gs, genQuery, "en").models.find(
    (c) => c.value === "glm-5.3",
  )!;
  assert.equal(scoped.points, hits.total);
  const matchedRows = gs
    .flatMap((g) => g.rows)
    .filter((r) => r.point.model === "glm-5.3" && r.point.plan_gen === "v3");
  assert.ok(matchedRows.length);
  assert.ok(scoped.points > matchedRows.length);
});
test("Point-level candidates and locks keep the generation tag", () => {
  const gs = groups(
    rowsFor(data, { ...defaultState(), configuration: "all" }),
  );
  const pointHits = searchHits(
    gs,
    "",
    { kind: "point", value: "kimi_allegretto_cn::kimi-k3" },
    "en",
  );
  assert.match(pointHits.locked!.label, /\(v\d\)/);
  const tagged = searchCandidates(gs, "allegretto k3", "en").points.find(
    (r) => r.point.id === "kimi_allegretto_cn::kimi-k3",
  )!;
  assert.match(tagged.point.model_display, /\(v\d\)/);
});
test("Share links round-trip the chart search query and lock", () => {
  const locks: Lock[] = [
    { kind: "point", value: data.points[0].id },
    { kind: "model", value: "glm-5.3" },
    { kind: "plan", value: "command_code_goat" },
  ];
  for (const lock of locks) {
    const s = { ...defaultState(), find: "kimi 199", lock };
    const restored = restore(serialize(s), data);
    assert.equal(restored.state.find, "kimi 199");
    assert.deepEqual(restored.state.lock, lock);
    assert.equal(restored.warning, false);
  }
  for (const hash of [
    "#find=x&lock=not-a-point",
    "#lock=bogus:x",
    "#lock=model:not-a-model",
  ]) {
    const bad = restore(hash, data);
    assert.equal(bad.state.lock, null);
    assert.equal(bad.warning, true);
  }
});
test("Forced search labels keep their least-bad slot when every slot is blocked", () => {
  const r = row("blocked", 0.01, 1500);
  r.point = { ...r.point, model_display: "Claude Opus 5" };
  const g: Group = {
    key: r.key,
    price: 0.01,
    plotPrice: 0.01,
    score: 1500,
    rows: [r],
  };
  const anchor = { key: g.key, x: 120, y: 100, r: FRONTIER_RADIUS };
  const dots = [];
  for (let x = 6; x < 240; x += 12)
    for (let y = 6; y < 200; y += 12)
      dots.push({ key: `dot-${x}-${y}`, x, y, r: 6 });
  const box = { left: 0, top: 0, right: 240, bottom: 200, width: 240, height: 200 };
  assert.deepEqual(
    placeTextLabels([g], new Map([[g.key, anchor]]), dots, box, false),
    [],
  );
  const forced = placeTextLabels(
    [g],
    new Map([[g.key, anchor]]),
    dots,
    box,
    false,
    "en",
    new Set([g.key]),
  );
  assert.equal(forced.length, 1);
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
test("colorAlpha renders a channel colour at the requested alpha", () => {
  const p = { ...data.points[0], channel: "xAI" };
  assert.equal(color(p), "#9333EA");
  assert.equal(colorAlpha(p, 0.3), "rgba(147, 51, 234, 0.3)");
  assert.equal(colorAlpha(p, 0.45), "rgba(147, 51, 234, 0.45)");
  // Unknown channels fall back to color()'s default hex without crashing.
  assert.equal(
    colorAlpha({ ...data.points[0], channel: "NoSuchChannel" }, 0.3),
    "rgba(138, 148, 166, 0.3)",
  );
});
test("Chart scale maps the reversed log price axis and round-trips pan, zoom and box zoom", () => {
  const box = makeBox(900, 500, { l: 60, r: 20, t: 20, b: 60 });
  const gs = groups([row("cheap", 0.001, 20), row("dear", 1, 60)]);
  const v = homeView(gs);
  const cheap = toPixel(v, box, 0.001, 20);
  const dear = toPixel(v, box, 1, 60);
  assert.ok(cheap.x > dear.x, "cheaper sits further right");
  assert.ok(dear.y < cheap.y, "higher scores sit higher");
  for (const p of [cheap, dear]) {
    assert.ok(p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom);
  }
  // Zoom keeps the data under the cursor fixed and is reversible.
  const z = zoomAt(v, box, cheap.x, cheap.y, 0.5);
  const still = toPixel(z, box, 0.001, 20);
  assert.ok(Math.abs(still.x - cheap.x) < 1e-6 && Math.abs(still.y - cheap.y) < 1e-6);
  const back = zoomAt(z, box, cheap.x, cheap.y, 2);
  for (const k of ["xl", "xr", "yb", "yt"] as const) assert.ok(Math.abs(back[k] - v[k]) < 1e-9);
  // Panning moves the data with the pointer.
  const moved = toPixel(panBy(v, box, 40, -25), box, 1, 60);
  assert.ok(Math.abs(moved.x - dear.x - 40) < 1e-6 && Math.abs(moved.y - dear.y + 25) < 1e-6);
  // Box zoom frames exactly the dragged rectangle.
  const framed = boxToView(v, box, dear.x, dear.y, cheap.x, cheap.y);
  const a = toPixel(framed, box, 1, 60);
  const b = toPixel(framed, box, 0.001, 20);
  assert.ok(Math.abs(a.x - box.left) < 1e-6 && Math.abs(a.y - box.top) < 1e-6);
  assert.ok(Math.abs(b.x - box.right) < 1e-6 && Math.abs(b.y - box.bottom) < 1e-6);
});
test("Price ticks use plain decimals, stay in view, keep their spacing and skip the $0 slot", () => {
  assert.equal(formatTickPrice(0.0005), "$0.0005");
  assert.equal(formatTickPrice(0.02), "$0.02");
  assert.equal(formatTickPrice(2), "$2");
  assert.equal(formatTickPrice(1000), "$1,000");
  const box = makeBox(1000, 500, { l: 60, r: 20, t: 20, b: 60 });
  const v = { xl: 0.5, xr: -3.5, yb: 0, yt: 100 };
  const ticks = priceTicks(v, box, 60);
  assert.ok(ticks.length >= 4);
  ticks.forEach((t, i) => {
    assert.ok(t.pos >= box.left - 1e-6 && t.pos <= box.right + 1e-6);
    if (i) assert.ok(t.pos - ticks[i - 1].pos >= 60 - 1e-6, "ticks keep their minimum gap");
  });
  assert.ok(!ticks.some((t) => t.label.includes("e")), "no exponent notation");
  // Nothing cheaper than the fence of the unmetered slot gets a tick.
  const fenced = priceTicks(v, box, 60, Math.log10(0.001));
  assert.ok(fenced.every((t) => Number(t.label.replace(/[$,]/g, "")) >= 0.001));
  // A narrow mobile plot thins whole decades rather than overlapping labels.
  const narrow = priceTicks({ xl: 1, xr: -5, yb: 0, yt: 1 }, makeBox(320, 300, { l: 40, r: 10, t: 10, b: 40 }), 54);
  narrow.forEach((t, i) => i && assert.ok(t.pos - narrow[i - 1].pos >= 54 - 1e-6));
  const y = scoreTicks({ xl: 1, xr: 0, yb: 1403, yt: 1517 }, box, "en");
  assert.ok(y.length >= 3 && y.every((t) => /^1,[45]\d\d$/.test(t.label)));
});
test("Hit testing prefers the nearest target relative to its size", () => {
  const items = [
    { key: "badge", x: 100, y: 100, r: 17 },
    { key: "dot", x: 108, y: 100, r: 9 },
  ];
  assert.equal(hitTest(items, 104, 100)?.key, "badge");
  assert.equal(hitTest(items, 110, 100)?.key, "dot");
  assert.equal(hitTest(items, 200, 200), null);
});
test("Channel palette is shared with the Python charts and keeps pale colours legible", () => {
  const config = JSON.parse(readConfig(new URL("../../config/channel-colors.json", import.meta.url), "utf8"));
  assert.deepEqual(channelColors, config.colors);
  assert.equal(channelColors.StepFun, "#00F4E5", "CONVENTIONS pins StepFun");
  for (const channel of new Set(data.points.map((p) => p.channel)))
    assert.ok(channelColors[channel], `${channel} has a colour`);
  for (const hex of Object.values(channelColors)) {
    const light = dotColors(hex, false);
    // Every dot outline is darker than its fill on white.
    assert.ok(luminance(light.stroke) < luminance(light.fill) || luminance(hex) < 0.05);
    // No dot disappears into the dark surface.
    assert.ok(luminance(dotColors(hex, true).fill) > 0.02);
  }
});
