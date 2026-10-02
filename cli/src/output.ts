import Table from "cli-table3";
import { stringify } from "csv-stringify/sync";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";
import {
  allowance,
  dataDateLine,
  effortLabel,
  listPriceLine,
  number,
  price,
  priceExact,
  unmeteredNote,
  workloadLine,
} from "../../web/src/domain.js";
import type {
  Benchmark,
  DatasetContext,
  Format,
  PublicPoint,
  QueryOptions,
  QueryRow,
  Result,
  ShowRow,
} from "./types.js";

type RecordRow = Record<string, unknown>;
type Cell = string | number | boolean | null | undefined;
type DisplayCell = Cell | { content: Cell; colSpan: number };

const POINT_COLUMNS = [
  "rank", "point_id", "model", "model_display", "company", "company_display",
  "channel", "plan_id", "plan", "plan_display", "billing", "price_usd",
  "monthly_tokens", "real_usd_per_mtok", "confidence", "workload", "data_date",
  "unmetered", "promo_until", "source", "decision_note", "evidence_json",
  "board", "configuration_id", "score", "benchmark_json",
];
const LIST_COLUMNS = {
  models: ["model", "model_display", "company", "company_display", "plans", "channels", "points"],
  companies: ["company", "company_display", "models", "plans", "points"],
  channels: ["channel", "models", "plans", "points"],
  plans: ["plan_id", "plan_display", "channel", "companies_json", "models", "points"],
  boards: ["board", "name", "metric", "snapshot", "configurations"],
};
const INFO_COLUMNS = ["snapshot", "source", "source_path", "counts_json", "conventions_json"];
const CORE_HEADERS = [
  "Model", "Company", "Channel", "Plan", "USD/MTok", "Monthly tokens",
  "Monthly fee USD", "Billing", "Confidence", "Point ID",
];
const HEADERS: Record<string, string> = {
  model: "Model ID", model_display: "Model", company: "Company ID",
  company_display: "Company", channel: "Channel", plan_id: "Plan ID",
  plan_display: "Plan", companies: "Companies (IDs)", plans: "Plans",
  models: "Models", channels: "Channels", points: "Points", board: "Board ID",
  name: "Board", metric: "Metric", snapshot: "Board snapshot",
  configurations: "Configurations",
};

const text = (value: Cell, fallback = "—"): string =>
  value === null || value === undefined ? fallback : String(value);
const raw = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : String(value);
const nullableBoolean = (value: boolean | null | undefined): string =>
  value === null || value === undefined ? "unverified" : String(value);
const jsonCell = (value: unknown): string | null =>
  value === null || value === undefined ? null : JSON.stringify(value);

/** Protect spreadsheet text while preserving numeric values and identifiers. */
function spreadsheetText(value: string | null | undefined): string | null | undefined {
  return value && /^(?:[ \u00a0]*[=+@-]|[\t\r\n])/.test(value) ? `'${value}` : value;
}

function width(): number {
  // A redirected export is reproducible; a terminal can use its actual width.
  return process.stdout.isTTY && process.stdout.columns
    ? Math.max(60, process.stdout.columns)
    : 180;
}

const lineWidth = (value: string): number =>
  Math.max(...value.split("\n").map((line) => stringWidth(line)));

const wrapCell = (value: Cell, available: number): string =>
  wrapAnsi(text(value), Math.max(1, available), { hard: true, wordWrap: false, trim: false });

function cellWidths(headers: string[], rows: Cell[][], available = width()): number[] {
  const natural = headers.map((header, column) => Math.min(48, Math.max(
    6,
    lineWidth(header) + 2,
    rows.reduce((longest, row) => Math.max(longest, lineWidth(text(row[column], "")) + 2), 0),
  )));
  const budget = Math.max(headers.length * 6, available - headers.length - 1);
  while (natural.reduce((sum, n) => sum + n, 0) > budget) {
    const widest = natural.indexOf(Math.max(...natural));
    if (natural[widest]! <= 6) break;
    natural[widest]!--;
  }
  return natural;
}

function appendRow(table: Table.Table, cells: DisplayCell[]): void {
  let column = 0;
  table.push(cells.map((value) => {
    const cell = typeof value === "object" && value !== null ? value : { content: value, colSpan: 1 };
    const span = cell.colSpan;
    const innerWidth = table.options.colWidths.slice(column, column + span)
      .reduce<number>((sum, size) => sum + (size ?? 0), span - 1) - 2;
    column += span;
    return { ...cell, content: wrapCell(cell.content, innerWidth) };
  }));
}

