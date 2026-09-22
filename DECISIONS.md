# DECISIONS.md · 采用值决策记录

`AGENTS.md` 只放工作规则；本文件记录每条采用值的取舍（旧值 → 新值 → 依据 → 未采来源）。
最权威的表述仍在 `scripts/build_adopted.py` 的 `decision_note` 和 `data/research/` 证据文件里；本文件是按时间的索引摘要。改数只能改 `build_adopted.py`，改完在这里同步记一笔。

## 2026-09-22

- **SuperGrok · Grok 4.7（round2 修订）**：6.72→4.97 亿/月 medium；Plus 26.9→19.9 亿、Heavy 67.2→49.7 亿按面板美元比派生 medium；Lite 不派生。round2 本机实测（Grok Build CLI，xhigh）：「这次」窗 56,629,383 tok = 周额度 +45.5475% → 周池 124,330,387（三窗反推 176.1M/124.3M/132.1M，用户裁定中间窗最可信——份额大、取整误差占比小）。对 4.6 基准（1.273 亿/周）为 0.98× 同量级——round1 的 1.32× 系删除版份额推断偏高，已取代。两窗反推不重合（176 vs 124），池口径或面值有未解变量；n=1 账号维持 medium。分数由 `scores-grok47-round1-2026-09-22.json` 补充档从 AA round4 未映射载荷提升：int 46.4466 / coding(Grok Build) 56.2676；TB4/Arena/OpenDesign 无 4.7 行不画。两榜均未进前沿（Claude Pro Opus5 $0.0106 支配）。证据：`data/research/supergrok-grok47-round2-2026-09-22.json`（round1 档保留作历史对照）。
- **MiMo V2.6 系列 + Grok 4.7（9/21 发布）基准分数补录**：supplement 文件 `data/research/scores-mimo-v26-grok47-round1-2026-09-22.json`——Grok 4.7：TB4 Grok Build 37.6%±3.5（rank 6，tbench.ai 官方）；MiMo V2.6 Pro：AA Intelligence=46（$0.13/task，130tps）。AA Intelligence xhigh/high 与 AA Coding xhigh 已由 `scores-grok47-round1-2026-09-22.json`（supergrok 实测同批）按 round4 原始精度提升，本档不再重复。两模型均未上 Code Arena / Agent Arena / OpenDesign（快照早于发布日），MiMo 未上 TB4/AA Coding Agent——缺分即缺分，不补造。xAI/小米自报分仅进 vendorBenchmarksNotBoards（CursorBench 46.3、DeepSWE 71.0/71.9、TB4 38.0、EEBench 66.0、GDPval-AA 58.7、HLE 49.4% 等），TB2.1=87.6 系旧版不入 TB4 榜。AA 双榜线上版本（v4.3.2 / v1.5）已比仓库快照新，supplementNote 已注明。
- **Grok 4.7 套餐/按量采纳行**：SuperGrok 独立双行结构（4.6 旧池行保留 + 4.7 新池实测行，见上条）。OpenCode Go、GOAT、xAI API 各加 grok-4.7 行（与 4.6 同价 $0.5/$2/$6 ≤200K；GOAT 按日常基准 $20，限时提额 $35 至 9/27 不采）。Cursor 行维持 grok-4.6 不动——套餐内旗舰换装属未证实推断，不采纳。证据：`mimo-v26-grok47-catalogs-round1-2026-09-22.json`、`list-prices-mimo-v26-grok47-round1-2026-09-22.json`。
- **MiMo Token Plan（新套餐点，32 行）**：Lite/Standard/Pro/Max 月池 4.1B/11B/38B/82B Credits ÷ 统一标准负载混合 burn 率折 token——计费本体是共享 Credits 池 + 分模型分类型 burn 率（v2.6-pro/v2.5-pro cached/input/output=2.5/300/600，v2.6-flash/v2.5=2/100/200 credits/token），不是固定美元面值额度。¥ 国内价与 $ 国际价同档同池，按 Kimi 先例国内外并点、$ 标价展示（¥39/99/329/659 记入注）。夜间 00:00–08:00（北京）consumption×0.8 → 日/夜两情景点（GLM/DeepSeek 闲时同型）。覆盖 v2.6-pro/v2.6-flash/v2.5-pro/v2.5 四款文本模型（V2.6 于发布次日列入官方清单，用户订阅页截图互证；ASR 按时长、TTS 免费不画）；耗尽即停不透支；首购/年付 88 折不采。证据：`mimo-token-plan-round1-2026-09-22.json`。
- **MiMo V2.6 按量 API + 目录点**：mimo_v26_pro/flash/pro_ultraspeed API 行（$0.0036/0.435/0.87、$0.0028/0.14/0.28、$0.036/4.35/8.70——OpenRouter/GOAT/OpenCode 三渠道一致，官方计价页未列 V2.6）；UltraSpeed 按 Pro 10×（GOAT 文档官方明示）。OpenCode Go +2（flash $60 Usage、pro $15）、GOAT +4（grok-4.7 $20、mimo flash $30、mimo pro $20、ultraspeed $10；GOAT 限时 promo $35/$67 至 9/24–27 一律不采）。
- **审计**：采用 202→260 行（订阅 242：241 有额度 + 1 不计额度；按量 18）。plot_quotas.py 补 Xiaomi vendor 映射/颜色/代号（#FFA000）。

