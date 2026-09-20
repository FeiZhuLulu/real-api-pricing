# DECISIONS.md · 采用值决策记录

`AGENTS.md` 只放工作规则；本文件记录每条采用值的取舍（旧值 → 新值 → 依据 → 未采来源）。
最权威的表述仍在 `scripts/build_adopted.py` 的 `decision_note` 和 `data/research/` 证据文件里；本文件是按时间的索引摘要。改数只能改 `build_adopted.py`，改完在这里同步记一笔。

## 2026-09-20

- **Claude Fable 5.1（新增订阅点）**：Max 20x = 30.06 亿/月 medium。用户提供同日同框样本：2443 轮 285.6M raw（cache 读 283M + 输出 2.6M）→ /usage 周额度 0%→19%；次日 3017 轮→24% 线性互验（预测 23.5%）。算式 285.6M÷19%×50% 周帽×4 周；隐含权重 ≈2.61×Opus（远低于 Fable5 的 6.5×，与 cache read $1→$0.25 降价方向一致）。input/cache_write 未入样本，低估约 3~10%。Max 5x = 15.03 亿/月 low（借 20x 隐含权重派生，非独立实测）。混合计价口径（Fable 50% + 余下 50% 跑 Opus：20x ≈108.6 亿/月、5x ≈54.3 亿/月）只作概念存档——非单一服务模型、无榜分，不挂点。证据：`data/research/claude-fable51-round3-2026-09-20.json`。
- **ChatGPT Astra Pro 20x（新增，推翻 round12"暂不挂点"）**：38.43 亿/月 medium = 周池 9.61 亿×4 周，**四条外部实测源加权**（用户确认 round10 的 10% 与 Pro 20x 档位真实后由"不采"改为入权；用户自测 ≈32 亿/月与 lichengzhe 网关 21~23 亿按用户指示不入权）：Observatory 8.53 亿/周×3、round10 截图 13.8 亿×3、round13 g5a 同框 7.52 亿×3、V2EX msg7086 8.07 亿×2 = 105.69/11。纯口述（Tequila 10~20、LumioAI ~18、Reism4k ~20）与仅下限源（sdmat>8、g8≥7.09）不进均值。同源真实测量仍散布 6.8~15.6 亿/周——账号间池子可能本就不同，此值是加权中心而非普适常数。隐含权重 ≈3.2×Sol。Pro 5x = 9.61 亿/月 low（÷4 沿用 Sol 档间比例；prolite 同框 9.2 亿/月量级接近但多代理放大，不直接采）。Plus 1.59 亿不变（本批 Plus 同框散布 1.28~3.0 亿/月，同量级）。证据：`data/research/chatgpt-astra-sameframe-round13-2026-09-20.json`、`chatgpt-astra-round12-2026-09-16.json`。

## 现行采用决策（自 AGENTS.md 迁入，原始日期见各 research 文件）

- **Cursor**：Ultra 标准 Grok 4.6 采用 77.37 亿/月：用户当前平滑账号标准主行 67.78 亿与社区 8 月 26 日标准主行 86.95 亿取中间值；Fast 采用用户当前账号大样本 863.8M/28.1%=30.74 亿；Pro+ 采用 `77.37×800/3000=20.632` 亿，Composer 两模式随动。两图均在 8 月 25 日永久扩池后；社区图可能因首周半价用量集中而略高。现行决策见 `data/research/cursor-adoption-round8-2026-09-06.json`；round6/7 为历史证据，不覆盖。Cursor 与 SuperGrok 是不同渠道。
- **Kimi**：¥49 无 K3 调用权限，用户已确认仅排除该档 K3 点；K2.7 Standard 所有会员可用。Kimi 月池是周池的 5 倍，不能套项目通用 4 周。K3 采用：¥199 为 14.51 亿/月（K3-256K 为主的混合样本，不能宣称纯 K3 1M），¥99/¥699 按 4/20 与 60/20 派生。K2.7 Standard 采用：¥199 纯模型面板 15.68 亿/月、medium，可信范围约 15.6~16.7 亿；¥49/¥99/¥699 按官方 1/20、4/20、60/20 派生为 0.78/3.14/47.04 亿。HighSpeed 与 K2.6 暂无当前可采用值。
- **Claude Max**：按 2026-09-14 起永久口径估算：20x=157 亿/月（参考 110~200 亿，单点 medium），5x=157/用户确认周池比 2=78.5 亿；不要误用 5h 窗口倍数或旧 2.25 比。见 `claude-adoption-round6-2026-09-06.json`。（后续更新：Pro 档 Opus5 已被 round8 shownotover 面板反推 18.78 亿取代，见 adopted decision_note；旧"Pro 约 1.9 亿未获确认"的表述作废。）
- **GLM Coding Plan**：按官方周积分和三段积分系数套统一标准负载，忙时 1×、中间值 1.5×、闲时 2× 分别作为独立情景点，不互相替代。
- **Gemini/Google**：暂无可靠采用值，不补点、不再探测账户额度。