function createTable(headers: string[], rows: Cell[][], widths?: number[]): Table.Table {
  const colWidths = widths ?? cellWidths(headers, rows);
  const table = new Table({
    head: headers.map((header, column) => wrapCell(header, colWidths[column]! - 2)),
    colWidths,
    // cli-table3's character slicing can truncate wide Unicode characters.
    // Wrap every cell by display width before passing it to the table renderer.
    wordWrap: false,
    style: { head: [], border: [], "padding-left": 1, "padding-right": 1 },
  });
  for (const row of rows) appendRow(table, row);
  return table;
}
function table(headers: string[], rows: Cell[][]): string {
  return createTable(headers, rows).toString();
}

const confidenceLabel = (value: string) => ({ high: "High", medium: "Medium", low: "Low" })[value] ?? value;

function coreCells(row: QueryRow, ranking: boolean, exactPrice = false): Cell[] {
  const p = row.point;
  const monthlyFee = p.billing === "metered" ? "—" : price(p.price_usd);
  const cells: Cell[] = [
    p.model_display, p.company_display, p.channel, p.plan_display,
    (exactPrice ? priceExact : price)(p.real_usd_per_mtok), allowance(p, "en"),
    monthlyFee + (p.currency === "CNY" && p.original_price !== null ? `\n¥${p.original_price}` : ""),
    p.billing === "metered" ? "Metered API" : "Subscription", confidenceLabel(p.confidence), p.id,
  ];
  return ranking ? [row.rank, ...cells] : cells;
}

function coreTable(rows: QueryRow[], ranking = false, exactPrice = false): string {
  const headers = ranking ? ["Rank", ...CORE_HEADERS] : CORE_HEADERS;
  const cells = rows.map((row) => coreCells(row, ranking, exactPrice));
  const naturalWidth = headers.reduce((sum, header, i) =>
    sum + cells.reduce((longest, row) => Math.max(longest, lineWidth(text(row[i], ""))), lineWidth(header)) + 3,
  1);
  if (naturalWidth <= width() && rows.every((row) => lineWidth(row.point.id) <= 46 && !row.point.unmetered)) return table(headers, cells);

  // Keep the same columns and the complete ID in a continuation of its record.
  const continuationCells = cells.map((row) => [...row.slice(0, -1), "↓"]);
  const result = createTable(headers, [], cellWidths(headers, continuationCells));
  for (let i = 0; i < rows.length; i++) {
    appendRow(result, continuationCells[i]!);
    appendRow(result, [{ colSpan: headers.length, content: `Point ID: ${rows[i]!.point.id}` }]);
    const promo = unmeteredNote(rows[i]!.point, "en");
    if (promo) appendRow(result, [{ colSpan: headers.length, content: `Promotion: ${promo} · ${price(rows[i]!.point.price_usd)} / mo` }]);
  }
  return result.toString();
}

