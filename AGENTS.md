# AGENTS.md · 真实 API 定价

本文件约束在这个项目里工作的所有 Agent（Devin、Cursor、Grok worker 等）。README.md 讲口径和文件；这里讲怎么干活、什么不能碰。

## 项目是什么

一篇文章 + 一组图：**真实单价 = 订阅月费 ÷ 用户每月实际可用 token**，以此为 X 轴，复用外部榜单分数为 Y 轴，画帕累托前沿。核心资产是 X 轴数据的可信度；Y 轴只是转载。

## 数据分层，只能单向流动

```
data/research/*.json      原始证据（联网搜集、用户截图反推、外部文章）—— 只追加，不改历史文件
        ↓ 人工取舍，写在脚本里
scripts/build_adopted.py  每条采用值 + 理由 + 置信度 → data/adopted.csv
        ↓
scripts/compute.py        × 榜单分数 × 标价 → derived/points.*
        ↓
scripts/plot_static.py / build_html.py → out/
```

- **adopted.csv 是生成物，不许手改**。改数只能改 `build_adopted.py`，并在 `decision_note` 里写为什么、旧值是什么、哪些来源没采。
- `data/research/` 里的文件是证据存档：新一轮搜集写新文件（`*-roundN-*.json`），不覆盖旧文件；同一项有互相矛盾的来源时**全部记录**，不自行择一。
- `data/subscription-quotas*.json`、`data/subscriptions.json` 是 Cursor 早期从 SubPlan 抽的多源原料，已被 adopted 取代，只读不删。
- 每个数字必须能追到 URL 或用户原话。找不到就写 notFound，**不许编数、不许用记忆里的旧价格**（系统日期是 2026 年，训练知识里的价格全过期）。

## 口径红线（读者会拿这些挑刺）

1. token 全口径：输入 + 缓存读 + 缓存写 + 输出一视同仁，用工具上报的 total。缓存不用单独建模，它已经在实测分布里。
2. 饱和使用、月 = 4 周。这是"用满时的价格下限"，文章里要明说。
3. 每个点 = (订阅套餐, **实际服务模型**)。Y 轴按实际服务模型查分；Claude Pro 测的是 Opus 4.8 就写 Opus 4.8，不写 Opus 5。
4. **两种"美元额度"不能混**：
   - 按公开标价记的（Cursor 池、Reddit / linux.do 的 "API 等效"）→ 用标价 × 实测 agent 负载分布（缓存读 97.5% / 输入 2.2% / 输出 0.35%，来自 `data/kimi-local.json`）折成 token。
   - 厂商面板自己的额度美元（xAI Settings→Usage 的 $25/$100/$250 周额度）**≠ 标价美元**。用同厂商某一档的实测 token 标定汇率（Super 1.27 亿/周 ÷ $25），再套到其他档。曾经用标价去折面板美元得出"周 12 亿不可能"，是错的。
5. 面板截图里"某行 token 数 + 占额度 %"是金标准（Cursor Ultra：grok-4.6-xhigh 61.0M = 0.9% → 全池 67.8 亿）。反推时记得 % 的取整区间。
6. 官方"5x / 20x"倍率各家含义不同：Claude 是 per-session（5h 窗）倍率；按用户最新确认，Max 20x 周池仅为 5x 的约2×，不是4×；旧Reddit 2.25×仅保留为历史证据不再采用。Google 是 token worth；Cursor 是 Agent limits。不要拿倍率直接乘。
7. 同一套餐推其他模型：按官方 credits 比（OpenAI）或标价混合价比（Cursor、Anthropic Sonnet/Opus）推算，标 medium/low。Anthropic Fable 例外：订阅内权重是 Opus 的 4–6.5×（不是标价的 2×），且限周额度 50%。
8. 分词器差异、利用率 <100% 这类二阶修正**不做**，脚注一句即可。

## 证据等级（写 confidence 时用）

| 级别 | 是什么 |
|---|---|
| high | 用户面板截图反推、受控打满实测（V2EX 1%→100%）、官方绝对 token/积分表 |
| medium | ccusage + 用户口述 %、官方倍率 × 一个 high 基准、多个独立中等来源同量级 |
| low | 单一口述、第三方综述、跨区域/跨档位假设同额度 |

用户亲口确认的数字优先级最高，但如果多个独立来源都指向别的值，**要把矛盾摆出来让用户拍板**，不要默默采用户的，也不要默默改掉用户的。

## 联网搜集怎么派

- 用 Agent Bridge 派 Grok（`dispatch_task`，`cwd` = 本项目绝对路径），不要自己直接跑 grok CLI。
- 任务消息必须自包含：告诉它先读哪几个已有 research 文件避免重复、要什么证据等级、输出到哪个新文件、结构长什么样、不许改 `data/` 下已有文件。
- 三轮下来没拿到面板级证据的项（Claude Max、SuperGrok Plus）再搜边际收益很低，除非换了搜法或用户给了新线索。
- worker 完成后核对 `files_changed` 时间戳，确认它没碰 `data/adopted.csv`、`scripts/`。

## 重跑与环境

```
python scripts/build_adopted.py && python scripts/compute.py && python scripts/plot_static.py && python scripts/build_html.py
```

