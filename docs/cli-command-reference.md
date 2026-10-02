# CLI 指令与输出参考

状态：0.1.0 已实现，基于 TypeScript 与 Commander；npm 包尚未发布。下列输出示例使用 `node cli/dist/main.js` 在仓库根目录执行，基于当时打包的 **2026-10-01** 快照。该快照当时与线上文件一致；Chromium 读取原 HTTPS 网站 DOM 的 61 个场景、累计 5,176 行对比均通过，浏览器错误为 0。合并主仓库后，构建数据已更新为 **2026-10-02**，保留英文来源译文和评测档案元数据；示例日期保留其验证时点，实际日期以 `rap info` 为准。表格按字段整理，较长的详情只列节选；帮助和 stderr 采用实际输出。验证范围与 CSV 对账规则见 [CLI 设计规范](cli-design.md)，安装见 [CLI README](../cli/README.md)。CLI 仍从本地快照离线查询，不自动联网刷新。

命令名为 `rap`。默认表格、默认返回全部匹配记录；表头、套餐显示、帮助及错误信息固定使用英文。`Model`、`Company`、`Channel`、`Plan` 在每张价格记录表中独立成列，即使筛选后值相同也保留。`Company` 是模型开发公司，对应网站 `vendors`；`Channel` 是提供套餐的访问渠道。例如 Claude 由 Anthropic 开发，Droid Max 的渠道是 Factory。

下文标为 **stdout** 的 Markdown 表格是对应终端表格的字段示意，省略边框及换行；标为 **stderr** 的代码块是独立的结果说明，不混入表格、JSON 或 CSV。完整 Point ID 可以在窄终端换行，但不得截断。月额度的 B 表示十亿 token，真实单价单位为 USD/MTok；月费保留美元符号，原币 CNY 价格附在同一格。没有月额度或月费的值显示 —。Billing、Confidence 与网站使用相同英文显示名；JSON/CSV 保留原始标识和数值。排名与查询价格使用紧凑格式，show/compare 主价最多 6 位有效数字；query 分数最多 2 位小数，详情分数最多 4 位小数。排序使用原始精度。

## 1. 指令总览

| 指令 | 用途 | 默认次序 |
| --- | --- | --- |
| `rap price` | 对齐网站真实单价排名，包含订阅和按量 API | 真实单价升序 |
| `rap allowance` | 对齐网站月额度排名，只保留有月额度的订阅 | 月额度降序 |
| `rap list models` | 发现模型 ID、公司与覆盖记录数 | 模型 ID 升序 |
| `rap list companies` | 发现模型开发公司的标识与显示名 | 公司 ID 升序 |
| `rap list plans` | 发现套餐 ID、渠道及覆盖模型数 | 套餐 ID 升序 |
| `rap list channels` | 发现访问渠道及覆盖记录数 | 渠道名称升序 |
| `rap list boards` | 发现榜单、指标与独立快照日期 | 榜单 ID 升序 |
| `rap query` | 通用表格查询；自定义排序、评测配置与前沿 | 真实单价升序 |
| `rap show <point-id>` | 一条记录的价格、额度、采用依据与配置映射 | 指定记录 |
| `rap compare <point-id> <point-id>...` | 比较至少两条记录 | 保留输入顺序 |
| `rap info` | 查询依据、数量、负载与汇率口径 | 固定字段次序 |
| `rap --help` / `rap <command> --help` | 全局或子命令帮助 | — |
| `rap --version` | CLI 软件版本 | — |

全局数据选项为 `--data <site.json>`、`--format table|json|csv`。软件版本与数据快照日期分开；内置快照离线可用，查询不自动联网更新。

数据保存在本地：仓库的 `data/adopted.csv` 与 `derived/*.json` 通过共享适配器分别生成网站的 `web/public/data/site.json` 和 CLI 的 `cli/data/site.json`；两者的快照内容相同。`npm pack` 将 CLI 快照随本地安装包携带，数据路径相对安装位置定位，在任意工作目录均可读取。`--data <site.json>` 可指定其他本地快照；数据查询不联网。

## 2. `rap price`：真实单价排名

对应网页 `#lang=en&view=price&vendors=Anthropic`。默认返回 Anthropic 的全部 29 条价格记录，包括第三方渠道和按量 API。下面显式限制为前三条：

```sh
rap price --company Anthropic --limit 3
```

**stdout**：