function workload(p: PublicPoint, context?: DatasetContext): string {
  if (context) return workloadLine(p, context.data.conventions, "en");
  return text(p.workload, "measured");
}
function fee(p: PublicPoint): string {
  return p.original_price === null ? "—" : `${p.original_price} ${p.currency}`;
}
function details(p: PublicPoint, context?: DatasetContext): [string, Cell][] {
  return [
    ["Model ID", p.model], ["Company ID", p.company], ["Plan ID", p.plan_id],
    ["Original monthly fee", fee(p)], ["Local price", p.local_price],
    ["Monthly tokens, raw", number(p.monthly_tokens, "en", 0)],
    ["USD/MTok, raw", raw(p.real_usd_per_mtok)], ["Workload", workload(p, context)],
    ["Data date", dataDateLine(p, "en") || "—"], ["Date kind", p.data_date_kind],
    ["Date inherited from", p.data_date_from], ["Unmetered", p.unmetered ?? false],
    ["Promotion until", p.promo_until], ["Promotion", unmeteredNote(p, "en") || "N/A"],
    ["Plan generation", p.plan_gen],
    ["Official model prices", listPriceLine(p, "en") || "N/A"],
    ["List blended USD/MTok", raw(p.list_blended_usd_per_mtok)],
    ["Subscription price assumption", p.billing === "metered" ? "N/A" : "Full use of the adopted allowance"],
  ];
}
function evidence(p: PublicPoint): string {
  const blocks = [
    `Source:\n${p.source || "N/A"}`,
    `Decision note:\n${p.decision_note || "N/A"}`,
  ];
  if (p.note) blocks.push(`Note:\n${p.note}`);
  if (p.evidence.length) blocks.push(table(["Evidence", "URL"], p.evidence.map((item) => [item.label, item.url])));
  return blocks.join("\n\n");
}
function benchmarkCells(b: Benchmark): [string, Cell][] {
  return [
    ["Board", b.board], ["Score", number(b.score ?? null, "en", 4)], ["Variant", b.variant],
    ["Configuration ID", b.configuration_id], ["Harness", b.agent_harness ?? "—"],
    ["Effort", effortLabel(b.reasoning_effort ?? null, "en") ?? "—"], ["Mode", b.service_mode ?? "—"],
    ["Score low", number(b.score_low ?? null, "en")], ["Score high", number(b.score_high ?? null, "en")],
    ["Estimated", b.score_is_estimated ?? false],
    ["Self-reported", b.score_is_self_reported ?? false],
    ["Mapping confidence", b.mapping_confidence ? confidenceLabel(b.mapping_confidence) : "—"],
    ["Quota effort matched", nullableBoolean(b.quota_effort_matched)],
    ["Best tie count", b.best_tie_count],
    ["Benchmark source", b.source], ["Mapping kind", b.mapping_kind],
    ["Mapping note", b.mapping_note], ["Benchmark archive", b.archive],
    ["Benchmark checked at", b.checked_at],
    ["Mean cost USD/task", price(b.mean_cost_usd_per_task ?? null)],
    ["Median cost USD/task", price(b.median_cost_usd_per_task ?? b.median_cost_per_task_usd ?? null)],
  ];
}
function boardSnapshot(b: Benchmark, result: Result, context?: DatasetContext): string {
  return context?.data.boards[b.board]?.snapshot
    ?? (result.meta.board === b.board ? result.meta.boardSnapshot : null)
    ?? "N/A";
}
function queryBenchmarks(rows: QueryRow[]): string {
  return table([
    "Point ID", "Score", "Effort", "Harness", "Mode", "Variant", "Configuration ID",
    "Estimated", "Self-reported", "Mapping confidence", "Quota effort matched", "Best ties",
  ], rows.map(({ point, benchmark: b }) => [
    point.id, number(b?.score ?? null, "en", 2), effortLabel(b?.reasoning_effort ?? null, "en") ?? "—", b?.agent_harness ?? "—", b?.service_mode ?? "—",
    b?.variant, b?.configuration_id, b ? (b.score_is_estimated ?? false) : null,
    b ? (b.score_is_self_reported ?? false) : null, b?.mapping_confidence ? confidenceLabel(b.mapping_confidence) : "—",
    b ? nullableBoolean(b.quota_effort_matched) : "N/A", b?.best_tie_count,
  ]));
}
function showTable(result: Result, context?: DatasetContext): string {
  const row = result.rows[0] as ShowRow;
  const blocks = [coreTable([{ point: row.point, benchmark: null }], false, true), table(["Field", "Value"], details(row.point, context)), evidence(row.point)];
  if (!row.benchmarks.length) {
    blocks.push("No mapped benchmark configurations.");
    return blocks.join("\n\n");
  }
  const boards = [...new Set(row.benchmarks.map((b) => b.board))];
  blocks.push(table(["Board ID", "Board", "Board snapshot"], boards.map((id) => [
    id, context?.data.boards[id]?.name ?? id,
    boardSnapshot(row.benchmarks.find((b) => b.board === id)!, result, context),
  ])));
  blocks.push(table([
    "Board ID", "Configuration ID", "Variant", "Score", "Harness", "Effort", "Mode",
    "Estimated", "Self-reported", "Mapping confidence", "Quota effort matched",
  ], row.benchmarks.map((b) => [
    b.board, b.configuration_id, b.variant, number(b.score, "en", 4), b.agent_harness ?? "—", effortLabel(b.reasoning_effort, "en") ?? "—",
    b.service_mode ?? "—", b.score_is_estimated ?? false, b.score_is_self_reported ?? false,
    confidenceLabel(b.mapping_confidence), nullableBoolean(b.quota_effort_matched),
  ])));
  for (const b of row.benchmarks) {
    blocks.push(`Configuration ID: ${b.configuration_id}\n` + table(["Field", "Value"], benchmarkCells(b)));
  }
  return blocks.join("\n\n");
}
function compareTable(result: Result, context?: DatasetContext): string {
  const rows = result.rows as QueryRow[];
  const fields = ["Point ID", ...details(rows[0]!.point, context).map(([field]) => field)];
  const pointDetails = rows.map((row) => new Map<string, Cell>([
    ["Point ID", row.point.id], ...details(row.point, context),
  ]));
  if (result.meta.board) {
    for (const field of ["Board snapshot", ...benchmarkCells(rows.find((row) => row.benchmark)?.benchmark ?? {
      board: result.meta.board,
    } as Benchmark).map(([label]) => label)]) {
      if (!fields.includes(field)) fields.push(field);
    }
    rows.forEach((row, i) => {
      if (!row.benchmark) return;
      pointDetails[i]!.set("Board snapshot", boardSnapshot(row.benchmark, result, context));
      for (const [field, value] of benchmarkCells(row.benchmark)) pointDetails[i]!.set(field, value);
    });
  }
  const blocks = [coreTable(rows, false, true), table(
    ["Field", ...rows.map((row) => row.point.plan_display)],
    fields.map((field) => [field, ...pointDetails.map((entry) => entry.get(field))]),
  )];
  for (const row of rows) blocks.push(`Point ID: ${row.point.id}\n\n${evidence(row.point)}`);
  return blocks.join("\n\n");
}

