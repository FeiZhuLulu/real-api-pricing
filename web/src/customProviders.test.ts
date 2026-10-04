import test from "node:test";
import assert from "node:assert/strict";
import type { Configuration, Mapping, Point, SiteData } from "./types";
import {
  mergeCustomProviders,
  parseCustomProviders,
  exportCustomProviders,
  realPriceUsd,
  type CustomProvider,
} from "./customProviders";

const conventions: SiteData["conventions"] = {
  usdPerCny: 7,
  monthWeeks: 4,
  exchangeRate: {
    date: "2026-01-01",
    source: "test",
    labelEn: "test",
    labelZh: "test",
  },
  standardTokenMix: { cache: 0.97, input: 0.025, output: 0.005 },
  lowCacheTokenMix: { cache: 0.85, input: 0.145, output: 0.005 },
  anthropicTokenMix: { cache: 0.97, cacheWrite: 0.025, output: 0.005 },
};

const knownPoint: Point = {
  id: "acme_api::my-model",
  plan_id: "acme_api",
  plan: "Acme API",
  model: "my-model",
  model_display: "My Model",
  vendor: "Acme",
  channel: "Acme",
  label: "My Model Acme API",
  billing: "metered",
  confidence: "high",
  price_usd: null,
  original_price: null,
  currency: "USD",
  monthly_yi: null,
  monthly_tokens: null,
  real_usd_per_mtok: 0.5,
  list_blended_usd_per_mtok: null,
  source: "test",
  note: "",
  decision_note: "",
  evidence: [],
};

const configuration: Configuration = {
  configuration_id: "board1:cfg1",
  board: "board1",
  model: "my-model",
  variant: "My Model (max)",
  score: 50,
  agent_harness: null,
  reasoning_effort: "max",
  service_mode: null,
  score_low: null,
  score_high: null,
  source: "test",
};

const mapping: Mapping = {
  ...((({ model, ...rest }) => rest)(configuration) as Omit<
    Configuration,
    "model"
  >),
  point_id: knownPoint.id,
  mapping_kind: "model_configuration_reference",
  mapping_confidence: "medium",
  mapping_note: "Exact served-model reference; quota-measurement effort is unverified.",
  quota_effort_matched: null,
};

const site: SiteData = {
  version: 1,
  generatedAt: "2026-01-01",
  points: [knownPoint],
  configurations: [configuration],
  mappings: [mapping],
  boards: {
    board1: { name: "Board 1", metric: "Score", url: "", snapshot: "2026-01-01" },
  },
  conventions,
};

const provider: CustomProvider = {
  id: "prov1",
  name: "Relay Station",
  url: "https://relay.example.com/pricing",
  createdAt: "2026-10-04",
  models: [
    {
      model: "my-model",
      displayName: "",
      currency: "CNY",
      cached: 0.042,
      input: 2.1,
      output: 8.4,
    },
    {
      model: "mystery-model",
      displayName: "Mystery",
      currency: "USD",
      cached: null,
      input: 0.3,
      output: 1.2,
    },
  ],
};

test("merge with no providers returns the data unchanged", () => {
  assert.equal(mergeCustomProviders(site, []), site);
});

test("realPriceUsd weights the standard mix and defaults cached to input", () => {
  // 0.97×0.3 + 0.025×0.3 + 0.005×1.2
  assert.equal(
    realPriceUsd(
      { model: "m", displayName: "", currency: "USD", cached: null, input: 0.3, output: 1.2 },
      conventions,
    ),
    0.3045,
  );
});

test("realPriceUsd converts CNY at the convention rate", () => {
  // ¥0.042/¥2.1/¥8.4 ÷ 7 → $0.006/$0.3/$1.2 → 0.97×0.006 + 0.025×0.3 + 0.005×1.2
  assert.equal(
    realPriceUsd(
      { model: "m", displayName: "", currency: "CNY", cached: 0.042, input: 2.1, output: 8.4 },
      conventions,
    ),
    0.01932,
  );
});

test("custom points join as metered points with the provider as channel", () => {
  const merged = mergeCustomProviders(site, [provider]);
  assert.equal(merged.points.length, 3);
  const known = merged.points.find((p) => p.id === "custom::prov1::my-model")!;
  assert.ok(known);
  assert.equal(known.billing, "metered");
  assert.equal(known.channel, "Relay Station");
  assert.equal(known.plan, "Relay Station");
  assert.equal(known.vendor, "Acme"); // known model keeps its developer
  assert.equal(known.model_display, "My Model"); // falls back to the known name
  assert.equal(known.real_usd_per_mtok, 0.01932);
  assert.deepEqual(known.list_price, {
    cached: 0.042,
    input: 2.1,
    output: 8.4,
    currency: "CNY",
  });
  assert.deepEqual(known.evidence, [
    { label: provider.url, url: provider.url },
  ]);
  const mystery = merged.points.find(
    (p) => p.id === "custom::prov1::mystery-model",
  )!;
  assert.equal(mystery.vendor, "Relay Station"); // unknown model: provider is the vendor
  assert.equal(mystery.model_display, "Mystery");
  assert.equal(mystery.real_usd_per_mtok, 0.3045);
  assert.equal(mystery.list_price!.cached, 0.3); // cached defaults to input
});

test("known models reuse the model's benchmark mappings; unknown ones stay scoreless", () => {
  const merged = mergeCustomProviders(site, [provider]);
  assert.equal(merged.mappings.length, 2);
  const m = merged.mappings.find(
    (x) => x.point_id === "custom::prov1::my-model",
  )!;
  assert.ok(m);
  assert.equal(m.configuration_id, "board1:cfg1");
  assert.equal(m.score, 50);
  assert.equal(m.mapping_kind, "model_configuration_reference");
  assert.equal(
    merged.mappings.some((x) => x.point_id === "custom::prov1::mystery-model"),
    false,
  );
});

test("export/parse round-trips and rejects invalid input", () => {
  const parsed = parseCustomProviders(exportCustomProviders([provider]));
  assert.deepEqual(parsed, [provider]);
  assert.throws(() => parseCustomProviders("{}"));
  assert.throws(() =>
    parseCustomProviders(
      JSON.stringify({ version: 1, providers: [{ name: "" }] }),
    ),
  );
  assert.throws(() =>
    parseCustomProviders(
      JSON.stringify({
        version: 1,
        providers: [
          {
            name: "Bad",
            models: [{ model: "m", input: -1, output: 1 }],
          },
        ],
      }),
    ),
  );
});
