import type { Lock } from "./domain";

export type Lang = "en" | "zh";
export type View = "pareto" | "price" | "allowance" | "method";
export interface Point {
  id: string;
  plan_id: string;
  plan: string;
  /** International plan name for merged CN/global tiers, e.g. "Kimi Allegretto". */
  plan_en?: string | null;
  /** Domestic list price shown alongside the international USD fee, e.g. "¥199". */
  local_price?: string | null;
  model: string;
  model_display: string;
  vendor: string;
  channel: string;
  label: string;
  billing: string;
  confidence: string;
  price_usd: number | null;
  original_price: number | null;
  currency: string;
  monthly_yi: number | null;
  monthly_tokens: number | null;
  real_usd_per_mtok: number;
  /** Bundled model that draws no quota: real price is $0 with no token denominator. */
  unmetered?: boolean;
  /** ISO date when a promotional unmetered period ends, if any. */
  promo_until?: string | null;
  list_blended_usd_per_mtok: number | null;
  /** Quota basis: which workload the capacity assumes — "standard" | "anthropic" | "lowCache" | "measured". */
  workload?: string;
  /** Plan generation tag for legacy plans, e.g. "v2" on GLM existing-customer tiers. */
  plan_gen?: string;
  /** Official metered API list prices per MTok in the vendor's own currency. */
  list_price?: { cached: number; input: number; output: number; currency: string } | null;
  source: string;
  note: string;
  decision_note: string;
  evidence: { label: string; url: string }[];
}
export interface Configuration {
  configuration_id: string;
  board: string;
  model: string;
  variant: string;
  score: number;
  score_is_estimated?: boolean | null;
  score_is_self_reported?: boolean | null;
  agent_harness: string | null;
  reasoning_effort: string | null;
  service_mode: string | null;
  score_low: number | null;
  score_high: number | null;
  source: string;
  archive?: string;
  checked_at?: string;
  mean_cost_usd_per_task?: number | null;
  median_cost_per_task_usd?: number | null;
  median_cost_usd_per_task?: number | null;
}
export interface Mapping extends Omit<Configuration, "model"> {
  point_id: string;
  mapping_kind: string;
  mapping_confidence: string;
  mapping_note: string;
  quota_effort_matched: boolean | null;
}
export interface SiteData {
  version: number;
  generatedAt: string;
  points: Point[];
  configurations: Configuration[];
  mappings: Mapping[];
  boards: Record<
    string,
    { name: string; metric: string; url: string; snapshot: string }
  >;
  conventions: {
    usdPerCny: number;
    monthWeeks: number;
    exchangeRate: {
      date: string;
      source: string;
      labelEn: string;
      labelZh: string;
    };
    standardTokenMix: { cache: number; input: number; output: number };
    lowCacheTokenMix: { cache: number; input: number; output: number };
    anthropicTokenMix: { cache: number; cacheWrite: number; output: number };
  };
}
export type FilterKey =
  | "vendors"
  | "channels"
  | "plans"
  | "billing"
  | "confidence"
  | "harness"
  | "effort"
  | "modes";
export interface State {
  feeBand: string;
  lang: Lang;
  view: View;
  board: string;
  selected: string[] | null;
  vendors: string[];
  channels: string[];
  plans: string[];
  billing: string[];
  confidence: string[];
  harness: string[];
  effort: string[];
  modes: string[];
  configuration: "all" | "summary";
  frontier: boolean;
  labels: "frontier" | "all" | "none";
  /** Chart search query: live-marks every matching point. */
  find: string;
  /** Locked scope from the suggestions: one point, one model across plans, or
      one plan across models; overrides the live match set. */
  lock: Lock | null;
  query: string;
  sort: string;
  direction: "asc" | "desc";
}
export interface Row {
  key: string;
  point: Point;
  mapping: Mapping | null;
  score: number | null;
}
export interface Group {
  key: string;
  /** Real price used for dominance and display; 0 for unmetered points. */
  price: number;
  /** Position on the log axis; unmetered groups sit on a dedicated "$0" slot. */
  plotPrice: number;
  score: number;
  rows: Row[];
}