function infoTable(result: Result): string {
  const info = result.rows[0] as RecordRow;
  const counts = info.counts as Record<string, number>;
  const conventions = info.conventions as RecordRow;
  const mix = (key: string, write = false) => {
    const values = conventions[key] as Record<string, number> | undefined;
    if (!values) return "N/A";
    const pct = (n: number | undefined) => `${+((n ?? 0) * 100).toFixed(2)}%`;
    return `${pct(values.cache)} cache reads / ${pct(write ? values.cacheWrite : values.input)} ${write ? "cache writes" : "fresh input"} / ${pct(values.output)} output`;
  };
  const exchange = conventions.exchangeRate as RecordRow | undefined;
  const usdPerCny = conventions.usdPerCny as number | undefined;
  const fields: [string, Cell][] = [
    ["Data source", info.source === "file" ? `file: ${text(info.source_path as Cell)}` : "bundled"],
    ["Data snapshot", info.snapshot as Cell], ["Dataset version", info.datasetVersion as Cell],
    ["Price points", counts.points], ["Models", counts.models], ["Companies", counts.companies],
    ["Channels", counts.channels], ["Plans", counts.plans], ["Boards", counts.boards],
    ["Benchmark configurations", counts.configurations], ["Price/configuration mappings", counts.mappings],
    ["Subscription price assumption", conventions.subscriptionPriceAssumption as Cell],
    ["Allowances across models in one plan", conventions.allowancesAcrossModels as Cell],
    ["Generic month", `${text(conventions.monthWeeks as Cell)} weeks; vendor-specific monthly pools retain their adopted basis`],
    ["Standard workload", mix("standardTokenMix")], ["Anthropic workload", mix("anthropicTokenMix", true)],
    ["Low-cache workload", mix("lowCacheTokenMix")], ["Measured workload", conventions.measuredWorkload as Cell],
    ["Adopted exchange rate", usdPerCny ? `1 USD = ${usdPerCny} CNY` : "N/A"],
    ["Exchange rate date", exchange?.date as Cell], ["Exchange rate source", (exchange?.labelEn ?? exchange?.source) as Cell],
  ];
  return table(["Field", "Value"], fields);
}

function pointCsv(row: QueryRow, benchmark = row.benchmark): RecordRow {
  const p = row.point;
  return {
    rank: row.rank ?? null, point_id: p.id, model: p.model,
    model_display: spreadsheetText(p.model_display), company: p.company,
    company_display: spreadsheetText(p.company_display), channel: p.channel,
    plan_id: p.plan_id, plan: spreadsheetText(p.plan), plan_display: spreadsheetText(p.plan_display),
    billing: p.billing, price_usd: p.price_usd, monthly_tokens: p.monthly_tokens,
    real_usd_per_mtok: p.real_usd_per_mtok, confidence: p.confidence,
    workload: p.workload ?? null, data_date: p.data_date ?? null,
    unmetered: p.unmetered ?? false, promo_until: p.promo_until ?? null,
    source: spreadsheetText(p.source), decision_note: spreadsheetText(p.decision_note),
    evidence_json: jsonCell(p.evidence), board: benchmark?.board ?? null,
    configuration_id: benchmark?.configuration_id ?? null, score: benchmark?.score ?? null,
    benchmark_json: jsonCell(benchmark),
  };
}
function csvRows(result: Result): { columns: string[]; rows: RecordRow[] } {
  if (result.meta.command === "list") {
    const resource = result.meta.resource!;
    return {
      columns: LIST_COLUMNS[resource],
      rows: (result.rows as RecordRow[]).map((row) => ({
        ...row,
        model_display: spreadsheetText(row.model_display as string | undefined),
        company_display: spreadsheetText(row.company_display as string | undefined),
        plan_display: spreadsheetText(row.plan_display as string | undefined),
        name: spreadsheetText(row.name as string | undefined),
        metric: spreadsheetText(row.metric as string | undefined),
        companies_json: jsonCell(row.companies),
      })),
    };
  }
  if (result.meta.command === "info") return {
    columns: INFO_COLUMNS,
    rows: (result.rows as RecordRow[]).map((row) => ({
      snapshot: row.snapshot, source: row.source, source_path: row.source_path,
      counts_json: jsonCell(row.counts), conventions_json: jsonCell(row.conventions),
    })),
  };
  if (result.meta.command === "show") return {
    columns: POINT_COLUMNS,
    rows: (result.rows as ShowRow[]).flatMap((row) =>
      (row.benchmarks.length ? row.benchmarks : [null]).map((b) =>
        pointCsv({ point: row.point, benchmark: b }, b))),
  };
  return { columns: POINT_COLUMNS, rows: (result.rows as QueryRow[]).map((row) => pointCsv(row)) };
}
type DisplayOptions = Pick<QueryOptions, "sort" | "feeBand" | "config">;