| Rank | Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Claude Sonnet 5 | Anthropic | Anthropic | Claude Pro | $0.00309 | 6.472 B | $20 | Subscription | Medium | claude_pro::claude-sonnet-5 |
| 2 | Claude Sonnet 5 | Anthropic | Anthropic | Claude Max 20x (9/14+) | $0.0051 | 39.25 B | $200 | Subscription | Medium | claude_max_20x::claude-sonnet-5 |
| 3 | Claude Sonnet 5 | Anthropic | Anthropic | Claude Max 5x (9/14+) | $0.0051 | 19.625 B | $100 | Subscription | Low | claude_max_5x::claude-sonnet-5 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: price
Total: 29 | Returned: 3 | Truncated: true
Order: USD/MTok ascending; ties by Point ID.
```

Company 与 Channel 可以同时筛选。以下查询仍然选择 Anthropic 模型，但只看 Factory 渠道：

```sh
rap price --company Anthropic --channel Factory --limit 3
```

**stdout**：

| Rank | Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Claude Sonnet 5.5 | Anthropic | Factory | Droid Max | $0.01979 | 10.104 B | $200 | Subscription | Medium | droid_max::claude-sonnet-5.5 |
| 2 | Claude Opus 5.5 | Anthropic | Factory | Droid Max | $0.03959 | 5.052 B | $200 | Subscription | Medium | droid_max::claude-opus-5.5 |
| 3 | Claude Opus 4.8 | Anthropic | Factory | Droid Max | $0.04949 | 4.042 B | $200 | Subscription | Medium | droid_max::claude-opus-4.8 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: price
Total: 7 | Returned: 3 | Truncated: true
Order: USD/MTok ascending; ties by Point ID.
```

price 始终一点一行，内部固定选最高匹配配置；`--sort`、`--min-score`、`--scored-only`、`--frontier` 和显式 `--config` 不适用于排名视图。直接传给 price 时 Commander 报未知参数；通过 query 的排名视图传入时会报告只适用于 table。

按量 API 仍能在 price 中查询，它的月额度和月费为不适用：

```sh
rap price --company Anthropic --model claude-opus-5.5 --billing metered
```

**stdout**：

| Rank | Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Claude Opus 5.5 | Anthropic | Anthropic | Claude Opus 5.5 API | $0.419 | — | — | Metered API | High | anthropic_opus55_api::claude-opus-5.5 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: price
Total: 1 | Returned: 1 | Truncated: false
Order: USD/MTok ascending; ties by Point ID.
```

原币为 CNY 的套餐同时保留采用美元月费与原币价，不重新按汇率覆盖采用值：

```sh
rap price --plan kimi_allegretto_cn --model kimi-k3
```

**stdout**，`<br>` 表示同一单元格内换行：

| Rank | Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Kimi K3 (v1) | Kimi | Kimi | Kimi Allegretto | $0.02688 | 1.451 B | $39<br>¥199 | Subscription | Medium | kimi_allegretto_cn::kimi-k3 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: price
Total: 1 | Returned: 1 | Truncated: false
Order: USD/MTok ascending; ties by Point ID.
```

不计额度促销点没有月 token 分母，额度列显示 —；促销说明在该记录的续行：

```sh
rap price --plan devin_pro --model swe-2
```

**stdout**：

| Rank | Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | SWE-2 | Devin | Devin | Devin Pro (promo until 10/31) | ≈$0 | — | $20 | Subscription | Medium | devin_pro::swe-2 |

该行之后的续行字段：

```text
Point ID: devin_pro::swe-2
Promotion: promo until 2026-10-31, unmetered · $20 / mo
```

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: price
Total: 1 | Returned: 1 | Truncated: false
Order: USD/MTok ascending; ties by Point ID.
```

## 3. `rap allowance`：月额度排名

对应网页 `#lang=en&view=allowance&vendors=Anthropic`。API 的月额度不适用，不进入这个排名；也不把未知额度解释为无限额度。Anthropic 筛选共有 24 条：

```sh
rap allowance --company Anthropic --limit 3
```

**stdout**：

