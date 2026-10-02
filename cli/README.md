# Real API Pricing CLI

`rap` queries model prices, monthly allowances, plans and independent benchmark
boards from a local snapshot. Model, company, access channel and plan appear in
separate columns. This TypeScript CLI uses Commander, cli-table3, csv-stringify
and Zod, with string-width and wrap-ansi for display-width-aware wrapping that
preserves CJK text. Version 0.1.0 is available from this repository; it has
**not been published to npm**.

## Build and run

Requires Node.js 22.12 or newer. From the repository root:

```sh
npm --prefix cli ci
npm --prefix cli run build
node cli/dist/main.js price --company Anthropic --limit 5
node cli/dist/main.js allowance --company Anthropic --fee-band 0-30
```

Only the CLI's dependencies are required. The build reads the committed
`data/adopted.csv`, `derived/*.json`, conventions and channel configuration;
it does not require Python, a website server or `web/node_modules`.

To create and install a local package:

```sh
cd cli
npm pack
npm install -g /absolute/path/to/fullstop000-real-api-pricing-cli-0.1.0.tgz
rap --version
rap info
```

Use the absolute path of the tarball that `npm pack` prints. Packing runs
typechecking and rebuilds the executable and bundled snapshot. The installed
CLI can run from any working directory.

## Commands

```sh
# Website-equivalent price and allowance rankings.
rap price --company Anthropic
rap allowance --company Anthropic --fee-band 0-30

# Discover exact IDs.
rap list models --company Anthropic
rap list companies
rap list channels
rap list plans --channel Factory
rap list boards

# Filter and export. Repeat a flag to OR values in one dimension.
rap query --company Anthropic --channel Factory --sort price:asc
rap price --company Anthropic --model claude-opus-5.5 --format json
rap allowance --max-fee 30 --format csv > allowance.csv

# Evidence, configuration details and comparisons.
rap show 'droid_max::claude-opus-5.5'
rap compare 'claude_max_20x::claude-opus-5.5' \
  'droid_max::claude-opus-5.5' --board aa_intelligence_index
rap query --board aa_intelligence_index --frontier --format json

rap info
rap --help
rap query --help
```

Price ranks by USD/MTok ascending, including metered APIs and points without
benchmark scores. Allowance ranks subscriptions with a known monthly token
allowance descending. Fee bands are `[0,30]`, `(30,100]` and `(100,300]` USD;
`all` also includes higher fees. Custom sorting, configuration expansion and
score/frontier filters use `query --view table`.

`--company` accepts the original company IDs shown by `rap list companies`.
`--vendor` is its alias. For example, `Muse` displays as `Meta` and `Cognition`
displays as `Devin`; use the original ID to filter. A third-party channel such
as Factory is selected with `--channel Factory`. Exact model and plan IDs are
separate filters. A price point ID is `plan_id::model`.

Output text is English; source evidence retains its original language. There
is no language flag. Table and CSV metadata goes to stderr, keeping stdout
available for piping. JSON includes metadata, warnings and typed values in a
`schemaVersion: 1` envelope. Empty queries succeed with exit 0, argument errors
use exit 2, and unreadable or invalid snapshots use exit 1.

Tables use the website's English display conventions: dollar amounts such as
`$200`, original CNY fees in the same cell, `Subscription` / `Metered API`,
`High` / `Medium` / `Low`, and `—` for missing monthly fees or allowances.
Rankings and table queries use compact prices; details and comparisons use up
to six significant digits. Query scores use up to two decimal places, while
detail scores use up to four. Effort labels display as `Max`, `High`, etc.
Promotional unmetered notes appear below their record. JSON and CSV retain the
original numeric precision, enum IDs and null handling.

CLI CSV keeps the selected command's ordering. The website's ranking-view
“Table · CSV” download uses detail-table ordering, so its allowance download
also sorts by price, and its fixed column schema differs. CSV validation
matches shared raw fields by Point ID, with the same board selected when
comparing benchmark references; it does not require byte-identical files.

## Local data

The package includes `data/site.json`, generated from the same shared adapter
as the website. Queries read this file offline and do not automatically fetch
updates. `rap info` reports its snapshot date. To use another local snapshot:

```sh
rap info --data /absolute/path/to/site.json
rap price --data ./site.json --company Anthropic
```

Website parity was verified using the 2026-10-01 snapshot and live website file.
Chromium DOM comparisons covered 61 scenarios and 5,176 rows across all
18 companies, fee bands, channels, searches and benchmark configurations.
Records, ordering and shared display fields had no differences; page,
console and resource errors were all zero.

After integrating the latest upstream data, the rebuilt 2026-10-02 CLI and
website snapshots match the upstream builder byte for byte. The shared adapter
preserves translated source metadata and benchmark archive/record details;
JSON retains these fields alongside the original source text. Use `rap info`
for the date of the dataset actually being queried.

`--data` resolves relative paths against the calling directory. Invalid data
versions, missing fields, nonfinite numbers, duplicate IDs and orphaned
references are rejected. Evidence links are preserved; `/data/evidence/...`
is a website-relative path, and the CLI package does not bundle those archives.

Subscription prices assume full use of the adopted allowance. Different
models in one plan are alternatives, and their allowances do not add up.
Benchmark scores belong to independent public configurations; they are not
measurements of every subscription channel.

## Agent skill

The repository includes [Real Model Price](../.agents/skills/real-model-price/SKILL.md),
a Codex skill named `real-model-price` for querying prices, allowances and plans
with this CLI. Its repository location is `.agents/skills/real-model-price/`.
In a Codex session that loads this checkout's skills, invoke it with, for example:

```text
Use $real-model-price to compare Anthropic and Factory prices under $30/month.
```

The skill checks the snapshot, discovers IDs and reads JSON before presenting
comparisons. It preserves the distinction between developer, channel and plan,
and includes the dataset's quota assumptions and evidence.

## Development

From the repository root:

```sh
npm --prefix cli run typecheck
npm --prefix cli test
```

See [command outputs](../docs/cli-command-reference.md) and
[the CLI contract](../docs/cli-design.md) in the repository for full option,
JSON and CSV specifications.
