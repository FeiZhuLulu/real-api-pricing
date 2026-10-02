#!/usr/bin/env node
import { Command, CommanderError, InvalidArgumentError, Option } from "commander";
import { loadDataset } from "./dataset.js";
import { renderResult } from "./output.js";
import { executeCompare, executeInfo, executeList, executeQuery, executeShow } from "./query.js";
import { CliError, type Format, type ListOptions, type QueryOptions, type Resource, type Result, type View } from "./types.js";
import packageInfo from "../package.json";

const collect = (value: string, previous: string[] = []) => [...previous, value];
const numeric = (integer = false, positive = false) => (input: string): number => {
  const value = Number(input);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input) ||
      !Number.isFinite(value) || value < 0 ||
      (integer && !Number.isSafeInteger(value)) || (positive && value <= 0)) {
    throw new InvalidArgumentError(`Expected a ${positive ? "positive" : "non-negative"} ${integer ? "safe integer" : "finite number"}.`);
  }
  return value;
};

const program = new Command()
  .name("rap")
  .description("Read model prices and monthly allowances from a local snapshot.")
  .version(`rap ${packageInfo.version}`)
  .option("--data <site.json>", "Read a specified local snapshot")
  .option("--format <format>", "Output format: table | json | csv", "table")
  .configureHelp({ showGlobalOptions: true })
  .showHelpAfterError()
  .exitOverride()
  .configureOutput({ outputError: (message, write) => write(message) });

// Commander handles global options before and after subcommands by default.
// Validate format only for data actions so help/version never load data.
async function output(command: Command, run: (context: Awaited<ReturnType<typeof loadDataset>>) => Result, displayOptions?: QueryOptions) {
  const options = command.optsWithGlobals();
  if (!["table", "json", "csv"].includes(options.format)) {
    throw new CliError(`Unknown output format "${options.format}". Use table, json or csv.`);
  }
  const context = await loadDataset(options.data);
  const rendered = renderResult(run(context), options.format as Format, context, displayOptions);
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(rendered.stdout, error => {
      if ((error as NodeJS.ErrnoException | null)?.code === "EPIPE") process.exit(0);
      else if (error) reject(error);
      else resolve();
    });
  });
  if (rendered.stderr) process.stderr.write(rendered.stderr);
}

function scopeOptions(command: Command) {
  return command
    .option("--company <id>", "Exact model developer ID; repeatable", collect)
    .option("--vendor <id>", "Alias of --company; values are combined", collect)
    .option("--channel <name>", "Exact access channel; repeatable", collect);
}

function filters(command: Command) {
  scopeOptions(command);
  return command
    .option("--model <id>", "Exact model ID; repeatable", collect)
    .option("--plan <id>", "Exact plan ID; repeatable", collect)
    .option("--billing <kind>", "subscription | metered; repeatable", collect)
    .option("--confidence <level>", "high | medium | low; repeatable", collect)
    .option("--search <text>", "Whole-substring website search", "")
    .option("--min-fee <USD>", "Inclusive lower monthly-fee bound", numeric())
    .option("--max-fee <USD>", "Inclusive upper monthly-fee bound", numeric())
    .option("--min-price <USD/MTok>", "Inclusive lower real-price bound", numeric())
    .option("--max-price <USD/MTok>", "Inclusive upper real-price bound", numeric())
    .option("--min-tokens <integer>", "Inclusive lower monthly-token bound", numeric(true))
    .option("--max-tokens <integer>", "Inclusive upper monthly-token bound", numeric(true))
    .option("--board <id>", "Independent benchmark board")
    .option("--harness <name>", "Benchmark harness; requires --board; repeatable", collect)
    .option("--effort <name>", "Reasoning effort; requires --board; repeatable", collect)
    .option("--mode <name>", "Service mode; requires --board; repeatable", collect)
    .option("--limit <integer>", "Return at most this many rows; default: all", numeric(true, true));
}

function queryOptions(command: Command, view: View): QueryOptions {
  const o = command.opts();
  if (view !== "table") {
    for (const [name, flag] of [["sort", "sort"], ["minScore", "min-score"], ["scoredOnly", "scored-only"], ["frontier", "frontier"], ["config", "config"]]) {
      if (command.getOptionValueSource(name) === "cli") {
        throw new CliError(`--${flag} is available only with query --view table.`);
      }
    }
  }
  if (view !== "allowance" && command.getOptionValueSource("feeBand") === "cli") {
    throw new CliError("--fee-band requires the allowance view.");
  }
  if (command.getOptionValueSource("config") === "cli" && !o.board) {
    throw new CliError("--config requires --board.");
  }
  return {
    view, models: o.model ?? [], companies: [...(o.company ?? []), ...(o.vendor ?? [])],
    channels: o.channel ?? [], plans: o.plan ?? [], billing: o.billing ?? [], confidence: o.confidence ?? [],
    search: o.search ?? "", minFee: o.minFee, maxFee: o.maxFee, minPrice: o.minPrice,
    maxPrice: o.maxPrice, minTokens: o.minTokens, maxTokens: o.maxTokens, feeBand: o.feeBand ?? "all",
    board: o.board, harness: o.harness ?? [], effort: o.effort ?? [], modes: o.mode ?? [],
    config: o.config ?? "best", minScore: o.minScore, scoredOnly: Boolean(o.scoredOnly),
    frontier: Boolean(o.frontier), sort: o.sort ?? "price:asc", limit: o.limit,
  };
}