| Rank | Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Claude Sonnet 5 | Anthropic | Anthropic | Claude Max 20x (9/14+) | $0.0051 | 39.25 B | $200 | Subscription | Medium | claude_max_20x::claude-sonnet-5 |
| 2 | Claude Opus 5.5 | Anthropic | Anthropic | Claude Max 20x (9/14+) | $0.00634 | 31.538 B | $200 | Subscription | Medium | claude_max_20x::claude-opus-5.5 |
| 3 | Claude Sonnet 5 | Anthropic | Anthropic | Claude Max 5x (9/14+) | $0.0051 | 19.625 B | $100 | Subscription | Low | claude_max_5x::claude-sonnet-5 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: allowance
Total: 24 | Returned: 3 | Truncated: true
Order: monthly tokens descending; ties by Point ID.
Fee band: all
```

月费档位与网站一致，`0-30` 包含 $30，`30-100` 不包含 $30、包含 $100，`100-300` 不包含 $100、包含 $300；`all` 也保留超过 $300 的套餐。

```sh
rap allowance --company Anthropic --fee-band 0-30 --limit 3
```

**stdout**：

| Rank | Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | Claude Sonnet 5 | Anthropic | Anthropic | Claude Pro | $0.00309 | 6.472 B | $20 | Subscription | Medium | claude_pro::claude-sonnet-5 |
| 2 | Claude Opus 5.5 | Anthropic | Anthropic | Claude Pro | $0.00655 | 3.054 B | $20 | Subscription | High | claude_pro::claude-opus-5.5 |
| 3 | Claude Opus 4.8 | Anthropic | Anthropic | Claude Pro | $0.00772 | 2.589 B | $20 | Subscription | Low | claude_pro::claude-opus-4.8 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: allowance
Total: 6 | Returned: 3 | Truncated: true
Order: monthly tokens descending; ties by Point ID.
Fee band: 0-30
```

## 4. `rap list`：发现可查询资源

list 搜索资源自身的 ID 和显示名，返回资源汇总，不展开价格点。先按适用的 Company/Channel 条件确定统计范围，再按资源搜索和 limit 输出；计数为该范围内的记录数。支持情况如下，不相关参数直接报错：

| 资源 | `--search` / `--limit` | `--company` / `--vendor` | `--channel` |
| --- | --- | --- | --- |
| models | 支持 | 支持 | 支持 |
| companies | 支持 | 不适用 | 支持 |
| plans | 支持 | 支持 | 支持 |
| channels | 支持 | 支持 | 不适用 |
| boards | 支持 | 不适用 | 不适用 |

### `rap list models`

用途：查准确的 Model ID；Company 单列，不混入模型名。

```sh
rap list models --company Anthropic --search claude-opus-5.5
```

**stdout**：

| Model ID | Model | Company ID | Company | Plans | Channels | Points |
| --- | --- | --- | --- | ---: | ---: | ---: |
| claude-opus-5.5 | Claude Opus 5.5 | Anthropic | Anthropic | 7 | 3 | 7 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | Resource: models
Total: 1 | Returned: 1 | Truncated: false
```

### `rap list companies`

用途：查模型开发公司的原始标识和显示名。`--company` 精确筛选用 Company ID；例如 Muse 的显示名是 Meta，Cognition 的显示名是 Devin，仍保留原始 ID。

```sh
rap list companies --search Anthropic
```

**stdout**：

| Company ID | Company | Models | Plans | Points |
| --- | --- | ---: | ---: | ---: |
| Anthropic | Anthropic | 7 | 12 | 29 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | Resource: companies
Total: 1 | Returned: 1 | Truncated: false
```

### `rap list plans`

用途：查套餐 ID 和访问渠道。一个套餐可以覆盖多个模型、多个开发公司；`Models` 是覆盖的不同模型数，不能把套餐视为只属于一个公司。

```sh
rap list plans --channel Factory --search droid_max
```

**stdout**：

| Plan ID | Plan | Channel | Companies (IDs) | Models | Points |
| --- | --- | --- | --- | ---: | ---: |
| droid_max | Droid Max | Factory | Alibaba, Anthropic, DeepSeek, Google, Kimi, MiniMax, Mistral, OpenAI, SpaceXAI, Zhipu, other | 27 | 27 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | Resource: plans
Total: 1 | Returned: 1 | Truncated: false
```

### `rap list channels`

用途：查访问渠道。以下输出统计 Factory 提供的 Anthropic 模型，不是 Factory 全部模型。

```sh
rap list channels --company Anthropic --search Factory
```

**stdout**：

| Channel | Models | Plans | Points |
| --- | ---: | ---: | ---: |
| Factory | 6 | 2 | 7 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | Resource: channels
Total: 1 | Returned: 1 | Truncated: false
```