function summary(result: Result, exportedRows?: number, options?: DisplayOptions): string {
  const meta = result.meta;
  const lines: string[] = [];
  if (meta.command !== "info") {
    const source = meta.source === "file" ? `file: ${meta.sourcePath}` : "bundled";
    let line = `Snapshot: ${meta.snapshot} | Source: ${source}`;
    if (meta.view) line += ` | View: ${meta.view}`;
    if (meta.resource) line += ` | Resource: ${meta.resource}`;
    lines.push(line);
  }
  if (meta.board) {
    let board = `Board: ${meta.board} | Board snapshot: ${meta.boardSnapshot ?? "N/A"}`;
    if (meta.view === "table" || meta.command === "compare") board += ` | Config: ${options?.config ?? "best"}`;
    lines.push(board);
  }
  lines.push(`Total: ${meta.total} | Returned: ${meta.returned} | Truncated: ${meta.truncated}`);
  if (exportedRows !== undefined) lines.push(`exported_rows: ${exportedRows}`);
  if (meta.view === "price") lines.push("Order: USD/MTok ascending; ties by Point ID.");
  else if (meta.view === "allowance") {
    lines.push("Order: monthly tokens descending; ties by Point ID.");
    lines.push(`Fee band: ${options?.feeBand ?? "all"}`);
  } else if (meta.view === "table" && options) {
    const sort = options.sort.includes(":") ? options.sort : `${options.sort}:asc`;
    lines.push(`Order: ${sort}`);
  }
  for (const warning of meta.warnings) {
    lines.push(warning.point_id ? `${warning.message} [${warning.point_id}]` : warning.message);
  }
  return lines.join("\n") + "\n";
}

/** Render without writing streams; data and diagnostic channels stay separate. */
export function renderResult(result: Result, format: Format, context?: DatasetContext, options?: DisplayOptions): { stdout: string; stderr: string } {
  if (format === "json") return { stdout: JSON.stringify(result, null, 2) + "\n", stderr: "" };
  if (format === "csv") {
    const { columns, rows } = csvRows(result);
    return {
      stdout: stringify(rows, { header: true, columns, cast: { boolean: (value) => String(value) } }),
      stderr: summary(result, rows.length, options),
    };
  }
  let stdout: string;
  if (!result.rows.length) stdout = "No matching results.";
  else if (result.meta.command === "list") {
    const resource = result.meta.resource!;
    const columns = LIST_COLUMNS[resource].map((key) => key === "companies_json" ? "companies" : key);
    stdout = table(columns.map((key) => HEADERS[key] ?? key), (result.rows as RecordRow[]).map((row) =>
      columns.map((key) => Array.isArray(row[key]) ? (row[key] as unknown[]).join(", ") : row[key] as Cell)));
  } else if (result.meta.command === "info") stdout = infoTable(result);
  else if (result.meta.command === "show") stdout = showTable(result, context);
  else if (result.meta.command === "compare") stdout = compareTable(result, context);
  else {
    stdout = coreTable(result.rows as QueryRow[], result.meta.view === "price" || result.meta.view === "allowance");
    if (result.meta.view === "table" && result.meta.board) stdout += "\n\n" + queryBenchmarks(result.rows as QueryRow[]);
  }
  return { stdout: stdout + "\n", stderr: summary(result, undefined, options) };
}