for (const view of ["price", "allowance"] as const) {
  const command = filters(program.command(view).description(view === "price"
    ? "Real price ranking, lowest first; includes metered APIs and unscored points."
    : "Monthly allowance ranking, largest first; subscriptions with known monthly tokens."));
  if (view === "allowance") command.option("--fee-band <band>", "all | 0-30 | 30-100 | 100-300", "all");
  command.addHelpText("after", "\nGlobal options: --data <site.json> --format table|json|csv --version\nUse query --view table for custom sorting, score filters and configuration expansion.");
  command.action(async (_options, cmd: Command) => {
    const options = queryOptions(cmd, view);
    await output(cmd, context => executeQuery(context, options), options);
  });
}

const query = filters(program.command("query").description("Query price points; optionally filter benchmark configurations."))
  .addOption(new Option("--view <view>", "table | price | allowance").choices(["table", "price", "allowance"]).default("table"))
  .option("--fee-band <band>", "Allowance view only: all | 0-30 | 30-100 | 100-300", "all")
  .addOption(new Option("--config <mode>", "Table view only; requires --board").choices(["best", "all"]).default("best"))
  .option("--min-score <number>", "Table view only; requires --board", numeric())
  .option("--scored-only", "Table view only; exclude missing scores; requires --board")
  .option("--frontier", "Table view only; Pareto frontier; requires --board")
  .option("--sort <key[:direction]>", "Table view only: price | fee | allowance | score | model | plan; asc | desc", "price:asc");
query.action(async (_options, cmd: Command) => {
  const options = queryOptions(cmd, cmd.opts().view);
  await output(cmd, context => executeQuery(context, options), options);
});

const list = program.command("list").description("Discover exact model, company, channel, plan and board IDs.");
for (const resource of ["models", "companies", "channels", "plans", "boards"] as Resource[]) {
  const command = list.command(resource).description(`List ${resource} and coverage counts.`)
    .option("--search <text>", "Whole-substring match on resource ID and display name", "")
    .option("--limit <integer>", "Return at most this many resources", numeric(true, true));
  if (["models", "channels", "plans"].includes(resource)) {
    command.option("--company <id>", "Exact company ID; repeatable", collect)
      .option("--vendor <id>", "Alias of --company; values are combined", collect);
  }
  if (["models", "companies", "plans"].includes(resource)) {
    command.option("--channel <name>", "Exact access channel; repeatable", collect);
  }
  command.action(async (_options, cmd: Command) => {
    const o = cmd.opts();
    const options: ListOptions = { companies: [...(o.company ?? []), ...(o.vendor ?? [])], channels: o.channel ?? [], search: o.search, limit: o.limit };
    await output(cmd, context => executeList(context, resource, options));
  });
}
list.action(() => list.outputHelp());

program.command("show <point-id>").description("Show price, allowance, evidence and all mapped benchmark configurations.")
  .option("--board <id>", "Restrict configurations to this independent board")
  .action(async (id: string, _options, cmd: Command) => {
    await output(cmd, context => executeShow(context, id, cmd.opts().board));
  });
program.command("compare <point-ids...>").description("Compare at least two distinct price points, in input order.")
  .option("--board <id>", "Include this board's highest configuration per point")
  .action(async (ids: string[], _options, cmd: Command) => {
    if (ids.length < 2) throw new CliError("compare requires at least two distinct point IDs.");
    await output(cmd, context => executeCompare(context, ids, cmd.opts().board));
  });
program.command("info").description("Show snapshot, coverage and calculation conventions.")
  .action(async (_options, cmd: Command) => output(cmd, executeInfo));

program.addHelpText("after", `\nExamples:\n  rap price --company Anthropic\n  rap allowance --company Anthropic --fee-band 0-30\n  rap list models --search claude\n  rap query --board aa_intelligence_index --frontier --format json\n\nRun rap <command> --help for command-specific options.`);
program.action(() => program.outputHelp());

// A consumer such as head may close a pipe before all records are written.
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", error => {
    if ((error as NodeJS.ErrnoException).code === "EPIPE") process.exit(0);
    else throw error;
  });
}

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    // Commander has already emitted diagnostics; argument errors use our public exit code.
    process.exitCode = error.exitCode === 0 ? 0 : 2;
  } else {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
  }
}