### `rap list boards`

用途：查独立榜单的 ID、指标和快照。榜单日期不同于价格快照日期；分数不能跨榜单混比。

```sh
rap list boards --search aa_intelligence_index
```

**stdout**：

| Board ID | Board | Metric | Board snapshot | Configurations |
| --- | --- | --- | --- | ---: |
| aa_intelligence_index | Artificial Analysis Intelligence Index v4.3 | Intelligence Index | 2026-09-22 | 126 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | Resource: boards
Total: 1 | Returned: 1 | Truncated: false
```

## 5. `rap query`：通用查询

默认 `--view table`，可筛选精确模型、公司、渠道、套餐、计费类型、置信度和数值范围，默认按真实单价升序。表格不要求有评测分数。

```sh
rap query --model claude-opus-5.5 --channel Factory
```

**stdout**：

| Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Claude Opus 5.5 | Anthropic | Factory | Droid Max | $0.03959 | 5.052 B | $200 | Subscription | Medium | droid_max::claude-opus-5.5 |
| Claude Opus 5.5 | Anthropic | Factory | Droid Pro | $0.05236 | 0.382 B | $20 | Subscription | Low | droid_pro::claude-opus-5.5 |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: table
Total: 2 | Returned: 2 | Truncated: false
Order: price:asc
```

`rap query --view price` 与 `rap price` 的参数、数据、排序和输出相同；`rap query --view allowance` 与 `rap allowance` 相同，不另造一套排名：

```sh
rap query --view price --company Anthropic --limit 3
# stdout/stderr 与第 2 节第一个示例一致。

rap query --view allowance --company Anthropic --limit 3
# stdout/stderr 与第 3 节第一个示例一致。
```

评测查询只在 table 中展开配置。以下同一价格点输出三个配置，价格与额度重复是因为配置不同；不是三份可累加额度。

```sh
rap query --plan droid_max --model claude-opus-5.5 \
  --board aa_intelligence_index --config all --sort score:desc \
  --limit 3
```

**stdout**，价格区域：

| Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Claude Opus 5.5 | Anthropic | Factory | Droid Max | $0.03959 | 5.052 B | $200 | Subscription | Medium | droid_max::claude-opus-5.5 |
| Claude Opus 5.5 | Anthropic | Factory | Droid Max | $0.03959 | 5.052 B | $200 | Subscription | Medium | droid_max::claude-opus-5.5 |
| Claude Opus 5.5 | Anthropic | Factory | Droid Max | $0.03959 | 5.052 B | $200 | Subscription | Medium | droid_max::claude-opus-5.5 |

**stdout**，核心表下方的评测区域节选，按相同行序展示；完整输出另含 Point ID、Harness、Mode、Estimated、Self-reported、Best ties：

