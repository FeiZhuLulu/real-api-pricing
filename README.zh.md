[English](README.md) | **中文**

# 真实 API 定价

**真实单价 = 订阅月费 ÷ 每月实际可用 token。**

先展示完整采用数据，再按榜单展示帕累托图。按饱和使用、每月四周计算，输入、输出与缓存 token 全部计入；单价使用对数轴，越右越便宜。

**[全部图表：中英文、SVG / PNG](charts/README.md)** · [English files](charts/en/) · [中文文件](charts/zh/)

## 数据快照

快照日期：2026-09-06。每行代表一个**套餐 × 实际服务模型**；同一套餐下不同模型的额度是替代关系，不能相加。

| 覆盖范围 | 行数 |
|---|---:|
| 全部采用的套餐 × 模型点 | 97 |
| 有月额度的订阅点 | 91 |
| 按量 API 基准点 | 6 |
| OpenCode Go 模型 | 28 / 28 |
| Code Arena / Agent Arena 有分点 | 74 / 77 |
| AA 智力榜 / AA 编程 Agent 榜有分点 | 73 / 42 |

**下载数据：** [采用值 CSV](data/adopted.csv) · [完整计算结果 CSV](derived/points.csv) · [完整计算结果 JSON](derived/points.json) · [数据说明及缺分清单](data/README.md) · [分日期原始证据](data/research/)

## 月额度总览

展示全部 91 个订阅套餐 × 模型点，按每月可用 token 排序。标准图统一使用对数轴；混合比例图用于看清两个特别大的 ChatGPT 额度。

[English SVG](charts/en/overview/monthly-allowance-overview.svg) · [中文 SVG](charts/zh/overview/额度总览.svg) · [English PNG](charts/en/overview/monthly-allowance-overview.png) · [中文 PNG](charts/zh/overview/额度总览.png) · [混合比例图](charts/zh/overview/额度总览_混合比例.svg)

![月额度总览](charts/zh/overview/额度总览.svg)

**完整数据表：** [中文 TXT](charts/zh/overview/额度总览表.txt) · [English TXT](charts/en/overview/monthly-allowance-overview-table.txt)

## 真实单价总览

把全部 97 个订阅和 API 点放在同一套 $/MTok 口径下比较。

[English SVG](charts/en/overview/real-price-overview.svg) · [中文 SVG](charts/zh/overview/单价总览.svg) · [English PNG](charts/en/overview/real-price-overview.png) · [中文 PNG](charts/zh/overview/单价总览.png)

![真实单价总览](charts/zh/overview/单价总览.svg)

**完整数据表：** [中文 TXT](charts/zh/overview/单价总览表.txt) · [English TXT](charts/en/overview/real-price-overview-table.txt)

## 分榜帕累托图

某模型在某张榜没有分数时，仍保留在上面的额度和单价数据中，但不会编造分数塞入该榜帕累托图。不同榜单不混分；API 点作为基线，连线为订阅前沿。

### Code Arena

[English SVG](charts/en/pareto/pareto-code-arena.svg) · [中文 SVG](charts/zh/pareto/帕累托_CodeArena榜.svg) · [English PNG](charts/en/pareto/pareto-code-arena.png) · [中文 PNG](charts/zh/pareto/帕累托_CodeArena榜.png)

![Code Arena](charts/zh/pareto/帕累托_CodeArena榜.svg)

### Agent Arena

[English SVG](charts/en/pareto/pareto-agent-arena.svg) · [中文 SVG](charts/zh/pareto/帕累托_AgentArena榜.svg) · [English PNG](charts/en/pareto/pareto-agent-arena.png) · [中文 PNG](charts/zh/pareto/帕累托_AgentArena榜.png)

![Agent Arena](charts/zh/pareto/帕累托_AgentArena榜.svg)

### AA Intelligence

[English SVG](charts/en/pareto/pareto-aa-intelligence.svg) · [中文 SVG](charts/zh/pareto/帕累托_AA智力榜.svg) · [English PNG](charts/en/pareto/pareto-aa-intelligence.png) · [中文 PNG](charts/zh/pareto/帕累托_AA智力榜.png)

![AA Intelligence](charts/zh/pareto/帕累托_AA智力榜.svg)

### AA Coding Agent

[English SVG](charts/en/pareto/pareto-aa-coding-agent.svg) · [中文 SVG](charts/zh/pareto/帕累托_AA编程Agent榜.svg) · [English PNG](charts/en/pareto/pareto-aa-coding-agent.png) · [中文 PNG](charts/zh/pareto/帕累托_AA编程Agent榜.png)

![AA Coding Agent](charts/zh/pareto/帕累托_AA编程Agent榜.svg)

AA 编程 Agent 分数属于已测试的框架 × 模型配置，同一精确模型取已存档最高分。

## 口径与复现

[构建说明](BUILD.md) · [数据文档](data/README.md) · [来源与署名](SOURCES.md)

## 许可与致谢

原创代码采用 [MIT](LICENSE)。数据参考 [Awesome Coding Plan](https://github.com/mahonzhan/awesome-coding-plan)（CC BY 4.0）及《财经》的《Token经济，中国账本》等。署名、改动和第三方许可见 [SOURCES.md](SOURCES.md)。
