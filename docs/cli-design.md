# Real API Pricing 数据查询 CLI 设计

状态：0.1.0 已实现，命令名为 `rap`，输出 schemaVersion 为 1。TypeScript CLI 使用 Commander 处理命令和参数；npm 包尚未发布。

本文件定义命令和输出契约；逐条命令的参数、调用及输出见 [命令参考](cli-command-reference.md)。示例使用 2026-10-01 快照核对；当时以 Chromium 读取原 HTTPS 网站的实际 DOM，完成 61 个场景、累计 5,176 行的对比，记录、排序和共享显示字段均无差异，线上与当时内置快照内容一致。合并主仓库后，构建数据已更新为 2026-10-02；实际查询日期以 `rap info` 为准。安装与构建步骤见 [CLI README](../cli/README.md)。

## 1. 目标与网站对齐

CLI 提供采用数据的发现、排名、详情、比较及导出。基本记录是“套餐 × 实际服务模型”，精确 ID 为 `plan_id::model`。

| 网站视图 | CLI 命令 | 记录与排序 |
| --- | --- | --- |
| [Real price · Anthropic](https://real-api-pricing.vercel.app/#lang=en&view=price&vendors=Anthropic) | `rap price --company Anthropic` | 所有匹配价格点，真实单价升序 |
| [Monthly allowance · Anthropic](https://real-api-pricing.vercel.app/#lang=en&view=allowance&vendors=Anthropic) | `rap allowance --company Anthropic` | 有月额度的订阅点，月额度降序 |

同一份快照下，CLI 与对应网页的记录集合、筛选、搜索、排序、显示单位必须一致：

- price 包含按量 API、无榜分记录和不计额度促销点。
- allowance 使用 `billing !== metered && monthly_yi !== null`，排除 API、未知额度及无月额度分母的促销点。
- 两个视图都是一个价格点一行，排名不展开评测配置，不依赖是否有分数。
- 排名按原始数值计算，数值相同时按网站的 point ID 比较次序排序；先完成筛选和排序，再应用 limit。
- 搜索使用整段文本 trim/lower 后的子串匹配，检索 label、英文显示的套餐名、channel 及当前关联评测配置的 variant。
- 内部配置关联默认使用网站的 AA Intelligence 最高匹配配置；并列时保留原始映射顺序中的首项。隐含关联仅用于搜索口径，不代表用户选择了榜单，不改变无分价格点的保留规则。

网站的模型选择和渠道/套餐筛选在 CLI 中用独立参数表达；CLI 返回全部匹配行，只有显式 limit 才截断。

## 2. Model、Company、Channel、Plan

| 字段 | 含义 | 标识/源字段 | 显示字段 |
| --- | --- | --- | --- |
| Model | 模型 | model | model_display |
| Company | 模型开发公司 | company = 原始 vendor | company_display = manufacturer(vendor) |
| Channel | 访问/订阅渠道 | channel | channel |
| Plan | 具体套餐 | plan_id，原始 plan 名称 | plan_display = displayPlan(plan, "en") |

例如 `Claude Sonnet 5.5 / Anthropic / Factory / Droid Max`：公司为 Anthropic，访问渠道为 Factory，套餐为 Droid Max。Model、Company、Plan 始终分列；即使筛选后相同也不隐藏。Channel 同样独立成列。

`--company Anthropic` 对应网页的 `vendors=Anthropic`。`--vendor` 是同一参数的兼容别名，两者的值合并后按 OR 筛选。公司参数接受原始 vendor 标识；Muse/Cognition 分别显示为 Meta/Devin，显示别名不自动替换公司标识。list companies 同时输出标识与显示名。

## 3. 命令集合与默认值

| 命令 | 用途 | 默认规则 |
| --- | --- | --- |
| `rap price` | 真实单价排名 | 价格升序，一点一行 |
| `rap allowance` | 月额度排名 | 额度降序，fee-band=all |
| `rap query` | 通用数据查询 | view=table，sort=price:asc；未选榜单时一点一行 |
| `rap list models` | 发现模型标识 | 标识升序 |
| `rap list companies` | 发现公司标识 | 标识升序 |
| `rap list channels` | 发现访问渠道 | 渠道名升序 |
| `rap list plans` | 发现套餐标识 | 标识升序 |
| `rap list boards` | 发现榜单 | 榜单标识升序 |
| `rap show <point-id>` | 一条价格记录的完整详情 | 包含所有已映射榜单 |
| `rap compare <point-id> <point-id>...` | 比较至少两条价格记录 | 保留输入顺序 |
| `rap info` | 数据来源、快照和计算口径 | 当前选定数据集 |
| `rap --help` / `rap <command> --help` | 总帮助/命令帮助 | 无需加载数据 |
| `rap --version` | CLI 版本 | 无需加载数据 |

`rap price` 与 `rap query --view price` 完全等价；`rap allowance` 与 `rap query --view allowance` 完全等价，包括 JSON 元信息中的规范 command 名称。query 默认 table，排名视图禁止 --sort、--min-score、--scored-only、--frontier 和显式 --config；内部配置始终取 best，--config 参数仅用于 table。

全局参数：`--data <site.json>`、`--format table|json|csv`、`--help`、`--version`。默认内置快照和 table。CLI 的表头、套餐显示、帮助、摘要和错误提示固定为英文，原始来源与采用依据保持原文。全局参数可置于子命令前或后。直接运行 rap 输出帮助并退出 0。

## 4. 参数范围

### 4.1 价格记录筛选

price、allowance 和 query 共用：

| 参数 | 语义 |
| --- | --- |
| `--model <id>` | 精确模型标识，可重复 |
| `--company <id>` / `--vendor <id>` | 精确公司标识，可重复；别名值合并 |
| `--channel <name>` | 精确访问渠道，可重复 |
| `--plan <id>` | 精确套餐标识，可重复 |
| `--billing subscription\|metered` | 计费方式，可重复 |
| `--confidence high\|medium\|low` | 额度置信度，可重复 |
| `--search <text>` | 对齐网页的整段子串搜索 |
| `--min-fee` / `--max-fee` | USD 月费/年付月均费用，包含边界；只匹配有数值的点 |
| `--min-price` / `--max-price` | 真实单价 USD/MTok，包含边界 |
| `--min-tokens` / `--max-tokens` | 原始月 token 数，包含边界；只匹配有数值的点 |
| `--limit <positive integer>` | 限制最终行数；默认全部 |

同一维度多值 OR，不同维度 AND。无效标识、未知枚举、负数、非有限数字、min 大于 max 都报错；token 和 limit 必须为安全整数。近似标识可提示候选，但不会自动代替用户输入。

### 4.2 月费档位

`--fee-band all|0-30|30-100|100-300` 仅 allowance 或 query --view allowance 可用。使用 config/allowance-fee-bands.json 的定义：

| 档位 | USD 月费范围 |
| --- | --- |
| all | 全部，包含超过 $300 的套餐 |
| 0-30 | [0, 30] |
| 30-100 | (30, 100] |
| 100-300 | (100, 300] |

fee-band 与额外 min/max-fee 条件同时给出时取交集。all 不解除额度视图的“订阅且有月额度”规则。

### 4.3 评测与 table 扩展

--board 选择一个独立榜单；--harness、--effort、--mode 为可重复配置筛选，须显式指定 --board。这些筛选限制配置映射，不会单独移除缺分价格点。price/allowance 即使指定榜单仍只显示一条价格点，可在 JSON/CSV 中附加所选最高配置，table 排名列不增加评分。

以下仅用于 query --view table：

- `--config best|all`：best 选择最高匹配配置，按网站原始映射顺序处理并列，并附加 best_tie_count；all 展开全部配置。显式指定 config 需要 --board。
- `--min-score <number>`：包含边界，排除无分点，需要 --board。
- `--scored-only`：排除无分点，需要 --board。
- `--frontier`：筛选集中真实单价更低、分数更高的非支配点，需要 --board；至少一项严格更好才算支配，同价同分保留；在 limit 之前计算。
- `--sort price|fee|allowance|score|model|plan[:asc|desc]`：默认 price:asc；不写方向时默认为 asc；score 排序需要 --board。null 始终最后，同值按 point ID、configuration ID 排序。

--config all 时行标识为 point_id + configuration_id；无匹配配置时仍保留一条 benchmark=null 的价格行。只有 min-score/scored-only/frontier 才排除这类行。

show 与 compare 只接受全局参数以及可选 --board。show 限定该榜单的全部配置，compare 取该榜单最高匹配配置；未选榜单时 compare 不附加分数。未知 point ID 或比较重复 ID 报错，不返回部分成功结果。

### 4.4 list 参数矩阵

list 支持 --search 和 --limit；search 在资源标识和显示名上整段匹配，先统计筛选范围内的资源，再应用资源搜索和 limit。

| 资源 | 可用额外筛选 | 统计口径 |
| --- | --- | --- |
| models | company/vendor、channel | 筛选范围内的套餐数、渠道数、价格点数 |
| companies | channel | 筛选范围内的模型数、套餐数、价格点数 |
| channels | company/vendor | 筛选范围内的模型数、套餐数、价格点数 |
| plans | company/vendor、channel | 筛选范围内的公司集合、模型数、价格点数 |
| boards | 无 | 该榜单的配置数与独立快照日期 |

不支持的参数报错，不能静默忽略。公司/模型数量为独立标识数量，不跨渠道直接求和。

## 5. 表格与详情输出

价格记录的默认表格固定包含：Model、Company、Channel、Plan、USD/MTok、Monthly tokens、Monthly fee USD、Billing、Confidence、Point ID。price/allowance 另有 Rank，两者统一列序，通过 View 和排序说明明确主要排名指标。cli-table3 配合 string-width 和 wrap-ansi 按字符显示宽度计算列宽与换行，保留中文等文本的完整内容；重定向时使用固定宽度。表格太宽时将完整 Point ID 放到同一记录的续行，其他独立列仍保留，不截断 ID。

表格显示复用网站英文格式：price、allowance、query 的真实单价和月费使用 price；show、compare 核心表的真实单价使用 priceExact（最多 6 位有效数字）。月费保留美元符号，例如 $200、$0.7376；CNY 套餐在同一格换行附加原币价，例如 $39 与下一行 ¥199。额度使用 allowance 的 B（十亿 token）。API、不计额度点或未知值没有月额度分母时统一显示 —，无数值月费也显示 —；不将空值替换为 N/A 或 Unknown。不计额度促销说明放在该记录的续行，月费仍按采用值显示。

Billing 使用 Subscription / Metered API，Confidence 和 Mapping confidence 使用 High / Medium / Low。query 的评测分数按网站表格显示最多 2 位小数，show、compare 的配置详情分数最多 4 位小数；Effort 使用英文 effortLabel，例如 Max、High、xhigh。排序和前沿使用未舍入的原始数值。

show 在核心价格表后给出来源、采用理由、负载、采样日期、促销信息及配置表；compare 在核心表后逐项比较这些依据。同套餐不同模型的额度为替代关系，不能相加。

数据快照和 total/returned/truncated 说明对 table/CSV 写 stderr；info 的快照本身是查询字段，写 stdout。JSON 提示进入 meta.warnings。

## 6. JSON 与 CSV 契约

### 6.1 JSON 统一外层

所有数据命令都返回一个 UTF-8 JSON 对象，schemaVersion=1，外层固定为 meta + rows。字段如下：

| meta 字段 | 定义 |
| --- | --- |
| command | 规范命令名 price/allowance/query/list/show/compare/info；排名别名归一为 price/allowance |
| resource | 仅 list 为 models/companies/channels/plans/boards，其他 null |
| snapshot | 采用数据快照日期 |
| source | bundled 或 file；file 另有 sourcePath，bundled 时 sourcePath=null |
| view | price/allowance/table；list/show/compare/info 为 null |
| board / boardSnapshot | 显式选择榜单的 ID/日期；否则均为 null，内部搜索用板不改变这两个值 |
| total / returned | limit 前与 limit 后的行数；show/info 为 1；compare 为输入记录数 |
| truncated | returned 小于 total |
| warnings | 结构化提示数组，每项固定 code/message/point_id（无对应点时 null） |

行结构：

| 命令 | rows 中每项 |
| --- | --- |
| price/allowance | rank + point + benchmark；rank 为完整排序中的 1 基位置 |
| query | point + benchmark，无 rank |
| show | point + benchmarks[]；无映射时为空数组，每个配置带自己的 board |
| compare | point + benchmark；保持输入顺序 |
| list | 对应资源对象，字段与命令参考中的表格一致，计数为数字，集合为数组 |
| info | 一个包含 snapshot、source、counts、conventions 的对象 |

point 独立提供 id、model/model_display、company/company_display、vendor、channel、plan_id/plan/plan_display、billing、price_usd、original_price/currency、monthly_tokens、real_usd_per_mtok、confidence、workload、data_date/data_date_kind/data_date_from、unmetered/promo_until、source、decision_note、evidence。保留需要的原始列表价与采用字段，不在格式化时改写数值。

benchmark=null 或完整解包的配置/映射对象，含 configuration_id、board、score、variant、agent_harness、reasoning_effort、service_mode、score_is_estimated、score_is_self_reported、mapping_confidence、quota_effort_matched、mapping_note、来源与其他原始配置字段。best 行在 benchmark 对象内附加 best_tie_count。未显式指定榜单的排名和 query 输出 benchmark=null；show 默认展示所有榜单不受此限制。

JSON/CSV 数值保持原始精度，JSON 的 null、布尔值保留类型；表格的美元符号、标题大小写、—、分数舍入和 effort 显示不改写这些机器可读字段。例如 billing 仍为 subscription / metered，confidence 仍为 high / medium / low，reasoning_effort 保留原始标识。字段名、标识和显示字段保持稳定，CLI 显示文本固定英文；原始来源证据不自动翻译。支持同 schemaVersion 内增加字段，删除字段或改变已有字段含义需提高版本。

### 6.2 JSON 输出示例

```sh
rap price --company Anthropic --model claude-sonnet-5.5 --channel Factory --format json
```

以下为核心字段节选；完整 point 还包含上面定义的来源和口径字段：

```json
{
  "schemaVersion": 1,
  "meta": {
    "command": "price",
    "resource": null,
    "snapshot": "2026-10-01",
    "source": "bundled",
    "sourcePath": null,
    "view": "price",
    "board": null,
    "boardSnapshot": null,
    "total": 1,
    "returned": 1,
    "truncated": false,
    "warnings": []
  },
  "rows": [
    {
      "rank": 1,
      "point": {
        "id": "droid_max::claude-sonnet-5.5",
        "model": "claude-sonnet-5.5",
        "model_display": "Claude Sonnet 5.5",
        "company": "Anthropic",
        "company_display": "Anthropic",
        "vendor": "Anthropic",
        "channel": "Factory",
        "plan_id": "droid_max",
        "plan": "Droid Max",
        "plan_display": "Droid Max",
        "billing": "subscription",
        "price_usd": 200,
        "monthly_tokens": 10104000000,
        "real_usd_per_mtok": 0.019794141,
        "confidence": "medium",
        "workload": "anthropic",
        "data_date": "2026-09-29",
        "unmetered": false,
        "promo_until": null
      },
      "benchmark": null
    }
  ]
}
```

### 6.3 CSV 固定列

CSV 为 UTF-8，默认无 BOM，使用标准引号/换行转义。null 为空白，布尔值为 true/false；数字直接输出。公式样式的来源文本须转义，ID 和数字不因文本保护而改变。数组/复合字段以 JSON 文本单元格表示。

价格记录命令共享以下固定列集；非排名的 rank 为空：

```text
rank,point_id,model,model_display,company,company_display,channel,plan_id,plan,plan_display,billing,price_usd,monthly_tokens,real_usd_per_mtok,confidence,workload,data_date,unmetered,promo_until,source,decision_note,evidence_json,board,configuration_id,score,benchmark_json
```

price/allowance/query/compare 每条结果一行；show 按 benchmarks 展开，缺配置时仍有一行价格信息。benchmark_json 保留完整配置/映射，其余榜单列是便利索引，无关联配置时为空；show 默认展示全部榜单时仍按每个配置填充 board、configuration_id 和 score。show JSON 的 meta.total/returned 仍表示 1 条详情，CSV 可能展开多个配置；CSV 的 stderr 另报 `exported_rows: N`。

CLI CSV 保持对应 CLI 命令的排序。网站排名视图的“Table · CSV”下载使用网站明细表排序，因此 allowance 下载也按真实单价排序；两者的固定列 schema 也不同。CSV 对齐验证按 Point ID 比较共享原始字段，并显式选择同一榜单（例如 aa_intelligence_index）对账配置引用字段；展开多个配置时以 configuration_id 进一步区分。验证的是字段数据，不是两个 CSV 文件逐字相同。

其他命令的列集：

```text
list models:    model,model_display,company,company_display,plans,channels,points
list companies: company,company_display,models,plans,points
list channels:  channel,models,plans,points
list plans:     plan_id,plan_display,channel,companies_json,models,points
list boards:    board,name,metric,snapshot,configurations
info:           snapshot,source,source_path,counts_json,conventions_json
```

使用 source=file 时，--data 路径相对调用者目录解析，meta.sourcePath 保存其绝对路径。CSV 只输出列头和数据；表格摘要、提示和错误不混入文件。每个命令的 table 例子见命令参考；JSON/CSV 均遵循这里的同一数据契约。

### 6.4 CSV 输出示例

```sh
rap price --company Anthropic --model claude-sonnet-5.5 --channel Factory --format csv
```

stdout 为下面完整的固定列头与一条记录；来源中文保持原文，空榜单列表示未显式选择榜单：

```csv
rank,point_id,model,model_display,company,company_display,channel,plan_id,plan,plan_display,billing,price_usd,monthly_tokens,real_usd_per_mtok,confidence,workload,data_date,unmetered,promo_until,source,decision_note,evidence_json,board,configuration_id,score,benchmark_json
1,droid_max::claude-sonnet-5.5,claude-sonnet-5.5,Claude Sonnet 5.5,Anthropic,Anthropic,Factory,droid_max,Droid Max,Droid Max,subscription,200,10104000000,0.019794141,medium,anthropic,2026-09-29,false,,由同套餐 claude-opus-5.5 50.52 亿 × 2.0,Factory官方倍率 Opus 5.5 1.6× / claude-sonnet-5.5 0.8×：同一 Standard Usage 池按倍率折算，非该模型实测；沿用 Opus 5.5 行 Anthropic 档负载，未按各模型自身价差重算；docs.factory.ai/docs/models；droid-model-multipliers-2026-09-29.json,"[{""label"":""droid-model-multipliers-2026-09-29.json"",""url"":""/data/evidence/droid-model-multipliers-2026-09-29.json""}]",,,,
```

stderr：

```text
Snapshot: 2026-10-01 | Source: bundled | View: price
Total: 1 | Returned: 1 | Truncated: false
exported_rows: 1
Order: USD/MTok ascending; ties by Point ID.
```

## 7. 空结果、错误和退出码

| 情况 | stdout | stderr | 退出码 |
| --- | --- | --- | ---: |
| 成功 | 所选格式的数据 | table/CSV 摘要或提示 | 0 |
| 合法查询无匹配 | table 为 No matching results；JSON 有效对象且 rows=[]；CSV 仅表头 | table/CSV 摘要 total=returned=0 | 0 |
| 无效参数/枚举/精确 ID | 空 | 参数诊断、必要的候选和用法 | 2 |
| I/O、无效/不支持的数据集 | 空 | 具体文件或数据错误 | 1 |
| 下游正常提前关闭管道（EPIPE） | 已消费部分 | 空 | 0 |

空 JSON 的 total=returned=0、truncated=false。检查所有输入并准备数据成功后才开始写 stdout，参数或数据错误不输出半份成功 JSON/CSV。--help/--version 固定输出英文纯文本，不加载数据，不受 format/data 影响。

示例：

```text
rap price --search 'not-a-real-model'
stdout: No matching results.
exit: 0

rap price --company Antropic
stdout: 空
stderr: error: Unknown company ID "Antropic". Did you mean "Anthropic"?
exit: 2

rap allowance --sort price:asc
stdout: 空
stderr: error: unknown option '--sort'（Commander 另附命令用法）
exit: 2

rap price --fee-band 0-30
stdout: 空
stderr: error: unknown option '--fee-band'（price 不定义该参数；Commander 另附命令用法）
exit: 2
```

错误示例使用固定英文提示。缺失必需的 --board、min 大于 max、重复 compare ID、无效 data version 也按上表处理。

## 8. 数据来源、口径和实现边界

当前数据已存储在仓库本地：

| 本地位置 | 内容 | 当前状态 |
| --- | --- | --- |
| data/adopted.csv | 当前采用的价格、额度、置信度与采用依据 | 已存在、由数据流程生成并提交 |
| derived/points.json | 计算后的价格点与额度 | 已存在并提交 |
| derived/benchmark-configurations.json | 完整评测配置 | 已存在并提交 |
| derived/benchmark-points.json | 价格点与评测配置的映射 | 已存在并提交 |
| data/conventions.json | 负载、汇率与快照口径 | 已存在并提交 |
| web/public/data/site.json | 网站适配后的单文件查询快照 | 当前环境已生成，Git 忽略 |
| cli/data/site.json | CLI 包携带的查询快照 | 构建时生成，Git 忽略；npm pack 随包携带 |

首版打包时把经校验的 site.json 放入 cli/data/site.json，随 CLI 包分发，默认直接读取这个本地文件。--data 可选择另一份本地同格式快照；例如在仓库根目录用 `rap price --data ./web/public/data/site.json --company Anthropic`。查询不自动联网、不重算采用值、不修改数据，也不自动下载缺失文件；无法读取快照按 I/O 错误退出。

快照更新随重新生成数据及打包完成，内置数据随 CLI 包版本更新；用户也可用 --data 使用更新的本地快照。程序、数据集和输出 schema 的版本分别管理。

网站与 CLI 共用 scripts/lib/build-site-data.mjs 的采用值校验与数据适配；各自注入 csv-parse，不要求安装另一端的依赖。site.json 的 mappings 是压缩格式，加载时按 web/src/loadData.ts 的 unpackData 规则恢复。检查版本、必需字段、数字有限性、ID 唯一性与引用完整性。配置 ID 只保证当前快照内可引用。

网站行为依据：web/src/domain.ts 的 visiblePoints、rowsFor、tableRows、manufacturer、displayPlan、price、allowance，以及 web/src/Ranking.tsx 的固定排名。不能用图表 groups/searchMatches 替代基础价格查询，否则会丢失无分点。

口径：订阅真实单价是用满额度的价格下限；同套餐多模型额度为替代使用。保留负载档、原币价格、数据采样日期、confidence、来源与采用说明；促销过期只提示需复核，不编造新价。榜单互相独立，分数是公开配置映射，不是套餐实测结论。

要求 Node.js 22.12+。cli/ 为独立 TypeScript 包，Commander 提供子命令、参数解析及帮助；cli-table3 输出表格，string-width 与 wrap-ansi 处理显示宽度和完整文本换行，csv-stringify 输出 CSV，Zod 校验快照；esbuild 生成可运行的 ESM，tsx + node:test 执行测试。运行时不依赖 React/Vite/Python。数据路径相对安装模块定位，--data 相对调用目录。npm 发布是独立操作；当前只提供仓库构建与本地 tarball 安装。

## 9. 验收与回归检查

已使用 Playwright Chromium 加载原 HTTPS 网站的 HTML、JavaScript、CSS 和数据，完成 61 个场景、累计 5,176 行的 DOM 对比；记录、排序及 model、plan、access、price、allowance、fee、confidence、score、config 共享显示字段均无差异，浏览器 page、console、resource errors 均为 0。范围覆盖全部 18 个公司的 price/allowance、月费档位、Factory 渠道、整段子串搜索、8 个榜单的 table、全部配置展开（694 行）、effort、API 与空结果。

另核对了 6 条详情中的 18 个评测配置、4 份网页下载 CSV 的 484 行共享原始字段，以及 390×844 移动视口下两个排名页面的搜索交互，均通过。详情按配置身份匹配，CSV 对账遵循上文的字段与排序契约；这些检查不要求终端布局或导出文件字节与网页相同。

此前线上与内置 site.json 的 SHA-256 均为 `1b383316d85039460ba9862a04253b53ef1ac933bb17d1469bdc1ecd45c92c18`，上述线上验证对应 2026-10-01 快照。合并主仓库后，2026-10-02 的 CLI、网站及主仓库原版构建脚本所生成快照逐字节一致，SHA-256 为 `19f2115699786d596d32bd08c1f8f0da45517a176700047415bf6275b7f67e70`；英文来源译文、评测记录说明与档案元数据完整保留。原始 source/note/decision_note 不变，JSON 同时保留上游的 source_en/note_en/decision_note_en 等译文字段；网页英文导出的来源列使用译文，CLI CSV 的 source 列仍按原始文本契约导出。CLI 查询仍从本地文件读取，不会自动刷新线上数据。

1. 同快照、同筛选条件下，price/allowance 的有序 Point ID 列表与网页一致，不只比较数量。
2. Model、Company、Channel、Plan 在所有价格输出中独立，JSON/CSV 标识稳定。
3. company/vendor 别名同维度合并，第三方渠道仍进入开发商筛选；档位边界与网页一致。
4. 整段搜索、无分点、API/null、促销、同价并列及 limit 顺序正确。
5. table 的配置展开、前沿、空结果与缺分规则明确，排名别名结果完全一致。
6. JSON 可解析，CSV 正确转义，stdout/stderr 分离，退出码和 EPIPE 正确。
7. 打包后任意目录离线使用，现有网站测试与构建仍通过。

示例数量是当前快照事实：318 points、74 models、18 companies、95 plans、17 channels、8 boards、330 configurations、1854 mappings。Anthropic price=29、allowance=24；月费档位 all=24、0-30=6、30-100=5、100-300=13。实现与测试不把这些数量作为永久常量。