| Score | Effort | Variant | Configuration ID | Mapping confidence | Quota effort matched |
| ---: | --- | --- | --- | --- | --- |
| 57.62 | Max | Claude Opus 5.5 (max with fallback) | aa_intelligence_index:6df46e4e9119d1e1 | Medium | unverified |
| 55.99 | xhigh | Claude Opus 5.5 (xhigh with fallback) | aa_intelligence_index:4c3fe13d36952d4f | Medium | unverified |
| 53.58 | High | Claude Opus 5.5 (high with fallback) | aa_intelligence_index:c4632b7e15588786 | Medium | unverified |

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: table
Board: aa_intelligence_index | Board snapshot: 2026-09-22 | Config: all
Total: 5 | Returned: 3 | Truncated: true
Order: score:desc
```

`--config best` 默认选所筛配置中的最高分；`--frontier` 须指定 `--board`，在完整筛选结果上计算后才应用 limit。无分记录默认保留，只有 `--min-score`、`--scored-only` 或 `--frontier` 才排除它们。JSON/CSV 的字段结构、前沿与缺失值规则见设计规范。

## 6. `rap show`：单条记录与采用依据

用途：用精确 Point ID 查看数据及证据。默认展示全部已映射榜单；下面用 `--board` 缩小到一个榜单，仍展示该榜单所有匹配配置。

```sh
rap show 'droid_max::claude-opus-5.5' --board aa_intelligence_index
```

**stdout**，核心数据：

| Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Claude Opus 5.5 | Anthropic | Factory | Droid Max | $0.0395883 | 5.052 B | $200 | Subscription | Medium | droid_max::claude-opus-5.5 |

**stdout**，原始数值与采用依据字段节选；完整表还包括 Promotion、List blended USD/MTok：

| Field | Value |
| --- | --- |
| Model ID | claude-opus-5.5 |
| Company ID | Anthropic |
| Plan ID | droid_max |
| Original monthly fee | 200 USD |
| Local price | — |
| Monthly tokens, raw | 5,052,000,000 |
| USD/MTok, raw | 0.039588282 |
| Workload | Anthropic workload: 97% cache reads / 2.5% cache writes / 0.5% output |
| Data date | 2026-09-29 |
| Date kind | sample |
| Date inherited from | — |
| Unmetered | false |
| Promotion until | — |
| Plan generation |  |
| Official model prices | Official API list (cached / in / out, per MTok): $0.2 / $4 / $20 |
| Subscription price assumption | Full use of the adopted allowance |

**stdout**，原始 `Source` 和 `Decision note` 保持原文，允许按终端宽度换行：

```text
Source:
用户Factory Droid本机实测：周额度（7-day rolling）已用1%→5%段（xhigh）+35,598,616 tok、5%@08:13→9%@12:40段（high，新会话47f9711d）+36,567,946 tok，合计+72,166,562 tok全为claude-opus-5-5（auto 0增量；glm-5.3-flash +50,317 属Droid Core免费池不计）；合计分拆 in 793,017/out 375,172/cache_create 3,640,056/cache_read 67,311,924/thinking 46,393；droid-opus55-max-round1-2026-09-29.json；https://factory.ai/pricing Max $200/月

Decision note:
首个Factory Droid点，按devin_max×opus-5.5同口径折算：1→9合计负载 cache读93.27%/cache写5.04%/输入1.10%/输出0.52%/thinking0.06%（hit 93.82%）偏离标准档；按Opus 5.5标价 cached$0.2/写5m $5/in$4/out$20（thinking 46,393不计费，用户裁定；与factoryCredits 16,935,482≈worth÷$4×1.6对账一致）折段 worth $42.34 ÷8%×4周＝月$2116.91 list-worth ÷ Anthropic档混合价$0.419/MTok＝50.52亿；1%/9%为取整读数，Δpp∈[7,9]对应约44.91~57.74亿；cache写按1h $8敏感性53.91亿不采；原始total口径72,166,562÷8%×4周＝36.08亿（周池902,082,025 raw）留作对照；factoryCredits 16,935,482≈2.12亿credits/周；两段4pp各8.90M/9.14M tok每pp（差2.7%），effort仅影响速率；Factory另有5h与30天滚动窗，30天窗若低于4×周池则本值偏高；Pro $20/Plus $100官方仅写约1/10、1/5 Max用量，不派生
```

**stdout**，证据链接：

| Evidence | URL |
| --- | --- |
| https://factory.ai/pricing | https://factory.ai/pricing |
| droid-opus55-max-round1-2026-09-29.json | /data/evidence/droid-opus55-max-round1-2026-09-29.json |

证据的 `/data/...` 是快照保存的相对网站路径，CLI 原样保留该路径。

**stdout**，榜单与配置字段节选；完整输出另含 Board ID、Harness、Mode，以及每条配置的完整字段表：

| Board ID | Board | Board snapshot |
| --- | --- | --- |
| aa_intelligence_index | Artificial Analysis Intelligence Index v4.3 | 2026-09-22 |

| Configuration ID | Variant | Score | Effort | Estimated | Self-reported | Mapping confidence | Quota effort matched |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| aa_intelligence_index:6df46e4e9119d1e1 | Claude Opus 5.5 (max with fallback) | 57.6224 | Max | false | false | Medium | unverified |
| aa_intelligence_index:4c3fe13d36952d4f | Claude Opus 5.5 (xhigh with fallback) | 55.9874 | xhigh | false | false | Medium | unverified |
| aa_intelligence_index:c4632b7e15588786 | Claude Opus 5.5 (high with fallback) | 53.5832 | High | false | false | Medium | unverified |
| aa_intelligence_index:b44090b237d31264 | Claude Opus 5.5 (medium with fallback) | 51.2435 | Medium | false | false | Medium | unverified |
| aa_intelligence_index:4dae1243cd80cd14 | Claude Opus 5.5 (low with fallback) | 42.3078 | Low | false | false | Medium | unverified |

```text
Benchmark source: https://artificialanalysis.ai/leaderboards/models
Mapping kind: model_configuration_reference
Mapping note: Exact served-model reference; quota-measurement effort is unverified.
```

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled
Board: aa_intelligence_index | Board snapshot: 2026-09-22
Total: 1 | Returned: 1 | Truncated: false
```

