import type { Mapping, Point, SiteData } from "./types";

/** One model a custom (relay) provider serves, priced per MTok. */
export interface CustomModelPrice {
  /** Served-model slug; matching a known model attaches leaderboard scores. */
  model: string;
  /** Display name; falls back to the known model's name, then the slug. */
  displayName: string;
  currency: "USD" | "CNY";
  /** Cached-read price per MTok; null means "same as input". */
  cached: number | null;
  input: number;
  output: number;
}
export interface CustomProvider {
  id: string;
  name: string;
  /** Optional homepage / pricing page, shown as the point's evidence. */
  url: string;
  /** ISO date (yyyy-mm-dd) the entry was created; used as the data date. */
  createdAt: string;
  models: CustomModelPrice[];
}

/** Fresh local identity; never reuse an imported provider's overwrite key. */
export const newProviderId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** An isolated, unsaved copy. The caller decides whether to persist it. */
export function copyCustomProvider(
  provider: CustomProvider,
  suffix: string,
): CustomProvider {
  return {
    ...provider,
    id: newProviderId(),
    name: `${provider.name} ${suffix}`,
    createdAt: new Date().toISOString().slice(0, 10),
    models: provider.models.map((model) => ({ ...model })),
  };
}

const STORAGE_KEY = "pricing-custom-providers";

/** Only http(s) URLs may become links; anything else degrades to "". */
export function safeHttpUrl(s: string): string {
  const v = s.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? v : "";
  } catch {
    return "";
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isPrice = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Structural validation shared by localStorage load and JSON import. Throws on
 * anything unusable; the load path catches and falls back to an empty list.
 */
function validateProviders(raw: unknown): CustomProvider[] {
  const list = isRecord(raw) ? raw.providers : raw;
  if (!Array.isArray(list)) throw new Error("Not a provider list");
  return list.map((entry, i) => {
    if (!isRecord(entry)) throw new Error(`Provider #${i + 1} is not an object`);
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name) throw new Error(`Provider #${i + 1} has no name`);
    const models = Array.isArray(entry.models) ? entry.models : [];
    if (!models.length) throw new Error(`${name}: no models`);
    const slugs = new Set<string>();
    return {
      id:
        typeof entry.id === "string" && entry.id
          ? entry.id
          : `p${i.toString(36)}${Date.now().toString(36)}`,
      name,
      url: safeHttpUrl(typeof entry.url === "string" ? entry.url : ""),
      createdAt:
        typeof entry.createdAt === "string" && entry.createdAt
          ? entry.createdAt
          : new Date().toISOString().slice(0, 10),
      models: models.map((m, j) => {
        if (!isRecord(m)) throw new Error(`${name} model #${j + 1} is not an object`);
        const model = typeof m.model === "string" ? m.model.trim() : "";
        if (!model) throw new Error(`${name} model #${j + 1} has no slug`);
        if (slugs.has(model)) throw new Error(`${name}: duplicate model ${model}`);
        slugs.add(model);
        if (!isPrice(m.input) || !isPrice(m.output))
          throw new Error(`${name} · ${model}: input/output prices must be positive numbers`);
        const cached =
          m.cached === null || m.cached === undefined
            ? null
            : typeof m.cached === "number" && Number.isFinite(m.cached) && m.cached >= 0
              ? m.cached
              : (() => {
                  throw new Error(`${name} · ${model}: cached price must be a number`);
                })();
        return {
          model,
          displayName: typeof m.displayName === "string" ? m.displayName.trim() : "",
          currency: m.currency === "CNY" ? ("CNY" as const) : ("USD" as const),
          cached,
          input: m.input,
          output: m.output,
        };
      }),
    };
  });
}

export function loadCustomProviders(): CustomProvider[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? validateProviders(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}
/** Persists to localStorage; returns false when storage rejects the write. */
export function saveCustomProviders(providers: CustomProvider[]): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, providers }),
    );
    return true;
  } catch {
    return false;
  }
}
export function exportCustomProviders(providers: CustomProvider[]): string {
  return JSON.stringify({ version: 1, providers }, null, 2);
}
/** Import path: invalid JSON or structure surfaces as an Error to the user. */
export function parseCustomProviders(text: string): CustomProvider[] {
  return validateProviders(JSON.parse(text));
}

