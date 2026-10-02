**English** | [中文](README.zh.md)

# Real API Pricing

AI coding subscriptions sell a monthly fee, not a per-token price. This project works out what each plan actually costs per million tokens, then plots that price against public leaderboard scores to show which plans give the most capability for the money.

**Real price = monthly fee ÷ tokens you can actually use in a month.**

**[Open the interactive site →](https://realapipricing.com)** Pick models, filter channels, compare prices and allowances. English / 中文.

![Real price vs. AA Intelligence Index, Pareto frontier](charts/en/pareto/pareto-aa-intelligence.svg)

**How to read the charts**

- Each point is one plan × the model it serves. X is the real price in USD per million tokens on a log scale, cheaper to the right. Y is that leaderboard's score.
- Filled squares are subscriptions; hollow diamonds are metered APIs at list price. Both compete on the same frontier.
- The black line is the Pareto frontier: for every point on it, no other point is both cheaper and higher-scoring.
- Subscription prices assume you use the whole allowance. Use half of it and your real price doubles.

Snapshot: <!-- stat:snapshot -->2026-10-02<!-- /stat --> · <!-- stat:points_total -->318<!-- /stat --> plan × model points · [all charts, SVG / PNG, both languages](charts/README.md)

## Query from the terminal

The TypeScript CLI reads an offline snapshot and separates model, company,
channel and plan. Requires Node.js 22.12+. Build from this repository:

```sh
npm --prefix cli ci
npm --prefix cli run build
node cli/dist/main.js price --company Anthropic
node cli/dist/main.js allowance --company Anthropic --fee-band 0-30
```

JSON/CSV exports, filtering, evidence and comparisons are available. See the
[CLI README](cli/README.md) for local package installation and the
[command reference](docs/cli-command-reference.md) for output examples.
Version 0.1.0 has not been published to npm.

For coding agents, the [Real Model Price skill](.agents/skills/real-model-price/SKILL.md)
guides price, allowance and plan comparisons with this CLI. In Codex, invoke
`$real-model-price` from a session that loads the repository's skills.

## How the numbers are made

- **Monthly allowance.** Tokens per month at saturated use. A month is four weeks unless the vendor defines its own monthly pool (Kimi's is 5× the weekly pool). Input, output and cache tokens all count.
- **Measured when possible.** The best evidence is a direct measurement: tokens used against the change in the dashboard's quota percentage, local usage logs, controlled saturation runs, or an official absolute-token table. Samples that include a token breakdown are converted to dollar worth at public list prices and then to the channel's workload tier; samples without a breakdown and official token tables use raw totals as-is and are flagged "not workload-normalized" on the site.
- **Converted when necessary.** Dollar or credit pools, and API list prices, are turned into tokens with one standard workload: 97% cache reads, 2.5% fresh input, 0.5% output. This is a comparison convention, not a claim about anyone's real usage. Anthropic models price the fresh-input share at the cache-write rate, and StepFun and Google use a low-cache variant. See [CONVENTIONS.md](CONVENTIONS.md).
- **Off-peak pricing** (GLM, DeepSeek, MiMo) is shown as separate scenario points, not averaged.
- **Confidence.** Every row is rated high, medium or low. High means a dashboard back-calculation, a controlled test or an official table. Medium means an official multiplier applied to a high-confidence anchor, or several consistent independent sources. Low means a single report or a cross-plan assumption. Derived values are never presented as measurements.
- **One plan, several models.** Each model on a plan gets its own point. Those allowances are alternatives and do not add up.
- **Scores** are copied from each leaderboard and never mixed across boards. Static charts use each model's highest archived configuration.
- **Free during a promotion.** A model that a plan temporarily doesn't meter is drawn at ≈$0 on a dedicated slot at the right edge. There are <!-- stat:points_unmetered -->1<!-- /stat --> such points at the moment: SWE-2 on Devin Pro, until 2026-10-31.

Every adopted value, its evidence and the reason for the choice: [DECISIONS.md](DECISIONS.md) and the `decision_note` column of [adopted.csv](data/adopted.csv).

## Pareto charts by leaderboard

Each leaderboard gets its own chart, with its own scores and snapshot date. A model missing from a board is left off that chart but stays in the price and allowance data.

### AA Intelligence

[SVG](charts/en/pareto/pareto-aa-intelligence.svg) · [PNG](charts/en/pareto/pareto-aa-intelligence.png) · [中文 SVG](charts/zh/pareto/帕累托_AA智力榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_AA智力榜.png) · chart shown at the top

Artificial Analysis Intelligence Index v4.3. Scores are not comparable with earlier index versions: a lower number after the version change does not mean a model got worse. Rows marked [AA estimate] are Artificial Analysis's own estimates.

### AA Coding Agent

[SVG](charts/en/pareto/pareto-aa-coding-agent.svg) · [PNG](charts/en/pareto/pareto-aa-coding-agent.png) · [中文 SVG](charts/zh/pareto/帕累托_AA编程Agent榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_AA编程Agent榜.png)

![AA Coding Agent](charts/en/pareto/pareto-aa-coding-agent.svg)

Coding Agent Index v1.5. Each score belongs to a tested harness × model × effort configuration. Higher effort doesn't change the price per token, but it can change how many tokens a task uses.

### Code Arena

[SVG](charts/en/pareto/pareto-code-arena.svg) · [PNG](charts/en/pareto/pareto-code-arena.png) · [中文 SVG](charts/zh/pareto/帕累托_CodeArena榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_CodeArena榜.png)

![Code Arena](charts/en/pareto/pareto-code-arena.svg)

The WebDev Overall Arena Score. It measures web-app building, not general coding ability.

### Agent Arena

[SVG](charts/en/pareto/pareto-agent-arena.svg) · [PNG](charts/en/pareto/pareto-agent-arena.png) · [中文 SVG](charts/zh/pareto/帕累托_AgentArena榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_AgentArena榜.png)

![Agent Arena](charts/en/pareto/pareto-agent-arena.svg)

### OpenDesign Arena

[SVG](charts/en/pareto/pareto-open-design-arena.svg) · [PNG](charts/en/pareto/pareto-open-design-arena.png) · [中文 SVG](charts/zh/pareto/帕累托_OpenDesign设计榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_OpenDesign设计榜.png)

![OpenDesign Arena](charts/en/pareto/pareto-open-design-arena.svg)

The 0–100 average task score: requirements 30 + design quality 70. OpenDesign's cost- and speed-weighted recommendation score is not used. All <!-- stat:configs_mapped_open_design_arena -->13<!-- /stat --> archived models map to adopted points.

### Terminal-Bench 4.0

[SVG](charts/en/pareto/pareto-terminal-bench-4.svg) · [PNG](charts/en/pareto/pareto-terminal-bench-4.png) · [中文 SVG](charts/zh/pareto/帕累托_TB4终端榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_TB4终端榜.png)

![Terminal-Bench 4.0](charts/en/pareto/pareto-terminal-bench-4.svg)

The official 66-task leaderboard hosted by Stanford, Harbor and the Laude Institute (snapshot 2026-09-03), with all <!-- stat:configs_terminal_bench_4 -->22<!-- /stat --> published configurations. Vendor-reported scores for models the official board doesn't list are added and labelled [self-reported], for example SWE-2 · Devin Pro at 27.3% from Cognition's launch post.

### Terminal-Bench 4.0 (AA)

[SVG](charts/en/pareto/pareto-aa-terminal-bench-4.svg) · [PNG](charts/en/pareto/pareto-aa-terminal-bench-4.png) · [中文 SVG](charts/zh/pareto/帕累托_TB4·AA榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_TB4·AA榜.png)

![Terminal-Bench 4.0 (AA)](charts/en/pareto/pareto-aa-terminal-bench-4.svg)

The same 66 tasks run by Artificial Analysis on its own harness (snapshot 2026-09-23). The two Terminal-Bench boards are not interchangeable. On matched configurations the median gap is about 2.6 points, but it can be much larger: Grok 4.7 xhigh scores 37.58 on the official board and 25.76 here.

### DeepSWE v1.1

[SVG](charts/en/pareto/pareto-deepswe-1-1.svg) · [PNG](charts/en/pareto/pareto-deepswe-1-1.png) · [中文 SVG](charts/zh/pareto/帕累托_DeepSWE榜.svg) · [中文 PNG](charts/zh/pareto/帕累托_DeepSWE榜.png)

![DeepSWE v1.1](charts/en/pareto/pareto-deepswe-1-1.svg)

Pass@1 on 113 tasks, official rows run on mini-swe-agent (snapshot 2026-09-03). Vendor-reported scores are added as supplements and labelled [self-reported].

## Real price and monthly allowance, all plans

### Real price

All <!-- stat:points_priced -->317<!-- /stat --> priced subscription and API points on one $/MTok scale.

[SVG](charts/en/overview/real-price-overview.svg) · [PNG](charts/en/overview/real-price-overview.png) · [Table](charts/en/overview/real-price-overview-table.txt) · [中文 SVG](charts/zh/overview/单价总览.svg) · [中文 PNG](charts/zh/overview/单价总览.png) · [中文表](charts/zh/overview/单价总览表.txt)

![Real price overview](charts/en/overview/real-price-overview.svg)

### Monthly allowance

The <!-- stat:points_allowance -->298<!-- /stat --> subscription points with a monthly allowance, split into three bands by monthly fee in USD. Each band is ranked on its own. The undivided chart and a hybrid-scale view are in the [chart index](charts/README.md).

**$0–30** · [SVG](charts/en/overview/monthly-allowance-overview-fee-0-30-usd.svg) · [PNG](charts/en/overview/monthly-allowance-overview-fee-0-30-usd.png) · [Table](charts/en/overview/monthly-allowance-overview-fee-0-30-usd-table.txt) · [中文 SVG](charts/zh/overview/额度总览_月费0-30美元.svg) · [中文 PNG](charts/zh/overview/额度总览_月费0-30美元.png) · [中文表](charts/zh/overview/额度总览表_月费0-30美元.txt)

![Monthly allowance, $0–30](charts/en/overview/monthly-allowance-overview-fee-0-30-usd.svg)

**Over $30, up to $100** · [SVG](charts/en/overview/monthly-allowance-overview-fee-30-100-usd.svg) · [PNG](charts/en/overview/monthly-allowance-overview-fee-30-100-usd.png) · [Table](charts/en/overview/monthly-allowance-overview-fee-30-100-usd-table.txt) · [中文 SVG](charts/zh/overview/额度总览_月费30-100美元.svg) · [中文 PNG](charts/zh/overview/额度总览_月费30-100美元.png) · [中文表](charts/zh/overview/额度总览表_月费30-100美元.txt)

![Monthly allowance, over $30 up to $100](charts/en/overview/monthly-allowance-overview-fee-30-100-usd.svg)

**Over $100, up to $300** · [SVG](charts/en/overview/monthly-allowance-overview-fee-100-300-usd.svg) · [PNG](charts/en/overview/monthly-allowance-overview-fee-100-300-usd.png) · [Table](charts/en/overview/monthly-allowance-overview-fee-100-300-usd-table.txt) · [中文 SVG](charts/zh/overview/额度总览_月费100-300美元.svg) · [中文 PNG](charts/zh/overview/额度总览_月费100-300美元.png) · [中文表](charts/zh/overview/额度总览表_月费100-300美元.txt)

![Monthly allowance, over $100 up to $300](charts/en/overview/monthly-allowance-overview-fee-100-300-usd.svg)

Chinese charts count tokens in 亿 (100 million): 77.37 亿 = 7.737 billion.

## Data

| Points | Count |
|---|---:|
| All plan × model points | <!-- stat:points_total -->318<!-- /stat --> |
| Subscriptions with a monthly allowance | <!-- stat:points_allowance -->298<!-- /stat --> |
| Free during a promotion (≈$0) | <!-- stat:points_unmetered -->1<!-- /stat --> |
| Metered APIs at list price | <!-- stat:points_metered -->19<!-- /stat --> |

| Leaderboard | Scored points |
|---|---:|
| AA Intelligence | <!-- stat:scored_aa_intelligence_index -->268<!-- /stat --> |
| AA Coding Agent | <!-- stat:scored_aa_coding_agent_index -->97<!-- /stat --> |
| Code Arena | <!-- stat:scored_arena_code -->178<!-- /stat --> |
| Agent Arena | <!-- stat:scored_arena_agent_mode -->164<!-- /stat --> |
| OpenDesign Arena | <!-- stat:scored_open_design_arena -->88<!-- /stat --> |
| Terminal-Bench 4.0 | <!-- stat:scored_terminal_bench_4 -->111<!-- /stat --> |
| Terminal-Bench 4.0 (AA) | <!-- stat:scored_aa_terminal_bench_4 -->36<!-- /stat --> |
| DeepSWE v1.1 | <!-- stat:scored_deepswe_1_1 -->195<!-- /stat --> |

The largest plan families are Command Code GOAT (<!-- stat:plans_command_code_goat -->58<!-- /stat --> points), MiMo Token Plan (<!-- stat:plans_mimo_token -->32<!-- /stat -->), OpenCode Go (<!-- stat:plans_opencode_go -->28<!-- /stat -->), Droid Max (<!-- stat:plans_droid_max -->27<!-- /stat -->), Ollama (<!-- stat:plans_ollama -->22<!-- /stat -->) and Step Plan (<!-- stat:plans_step_plan -->12<!-- /stat -->).

**Downloads:** [adopted values (CSV)](data/adopted.csv) · [computed points (CSV)](derived/points.csv) / [JSON](derived/points.json) · [data notes](data/README.md) · [dated evidence](data/research/)

**Every benchmark configuration**, not just the highest per model: the [configuration archive](derived/benchmark-configurations.json) ([CSV](derived/benchmark-configurations.csv)) keeps all <!-- stat:configs_total -->330<!-- /stat --> records with their original labels, harness, effort, score intervals and task costs. The [plan-to-configuration mappings](derived/benchmark-points.json) ([CSV](derived/benchmark-points.csv)) hold <!-- stat:refs_total -->1854<!-- /stat --> explicit references. Unknown harnesses, efforts and intervals stay empty instead of being guessed. The [all-configuration interactive chart](charts/zh/pareto/帕累托交互图.html) (Chinese; download and open locally, needs network access for Plotly) lets you switch between configurations and effort levels.

## Known limitations

- Real prices are lower bounds. They assume the full allowance is used.
- Benchmark scores are references for a harness × model × effort configuration. They are not tests of each subscription channel, and whether a quota measurement used the same effort and harness is unverified.
- Score intervals are kept (visible on hover in the interactive views) but don't yet affect which points are on the frontier. Confidence labels are qualitative, not error bars.
- Source task costs are kept as separate fields. They are not the cost of the same task on a subscription.
- Tokenizer differences between vendors are not corrected.
- Promotional ≈$0 points have to be re-checked when the promotion ends.

## Reproduce, contribute, credit

- Rebuild everything: [BUILD.md](BUILD.md). Rules and conversions: [CONVENTIONS.md](CONVENTIONS.md). Why each value was chosen: [DECISIONS.md](DECISIONS.md).
- Have a usage measurement of your own (tokens used vs. quota percentage)? [Open a data issue](https://github.com/FeiZhuLulu/real-api-pricing/issues/new?template=contribute-data.md).
- Original software is [MIT](LICENSE). Data references include [Awesome Coding Plan](https://github.com/mahonzhan/awesome-coding-plan) (CC BY 4.0) and the Caijing article 《Token经济，中国账本》. Attribution, changes and third-party terms: [SOURCES.md](SOURCES.md). Redaction scope of this public edition: [PUBLICATION.md](PUBLICATION.md).