## 7. `rap compare`：比较指定价格点

用途：比较官方套餐与第三方渠道，不将同一模型视为同一套餐。保留输入次序，先展示两条核心记录，再逐项对齐采用依据；指定榜单时附加最高配置。至少需要两个不同的精确 Point ID。

```sh
rap compare 'claude_max_20x::claude-opus-5.5' \
  'droid_max::claude-opus-5.5' --board aa_intelligence_index
```

**stdout**，核心数据：

| Model | Company | Channel | Plan | USD/MTok | Monthly tokens | Monthly fee USD | Billing | Confidence | Point ID |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Claude Opus 5.5 | Anthropic | Anthropic | Claude Max 20x (9/14+) | $0.00634156 | 31.538 B | $200 | Subscription | Medium | claude_max_20x::claude-opus-5.5 |
| Claude Opus 5.5 | Anthropic | Factory | Droid Max | $0.0395883 | 5.052 B | $200 | Subscription | Medium | droid_max::claude-opus-5.5 |

**stdout**，比较字段节选：

| Field | Claude Max 20x (9/14+) | Droid Max |
| --- | --- | --- |
| Point ID | claude_max_20x::claude-opus-5.5 | droid_max::claude-opus-5.5 |
| Monthly tokens, raw | 31,538,000,000 | 5,052,000,000 |
| USD/MTok, raw | 0.0063415562 | 0.039588282 |
| Original monthly fee | 200 USD | 200 USD |
| Workload | Anthropic workload: 97% cache reads / 2.5% cache writes / 0.5% output | Anthropic workload: 97% cache reads / 2.5% cache writes / 0.5% output |
| Data date | 2026-09-22~2026-09-27 | 2026-09-29 |
| Date kind | sample | sample |
| Date inherited from | — | — |
| Promotion until | — | — |
| Unmetered | false | false |
| Plan generation |  |  |
| Board | aa_intelligence_index | aa_intelligence_index |
| Board snapshot | 2026-09-22 | 2026-09-22 |
| Score | 57.6224 | 57.6224 |
| Effort | Max | Max |
| Variant | Claude Opus 5.5 (max with fallback) | Claude Opus 5.5 (max with fallback) |
| Configuration ID | aa_intelligence_index:6df46e4e9119d1e1 | aa_intelligence_index:6df46e4e9119d1e1 |
| Estimated | false | false |
| Self-reported | false | false |
| Mapping confidence | Medium | Medium |
| Quota effort matched | unverified | unverified |

**stdout**，Claude Max 的原始证据区域：

```text
Point ID: claude_max_20x::claude-opus-5.5
Source:
X @MiaAI_lab 推文（用户提供截图）：xHigh 1h2m 烧 10.305亿 raw = ~75% of 5h limit；claude-opus55-round1-2026-09-23.json；round10 条目#15 Max 20x ≈5.5 满窗/周（claude-adoption-round10-2026-09-25.json）；Claude Pro × Opus 5.5 采用样本（issue #52 + Reddit 段）×10；claude-opus55-max20x-round2-2026-09-30.json

Decision note:
301.7→315.38亿（2026-09-30 用户裁定，Anthropic 档）：两路各折成 Max 20x 周额度百分点后按百分点合并——① MiaAI 窗 worth $471.10（写按 5m，与推文 $482.63 闭合）= 75% 窗 ÷ 5.5 窗/周 = 周 13.636pp，单独 329.81亿；② Pro × Opus 5.5 合并 worth $628.00 / 196.333 Pro pp ÷ Max 20x 周额度 = Pro×10 → 周 19.633pp，单独 305.36亿；两路差 8%。不采：Pro 5h/周 13.333%（7.5 窗）直接套 Max 20x 得 449.7 亿（Max 20x 窗 20×、周 10×，窗/周比与 Pro 不同）；官方倍率推 3.75 窗/周得 224.9 亿（MiaAI 窗仅为 Pro 窗 15.5× 而非 20×，与两倍率同时精确不自洽）；等权平均 317.58 亿；#65 混合样本暂不处理。以下为旧 301.7 决策原文——新增301.7亿：5h池 10.305亿÷~75%=13.74亿 raw（9/22发布已上调 Pro/Max/Team 5h 上限，窗池系发布期口径）；隐含权重 7.15/13.74=0.5204×Opus5 → 月池157÷0.5204；标价混合比0.5143独立互证（备选305.28亿差1.2%）；样本按新价$471.1≈推文$482.63闭合(+2.4%)；n=1推文无面板、~75%取整读数（月额区间约283~322亿）、effort仅影响速率；若官方权重偏离价格比（Fable 6.5×前车之鉴）需重推；周池面板直测/reset后受控打满可升high
```

