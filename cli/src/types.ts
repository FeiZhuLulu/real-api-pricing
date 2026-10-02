import type { Mapping, Point, SiteData } from "../../web/src/types.js";

export type { Mapping, Point, SiteData };
export type View = "price" | "allowance" | "table";
export type Format = "table" | "json" | "csv";
export type Resource = "models" | "companies" | "channels" | "plans" | "boards";

export interface DatasetContext {
  data: SiteData;
  source: "bundled" | "file";
  sourcePath: string | null;
}

export interface PublicPoint extends Point {
  company: string;
  company_display: string;
  plan_display: string;
}

export type Benchmark = Mapping & { best_tie_count?: number };
export interface QueryRow {
  rank?: number;
  point: PublicPoint;
  benchmark: Benchmark | null;
}
export interface ShowRow {
  point: PublicPoint;
  benchmarks: Benchmark[];
}
export interface Warning {
  code: string;
  message: string;
  point_id: string | null;
}
export interface Metadata {
  command: "price" | "allowance" | "query" | "list" | "show" | "compare" | "info";
  resource: Resource | null;
  snapshot: string;
  source: "bundled" | "file";
  sourcePath: string | null;
  view: View | null;
  board: string | null;
  boardSnapshot: string | null;
  total: number;
  returned: number;
  truncated: boolean;
  warnings: Warning[];
}
export interface Result<T = unknown> {
  schemaVersion: 1;
  meta: Metadata;
  rows: T[];
}

export interface QueryOptions {
  view: View;
  models: string[];
  companies: string[];
  channels: string[];
  plans: string[];
  billing: string[];
  confidence: string[];
  search: string;
  minFee?: number;
  maxFee?: number;
  minPrice?: number;
  maxPrice?: number;
  minTokens?: number;
  maxTokens?: number;
  feeBand: string;
  board?: string;
  harness: string[];
  effort: string[];
  modes: string[];
  config: "best" | "all";
  minScore?: number;
  scoredOnly: boolean;
  frontier: boolean;
  sort: string;
  limit?: number;
}
export interface ListOptions {
  companies: string[];
  channels: string[];
  search: string;
  limit?: number;
}

export class CliError extends Error {
  constructor(message: string, public readonly exitCode: 1 | 2 = 2) {
    super(message);
    this.name = "CliError";
  }
}