## 2026-09-21

- **Google AI Pro · Gemini 3.8 Flash（首个 Google 采用点）**：22.41 亿/月 high。用户本地实测：B 整段 55.343M raw（cache 45.688M/输入 9.258M/输出 0.398M）= 周条 +9.88% → 周池 5.60 亿 raw ×4 周。官方按 API worth 合池计权（段内实证：B1:B2 的 %比 0.405 ≈ worth比 0.407，而非 raw比 0.448；周帽合 $120.1 worth），故 raw 额度随负载 mix 变——本样本 cache 82.6%，用户指出 Gemini 实际负载打不到标准口径的 97.5% cache，故采 raw 实测口径（标准负载折算 46.9 亿/月偏高弃用）。Ultra 5x/20x 按官方 worth 倍率派生 112.05/448.2 亿（low）。旁证：round6 的 5h 锚 $20.4 → 周≈5.9 sprint；LLMDevs Pro ~1.0B/周、Ultra ~5.0B/周同量级。证据：`data/research/gemini-weekly-round7-2026-09-21.json`。

## 2026-09-20

- **Claude Fable 5.1（新增订阅点）**：Max 20x = 30.06 亿/月 medium。用户提供同日同框样本：2443 轮 285.6M raw（cache 读 283M + 输出 2.6M）→ /usage 周额度 0%→19%；次日 3017 轮→24% 线性互验（预测 23.5%）。算式 285.6M÷19%×50% 周帽×4 周；隐含权重 ≈2.61×Opus（远低于 Fable5 的 6.5×，与 cache read $1→$0.25 降价方向一致）。input/cache_write 未入样本，低估约 3~10%。Max 5x = 15.03 亿/月 low（借 20x 隐含权重派生，非独立实测）。混合计价口径（Fable 50% + 余下 50% 跑 Opus：20x ≈108.6 亿/月、5x ≈54.3 亿/月）只作概念存档——非单一服务模型、无榜分，不挂点。证据：`data/research/claude-fable51-round3-2026-09-20.json`。
- **ChatGPT Astra Pro 20x（round14 并入新批次）**：38.12 亿/月 medium = 周池 9.53 亿×4 周，**八条实测源加权**（round10 经用户确认后入权；用户自测 ≈32 亿/月与 lichengzhe 网关 21~23 亿按用户指示不入权）：Observatory 8.53×3、round10 截图 13.8×3、round13 g5a 同框 7.52×3、round14 用户面板满周 10.0×3、V2EX msg7086 8.07×2、round14 图4（2/3周）8.18×2、图2自述 9.25×1、图3后台 10.3×1 = 171.6/18。纯口述与仅下限源不进均值。round14 新增 worth 口径：周池≈$1200~1500 list-worth（Astra），同池 Sol $2200~2500——内部计权对 Astra 惩罚 ~1.9×，与 w≈3.2× 反推同向。同源真实测量散布 6.8~15.6 亿/周，加权值是中心而非普适常数。Pro 5x = 9.53 亿/月 low（÷4 沿用 Sol 档间比例）。Plus 1.59 亿不变。证据：`chatgpt-astra-round12/13/14`。

## 现行采用决策（自 AGENTS.md 迁入，原始日期见各 research 文件）

- **Cursor**：Ultra 标准 Grok 4.6 采用 77.37 亿/月：用户当前平滑账号标准主行 67.78 亿与社区 8 月 26 日标准主行 86.95 亿取中间值；Fast 采用用户当前账号大样本 863.8M/28.1%=30.74 亿；Pro+ 采用 `77.37×800/3000=20.632` 亿，Composer 两模式随动。两图均在 8 月 25 日永久扩池后；社区图可能因首周半价用量集中而略高。现行决策见 `data/research/cursor-adoption-round8-2026-09-06.json`；round6/7 为历史证据，不覆盖。Cursor 与 SuperGrok 是不同渠道。
- **Kimi**：¥49 无 K3 调用权限，用户已确认仅排除该档 K3 点；K2.7 Standard 所有会员可用。Kimi 月池是周池的 5 倍，不能套项目通用 4 周。K3 采用：¥199 为 14.51 亿/月（K3-256K 为主的混合样本，不能宣称纯 K3 1M），¥99/¥699 按 4/20 与 60/20 派生。K2.7 Standard 采用：¥199 纯模型面板 15.68 亿/月、medium，可信范围约 15.6~16.7 亿；¥49/¥99/¥699 按官方 1/20、4/20、60/20 派生为 0.78/3.14/47.04 亿。HighSpeed 与 K2.6 暂无当前可采用值。
- **Claude Max**：按 2026-09-14 起永久口径估算：20x=157 亿/月（参考 110~200 亿，单点 medium），5x=157/用户确认周池比 2=78.5 亿；不要误用 5h 窗口倍数或旧 2.25 比。见 `claude-adoption-round6-2026-09-06.json`。（后续更新：Pro 档 Opus5 已被 round8 shownotover 面板反推 18.78 亿取代，见 adopted decision_note；旧"Pro 约 1.9 亿未获确认"的表述作废。）
- **GLM Coding Plan**：按官方周积分和三段积分系数套统一标准负载，忙时 1×、中间值 1.5×、闲时 2× 分别作为独立情景点，不互相替代。
- **Gemini/Google**：暂无可靠采用值，不补点、不再探测账户额度。