| Evidence | URL |
| --- | --- |
| claude-adoption-round10-2026-09-25.json | /data/evidence/claude-adoption-round10-2026-09-25.json |
| claude-opus55-max20x-round2-2026-09-30.json | /data/evidence/claude-opus55-max20x-round2-2026-09-30.json |
| claude-opus55-round1-2026-09-23.json | /data/evidence/claude-opus55-round1-2026-09-23.json |

其后输出 `Point ID: droid_max::claude-opus-5.5` 对应的 Source、Decision note 和 Evidence，内容与第 6 节相同；本页不重复这段长文本。比较保留原始采用理由，不自动归纳为推荐结论，也不合计同套餐不同模型的额度。

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled
Board: aa_intelligence_index | Board snapshot: 2026-09-22 | Config: best
Total: 2 | Returned: 2 | Truncated: false
```

## 8. `rap info`：快照与口径

用途：确认本次查询读哪份数据、数据规模与采用口径。这里的快照字段本身是命令数据，写 stdout。

```sh
rap info
```

**stdout**：

| Field | Value |
| --- | --- |
| Data source | bundled |
| Data snapshot | 2026-10-01 |
| Dataset version | 1 |
| Price points | 318 |
| Models | 74 |
| Companies | 18 |
| Channels | 17 |
| Plans | 95 |
| Boards | 8 |
| Benchmark configurations | 330 |
| Price/configuration mappings | 1854 |
| Subscription price assumption | Full use of the adopted allowance |
| Allowances across models in one plan | Alternative use; do not add together |
| Generic month | 4 weeks; vendor-specific monthly pools retain their adopted basis |
| Standard workload | 97% cache reads / 2.5% fresh input / 0.5% output |
| Anthropic workload | 97% cache reads / 2.5% cache writes / 0.5% output |
| Low-cache workload | 85% cache reads / 14.5% fresh input / 0.5% output |
| Measured workload | Raw sample tokens; not workload-normalized |
| Adopted exchange rate | 1 USD = 6.7787 CNY |
| Exchange rate date | 2026-09-04 |
| Exchange rate source | CFETS central parity, via Xinhua |

**stderr**：

```text
Total: 1 | Returned: 1 | Truncated: false
```

带 `--data` 的读取方式相同，source 则显示文件来源与解析后的路径；数据快照取文件中的 `generatedAt`，不取文件修改时间：

```sh
rap info --data ./web/public/data/site.json
```

在仓库根目录调用时，其余字段与上表一致，前两项为：

| Field | Value |
| --- | --- |
| Data source | file: /workspace/real-api-pricing/web/public/data/site.json |
| Data snapshot | 2026-10-01 |

## 9. 帮助与版本

### `rap --help`

用途：发现入口及全局选项。帮助由 Commander 自动生成，无需加载快照。以下为实际英文帮助文本：

```sh
rap --help
```

**stdout**：

```text
Usage: rap [options] [command]

Read model prices and monthly allowances from a local snapshot.

Options:
  -V, --version                     output the version number
  --data <site.json>                Read a specified local snapshot
  --format <format>                 Output format: table | json | csv (default:
                                    "table")
  -h, --help                        display help for command

Commands:
  price [options]                   Real price ranking, lowest first; includes
                                    metered APIs and unscored points.
  allowance [options]               Monthly allowance ranking, largest first;
                                    subscriptions with known monthly tokens.
  query [options]                   Query price points; optionally filter
                                    benchmark configurations.
  list                              Discover exact model, company, channel, plan
                                    and board IDs.
  show [options] <point-id>         Show price, allowance, evidence and all
                                    mapped benchmark configurations.
  compare [options] <point-ids...>  Compare at least two distinct price points,
                                    in input order.
  info                              Show snapshot, coverage and calculation
                                    conventions.

