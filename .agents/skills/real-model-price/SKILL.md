---
name: real-model-price
description: Query and compare AI model prices, subscription plans, monthly token allowances, and metered APIs using the Real API Pricing CLI (rap). Use for cheapest-model questions, token budgets, company/channel/plan comparisons, and pricing evidence; for example, comparing Claude subscriptions with Factory or finding the largest allowance under $30 per month.
---

# Real Model Price

Use `rap` to answer pricing and allowance questions from the project's adopted
data. Query the existing dataset; use its prices, units, confidence and evidence.

## Prepare the CLI

Use an installed `rap` if `rap --help` identifies it as the Real API Pricing CLI.
Otherwise, work from this repository's root and replace `rap` in the examples
with `node cli/dist/main.js`. Requires Node.js 22.12 or newer.

If the executable is missing, build it from the checkout:

```sh
npm --prefix cli ci
npm --prefix cli run build
node cli/dist/main.js --help
```

The npm package has not been published. Follow the repository's
[CLI README](../../../cli/README.md) for building or installing a local tarball.
Querying needs no website server, API key or network connection.

## Query workflow

1. Run `rap info --format json`. Record the actual snapshot date, source and
   conventions. The default dataset is bundled locally and does not refresh
   automatically. If the user supplies a local snapshot, pass
   `--data /absolute/path/to/site.json` to every command, including `info`.
2. Discover exact identifiers with `list`. Keep model, company, channel and
   plan separate. A price point identifies a plan serving one model:
   `plan_id::model`. Use point IDs returned by queries for `show` and `compare`.
3. Choose `price` for the lowest USD per million tokens, `allowance` for the
   largest monthly token quota, or `query --view table` for custom ordering
   and optional benchmark/configuration filters. Apply the user's budget and
   company/channel/model/plan constraints before selecting results.
4. Use `--format json` for analysis. Parse the `schemaVersion`, `meta`, and
   `rows` envelope; inspect `meta.warnings`, `meta.total` and `meta.truncated`.
   `--limit` returns only the first matching rows, not the full dataset.
5. Inspect promising points with `show`, then use `compare` for at least two
   distinct point IDs. Check quota confidence, workload, data date, adoption
   notes and promotion qualifiers before recommending a plan.
6. Reply in the user's language. Include the snapshot date and scope, and
   report Model, Company, Channel, Plan, USD/MTok, monthly tokens, monthly fee
   and confidence as separate fields. Cite point IDs and relevant evidence;
   distinguish adopted values from your own calculations.

## Commands

```sh
# Inspect the dataset and discover IDs.
rap info --format json
rap list companies --format json
rap list models --company Anthropic --format json
rap list channels --company Anthropic --format json
rap list plans --channel Factory --format json
rap list boards --format json

# Price ranks ascending; monthly allowance ranks descending.
rap price --company Anthropic --limit 5 --format json
rap allowance --company Anthropic --fee-band 0-30 --format json
rap allowance --max-fee 30 --format json

# Restrict the served model and access channel independently.
rap query --company Anthropic --channel Factory --model claude-opus-5.5 --format json

# Inspect and compare point IDs discovered above.
rap show 'droid_max::claude-opus-5.5' --format json
rap compare 'claude_max_20x::claude-opus-5.5' 'droid_max::claude-opus-5.5' --format json

# Optional: compare prices against one independent capability board.
rap query --view table --board aa_intelligence_index --frontier --format json

# CSV goes to stdout; result diagnostics go to stderr.
rap allowance --max-fee 30 --format csv > allowance.csv
```

Examples use IDs from the bundled snapshot; discover them again when using a
different dataset. For available flags, run `rap <command> --help`. Full command
outputs and schema details are in the [command reference](../../../docs/cli-command-reference.md)
and [CLI contract](../../../docs/cli-design.md).

## Filters and interpretation

- `--company` identifies the model developer; `--vendor` is its alias.
  `--company Anthropic` includes third-party access channels. Use
  `--channel Anthropic` to require the developer's own channel, or
  `--channel Factory` to require Factory. Obtain company IDs from `list companies`:
  `Muse` displays as Meta and `Cognition` as Devin.
- `--model` and `--plan` accept exact IDs. Repeating a flag combines values
  with OR; different filter dimensions combine with AND. `--search` matches
  the entire trimmed substring, not separate words.
- `price` includes metered APIs, points without benchmark scores and qualifying
  unmetered promotions. `allowance` includes only subscriptions with a known
  monthly quota. Missing fees or quotas are `null`, not zero or infinite.
- Allowance fee bands are `[0,30]`, `(30,100]` and `(100,300]` USD/month.
  `--fee-band all` also includes fees above $300. Use `--min-fee`/`--max-fee`
  for an arbitrary budget; both bounds are inclusive.
- Subscription USD/MTok assumes full use of the adopted quota. Different
  model quotas within the same plan are alternatives; never add them together.
  Preserve workload assumptions when comparing plans. An expiring unmetered
  promotion is not permanent free access; report its expiry and monthly fee.
- Benchmarks are independent configuration references, not measurements of
  each subscription or API channel. Select the same `--board` when comparing
  capability; do not merge scores across boards. `--harness`, `--effort` and
  `--mode` require a board. Custom sort, score/frontier filters and
  `--config all` belong to `query --view table`.
- JSON/CSV retain raw numeric precision, enum IDs and nulls. Analyze those
  values rather than reverse-parsing rounded terminal tables. CLI CSV retains
  the command's ordering and documented columns; the website's CSV uses its
  table ordering and a different schema.
- CLI display text is English and there is no `--lang` flag. Original evidence
  text retains its language. Evidence paths such as `/data/evidence/...` are
  website-relative and their archives are not bundled with the CLI. Resolve
  those links against `https://realapipricing.com` if source inspection is needed.
- Empty queries succeed with exit 0 and empty `rows`; report no match rather
  than inventing a result. Exit 2 indicates invalid arguments; inspect help
  and correct the query. Exit 1 indicates an unreadable/invalid dataset;
  report that error instead of substituting prices.

Describe bundled results as prices in the reported snapshot. For requests
about today's prices, make the snapshot date explicit and obtain current
evidence before claiming live verification; do not silently replace adopted
values or edit the project's data during a query.
