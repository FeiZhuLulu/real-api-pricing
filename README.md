**English** | [中文](README.zh.md)

# Real API Pricing

**Real unit price = monthly subscription fee ÷ monthly usable tokens.**

Full adopted data is shown first, followed by one Pareto chart per leaderboard. Month = four weeks of saturated use; input, output and cache tokens are all included. Prices use a logarithmic axis, with cheaper points farther right.

**[All charts: English / 中文, SVG / PNG](charts/README.md)** · [English files](charts/en/) · [中文文件](charts/zh/)

## Data snapshot

Snapshot: 2026-09-06. Each row is one **plan × actual served model**; allowances of different models under the same plan are alternatives and must not be added together.

| Coverage | Rows |
|---|---:|
| All adopted plan × model points | 97 |
| Subscription points with monthly allowance | 91 |
| Metered API baselines | 6 |
| OpenCode Go models | 28 / 28 |
| Code Arena / Agent Arena scored points | 74 / 77 |
| AA Intelligence / AA Coding Agent scored points | 73 / 42 |

**Download the data:** [adopted values (CSV)](data/adopted.csv) · [computed points (CSV)](derived/points.csv) · [computed points (JSON)](derived/points.json) · [data notes and score coverage](data/README.md) · [dated evidence](data/research/)

## Monthly allowance overview

All 91 subscription plan × model points, sorted by monthly usable tokens. The standard chart keeps a single logarithmic scale; the hybrid-scale view makes the two very large ChatGPT allowances easier to compare.

[English SVG](charts/en/overview/monthly-allowance-overview.svg) · [中文 SVG](charts/zh/overview/额度总览.svg) · [English PNG](charts/en/overview/monthly-allowance-overview.png) · [中文 PNG](charts/zh/overview/额度总览.png) · [Hybrid-scale view](charts/en/overview/monthly-allowance-overview-hybrid-scale.svg)

![Monthly allowance overview](charts/en/overview/monthly-allowance-overview.svg)

**Full table:** [English TXT](charts/en/overview/monthly-allowance-overview-table.txt) · [中文 TXT](charts/zh/overview/额度总览表.txt)

## Real unit price overview

All 97 subscription and API points on one comparable $/MTok scale.

[English SVG](charts/en/overview/real-price-overview.svg) · [中文 SVG](charts/zh/overview/单价总览.svg) · [English PNG](charts/en/overview/real-price-overview.png) · [中文 PNG](charts/zh/overview/单价总览.png)

![Real unit price overview](charts/en/overview/real-price-overview.svg)

**Full table:** [English TXT](charts/en/overview/real-price-overview-table.txt) · [中文 TXT](charts/zh/overview/单价总览表.txt)

## Pareto charts by leaderboard

Models without a score on a particular leaderboard remain in the allowance and price data above, but are not fabricated into that leaderboard's Pareto chart. Scores are never mixed across boards; API points are baselines and the connected line is the subscription frontier.

### Code Arena

[English SVG](charts/en/pareto/pareto-code-arena.svg) · [中文 SVG](charts/zh/pareto/帕累托_CodeArena榜.svg) · [English PNG](charts/en/pareto/pareto-code-arena.png) · [中文 PNG](charts/zh/pareto/帕累托_CodeArena榜.png)

![Code Arena](charts/en/pareto/pareto-code-arena.svg)

### Agent Arena

[English SVG](charts/en/pareto/pareto-agent-arena.svg) · [中文 SVG](charts/zh/pareto/帕累托_AgentArena榜.svg) · [English PNG](charts/en/pareto/pareto-agent-arena.png) · [中文 PNG](charts/zh/pareto/帕累托_AgentArena榜.png)

![Agent Arena](charts/en/pareto/pareto-agent-arena.svg)

### AA Intelligence

[English SVG](charts/en/pareto/pareto-aa-intelligence.svg) · [中文 SVG](charts/zh/pareto/帕累托_AA智力榜.svg) · [English PNG](charts/en/pareto/pareto-aa-intelligence.png) · [中文 PNG](charts/zh/pareto/帕累托_AA智力榜.png)

![AA Intelligence](charts/en/pareto/pareto-aa-intelligence.svg)

### AA Coding Agent

[English SVG](charts/en/pareto/pareto-aa-coding-agent.svg) · [中文 SVG](charts/zh/pareto/帕累托_AA编程Agent榜.svg) · [English PNG](charts/en/pareto/pareto-aa-coding-agent.png) · [中文 PNG](charts/zh/pareto/帕累托_AA编程Agent榜.png)

![AA Coding Agent](charts/en/pareto/pareto-aa-coding-agent.svg)

AA Coding Agent scores describe tested harness × model configurations, with the highest archived configuration used per exact model.

## Method and reproduction

[Build instructions](BUILD.md) · [Data documentation](data/README.md) · [Sources and attribution](SOURCES.md)

## License and acknowledgements

Original software: [MIT](LICENSE). Data references include [Awesome Coding Plan](https://github.com/mahonzhan/awesome-coding-plan) (CC BY 4.0) and the Caijing article 《Token经济，中国账本》. See [SOURCES.md](SOURCES.md) for attribution, changes and third-party terms.