/**
 * Real USD per MTok under the project standard workload, mirroring the Python
 * pipeline: cache/输入/输出 三段价按 standardTokenMix 加权，CNY 先按约定汇率折算。
 */
export function realPriceUsd(
  m: CustomModelPrice,
  conventions: SiteData["conventions"],
): number {
  const mix = conventions.standardTokenMix;
  const toUsd = (n: number) =>
    m.currency === "CNY" ? n / conventions.usdPerCny : n;
  const cached = m.cached ?? m.input;
  return Number(
    (
      mix.cache * toUsd(cached) +
      mix.input * toUsd(m.input) +
      mix.output * toUsd(m.output)
    ).toPrecision(6),
  );
}

/**
 * Append user-defined metered points (and same-model score references) to the
 * published site data. A custom provider is a relay: billing "metered", the
 * provider name as both channel and plan, the model developer as vendor when
 * the served model is known. Known models reuse the model's existing benchmark
 * configurations — the same "exact served-model reference" mapping the
 * official API points use — so the point joins the Pareto chart and ranking;
 * unknown models stay scoreless and appear in the price ranking only.
 */
export function mergeCustomProviders(
  data: SiteData,
  providers: CustomProvider[],
): SiteData {
  if (!providers.length) return data;
  const knownModel = new Map<string, Point>();
  for (const p of data.points)
    if (!p.id.startsWith("custom::") && !knownModel.has(p.model))
      knownModel.set(p.model, p);
  const configModel = new Map(
    data.configurations.map((c) => [c.configuration_id, c.model]),
  );
  const points: Point[] = [];
  const mappings: Mapping[] = [];
  for (const provider of providers) {
    for (const mod of provider.models) {
      const ref = knownModel.get(mod.model);
      const display = mod.displayName || ref?.model_display || mod.model;
      const id = `custom::${provider.id}::${mod.model}`;
      const url = safeHttpUrl(provider.url);
      const sourceZh = url
        ? `自定义供应商「${provider.name}」报价（用户本地录入，未经公开核实）：${url}`
        : `自定义供应商「${provider.name}」报价（用户本地录入，未经公开核实）`;
      const sourceEn = url
        ? `Custom provider "${provider.name}" pricing (user-local entry, not publicly verified): ${url}`
        : `Custom provider "${provider.name}" pricing (user-local entry, not publicly verified)`;
      points.push({
        id,
        // One plan per provider: its models group together (chart plan search,
        // filters, share links) instead of scattering as one-plan-per-model.
        plan_id: `custom::${provider.id}`,
        plan: provider.name,
        plan_en: null,
        local_price: null,
        model: mod.model,
        model_display: display,
        vendor: ref?.vendor ?? provider.name,
        channel: provider.name,
        label: `${display} ${provider.name}`,
        billing: "metered",
        confidence: "high",
        price_usd: null,
        original_price: null,
        currency: mod.currency,
        monthly_yi: null,
        monthly_tokens: null,
        real_usd_per_mtok: realPriceUsd(mod, data.conventions),
        unmetered: false,
        promo_until: null,
        list_blended_usd_per_mtok: null,
        workload: "standard",
        data_date: provider.createdAt,
        data_date_kind: null,
        data_date_from: null,
        list_price: {
          cached: mod.cached ?? mod.input,
          input: mod.input,
          output: mod.output,
          currency: mod.currency,
        },
        source: sourceZh,
        note: "",
        decision_note: "",
        source_en: sourceEn,
        note_en: "",
        decision_note_en: "",
        evidence: url ? [{ label: url, url }] : [],
      });
      // Score reuse: copy every mapping whose configuration benchmarks this
      // model, retargeted at the custom point (deduped per board/config).
      if (ref) {
        const seen = new Set<string>();
        for (const m of data.mappings) {
          if (configModel.get(m.configuration_id) !== mod.model) continue;
          const key = `${m.board}|${m.configuration_id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          mappings.push({ ...m, point_id: id });
        }
      }
    }
  }
  return {
    ...data,
    points: [...data.points, ...points],
    mappings: [...data.mappings, ...mappings],
  };
}
