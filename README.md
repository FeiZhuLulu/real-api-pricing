**English** | [中文](README.zh.md)

# Real API Pricing

**Real unit price = subscription price / token allowance.**

Compare what you pay for an AI plan with the tokens you actually get, then plot that price against public leaderboard scores.

Each point is a `(plan, served model)` pair. Pay-as-you-go APIs are included only as a baseline.

## Pareto frontier

X = real unit price (log scale, cheaper to the right). Y = leaderboard score. One chart per board.

![Pareto frontier · Arena](out/帕累托_Arena榜.svg)

![Pareto frontier · Artificial Analysis](out/帕累托_AA榜.svg)

Interactive: [out/帕累托交互图.html](out/帕累托交互图.html)

## Price and allowance

![Real unit price](out/单价总览.svg)

![Monthly token allowance](out/额度总览_混合比例.svg)