- Windows 控制台打中文要设 `PYTHONIOENCODING=utf-8`，否则乱码看不出数对不对。
- PowerShell 里 `$` 会被吞，含美元符号的 Python 单行别用 `-c`，写成脚本文件跑。
- 依赖：matplotlib、adjustText；字体 Microsoft YaHei。HTML 用 Plotly CDN，单文件可直接开。
- 交互图预览：`python -m http.server 8765 --directory out`。
- 改了 `build_html.py` 后用 `node --check` 抽出的 `<script>` 验一下语法。
- 输出文件一律中文命名（用户要求）：总览 `out/{额度,单价}总览{,_英文}.png/.svg` + `{额度,单价}总览表{,_英文}.txt`；前沿 `out/前沿{额度,单价}_{Arena榜,AA榜}{,_英文}.*`；帕累托 `out/帕累托_{Arena榜,AA榜}{,_全量}.png/.svg`、`帕累托交互图.html`、`前沿筛选结果.json`。命名逻辑在 `plot_quotas.output_stem()` 和两处 `BOARD_CN`，新增榜单要同时补这两张表。
- 额度/单价总览：`python scripts/plot_quotas.py` 生成上述总览图表；无后缀为中文。保持双栏对数轴排版，不分量级面板；额度图右界只留约40%余量，让Luna超大额度明显拉长。检查标签和连续编号；中文额度用亿，英文用 billion（中文数值 ÷ 10），API 仅参与单价排序。
- 同脚本新增按榜前沿精简版（图 + 表 + 筛选结果 JSON）。从全量付费订阅/API中按单价越低、分数越高筛选，至少一项严格更好才构成支配；无分模型排除，同价同分的不同套餐在条形表中均保留。额度版展示同一前沿集合的额度，不按额度筛选；分榜、不混分，数据更新后先跑compute.py。

## 图的规矩

- X 对数轴、右侧更便宜（和 Arena 一致）。先画**所有**点，再对右上包络连前沿；非前沿点淡色。
- 前沿线两端延伸：**最高分点向左（更贵一侧）水平延伸，最便宜点向右延伸**。`pareto()` 返回的是按价格升序（便宜→贵）的列表，接边框时别接反——接反会画出"$0.001 买到最高分"的假线。改完图必须肉眼看一遍成品再交。
- 精选图（`chart_tier=main`）给文章用，全量图（`_full`）给校对用；哪些进精选在 `build_adopted.py` 的 `MAIN_PLANS` 里。
- 同位置的点合并成一个，标签用 `/` 连。
- 免费档不画（对数轴画不了）；Y 轴没分的模型不画，但要在输出里列出来。
- Y 轴每张榜一张图，标题写清榜单名和快照日期；不做榜单分数级混合。

## 沟通

- 用户懂这个领域，直接给数和依据，不解释 API 计价常识。
- 说错了就直接改口、说清错在哪个假设，不绕。
- 每次改数在回复里给"旧值 → 新值 → 依据"，图变了说哪个点动了。
- 当前 Cursor Ultra 标准 Grok 4.6 采用用户 round6 决定的 64.2 亿/月：`(30.3×官方2 + 标准截图67.8)/2`；Fast 保留面板30.3亿，Pro+采用`64.2×800/3000=17.12`亿，Composer两模式随动。旧链为口头100→截图67.8→round5恢复100→round6放弃100、采用64.2；见 `data/research/cursor-adoption-round6-2026-09-06.json`。64.2是折中采用值，不是直接实测或严格2×自洽值（64.2/30.3≈2.119），促销周混杂未剥离；旧证据不覆盖。Cursor与SuperGrok是不同渠道。
- Kimi ¥49 无 K3 调用权限，用户已确认移除该点，排除理由保存在 `build_adopted.py`。¥199 的 11.61 亿保留为 K3-256K 为主的混合样本估算，不能直接宣称纯 K3 1M 实测。
- 汇率取 `data/conventions.json` 的 `usdPerCny`（历史字段名，实际方向为 CNY/USD），来源日期在 `exchangeRate`；采用脚本和中英文总览共用此值，不改历史 research 文件里的旧汇率。
- Claude Max按2026-09-14起永久口径估算：20x=157亿/月（参考110~200亿，单点medium），5x=157/用户确认周池比2=78.5亿；不要误用5h窗口倍数或旧2.25比。Pro的Opus5约1.9亿未获确认，不替换Opus4.8历史15.88亿；见`claude-adoption-round6-2026-09-06.json`。
- Gemini/Google暂无可靠采用值，不补点、不再探测账户额度。配色用明亮干净的高饱和色，不用深灰、脏色：OpenAI绿、Claude橙、xAI紫、Cursor黄、Kimi天蓝、GLM黑、MiniMax粉、Alibaba红、OpenCode青、DeepSeek蓝；Gemini若入库用黄绿，绿色不再保留。总览图每行数值旁加渠道缩写，图例置顶；前沿线用近黑，避免与厂商色混淆。

## 最新公开图表约定（2026-09-06，优先于旧输出命名规则）

- 用户于 2026-09-06 明确授权公开脱敏：data 为公开副本，原始 evidence 已完整备份到 Git 忽略的 _backup；此次仅处理身份、路径与不必要原文摘录，保留采用数值。后续数据研究仍遵循只追加，勿将公开脱敏误当作任意改历史数字的授权。见 PUBLICATION.md。

- 用户要求完整展示数据，不精简点集；英文 README 展示英文全量图，中文 README 展示中文全量图，两份均完整链接中英文 SVG/PNG。
- 发布目录为 charts/en 与 charts/zh，按 pareto、overview、frontier 分类。英文文件用英文名，中文文件用中文名。总索引为 charts/README.md。
- _build 为 Git 忽略的中间构建目录；运行 scripts/publish_charts.py 导出公开图。旧 out 路径和精选主图约定已被替代。