Examples:
  rap price --company Anthropic
  rap allowance --company Anthropic --fee-band 0-30
  rap list models --search claude
  rap query --board aa_intelligence_index --frontier --format json

Run rap <command> --help for command-specific options.
```

帮助与版本不会附加查询统计到 stderr。`--format` 面向数据命令，help/version 始终输出文本。

### `rap price --help`

```sh
rap price --help
```

**stdout**：

```text
Usage: rap price [options]

Real price ranking, lowest first; includes metered APIs and unscored points.

Options:
  --company <id>          Exact model developer ID; repeatable
  --vendor <id>           Alias of --company; values are combined
  --channel <name>        Exact access channel; repeatable
  --model <id>            Exact model ID; repeatable
  --plan <id>             Exact plan ID; repeatable
  --billing <kind>        subscription | metered; repeatable
  --confidence <level>    high | medium | low; repeatable
  --search <text>         Whole-substring website search (default: "")
  --min-fee <USD>         Inclusive lower monthly-fee bound
  --max-fee <USD>         Inclusive upper monthly-fee bound
  --min-price <USD/MTok>  Inclusive lower real-price bound
  --max-price <USD/MTok>  Inclusive upper real-price bound
  --min-tokens <integer>  Inclusive lower monthly-token bound
  --max-tokens <integer>  Inclusive upper monthly-token bound
  --board <id>            Independent benchmark board
  --harness <name>        Benchmark harness; requires --board; repeatable
  --effort <name>         Reasoning effort; requires --board; repeatable
  --mode <name>           Service mode; requires --board; repeatable
  --limit <integer>       Return at most this many rows; default: all
  -h, --help              display help for command

Global Options:
  -V, --version           output the version number
  --data <site.json>      Read a specified local snapshot
  --format <format>       Output format: table | json | csv (default: "table")

Global options: --data <site.json> --format table|json|csv --version
Use query --view table for custom sorting, score filters and configuration expansion.
```

`rap allowance --help` 同样列出公共筛选，增加 `--fee-band all|0-30|30-100|100-300`，说明只保留有月额度的订阅且额度降序。`rap query --help` 列出 `--view`、`--sort` 和评测选项的依赖；`rap list <resource> --help` 按第 4 节的适用矩阵列参数；show/compare 的查询选项只有 `--board`，不接受排名的过滤、排序与 limit。

### `rap --version`

当前软件版本为 `0.1.0`；内置数据日期另由 `rap info` 查询。

```sh
rap --version
```

**stdout**：

```text
rap 0.1.0
```

## 10. 空结果与参数错误

查询无匹配记录是成功，stdout 显示空结果，退出码为 0：

```sh
rap price --company Anthropic --search no-such-model-123
```

**stdout**：

```text
No matching results.
```

**stderr**：

```text
Snapshot: 2026-10-01 | Source: bundled | View: price
Total: 0 | Returned: 0 | Truncated: false
Order: USD/MTok ascending; ties by Point ID.
```

精确 ID、参数枚举或依赖错误的退出码为 2；stdout 为空，错误只写 stderr。例如：

```sh
rap price --company Factory
```

```text
error: Unknown company ID "Factory". Factory is a Channel. Use --channel Factory.
```

```sh
rap price --company Anthropic --sort fee:asc
```

```text
error: unknown option '--sort'
(Did you mean one of --effort, --format?)
```

Commander 随后附加 price 的帮助。自定义排序使用 `rap query --view table --sort fee:asc`。

```sh
rap query --frontier
```

```text
error: --frontier requires --board.
```

```sh
rap list boards --company Anthropic
```

```text
error: unknown option '--company'
```

Commander 随后附加 list boards 的帮助。

数据文件读取或格式错误退出码为 1，不能输出半份成功结果。JSON 和 CSV 使用与表格相同的记录集合，空 JSON 返回 `rows: []`，空 CSV 保留表头；诊断仍写 stderr。CLI CSV 保持对应命令排序；网站排名视图的“Table · CSV”采用明细表排序（allowance 下载也按价格），固定列 schema 也不同，因此按 Point ID 对账共享原始字段，不要求文件逐字一致。比较榜单引用字段时显式选择同一榜单。完整导出契约见 [CLI 设计规范](cli-design.md)。
