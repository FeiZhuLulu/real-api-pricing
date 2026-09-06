# 待定采用决策备忘（更新 2026-09-06）

> 注：本会话仅收集信息。Claude 部分已由另一会话落库（build_adopted.py round6），本备忘改为记录"已落库 vs 仍待定"状态。

## 已落库（build_adopted.py，2026-09-06 另一会话）

- claude_max_20x / opus-5：**157 亿/月**（9/14 永久口径；skipbit boost 期 47.2 亿/周 ×4 ÷1.5×1.25；区间 110~200；medium）
- claude_max_5x / opus-5：**78.5 亿/月**（157÷2，用户确认周池比 2；旁证：6/14 诉讼材料「20x≈6~8×Pro、5x≈3.5×Pro」同向）
- 派生随行：20x→sonnet-5 392.5 亿、opus-4.8 157 亿、fable-5 12.08 亿；5x→sonnet-5 196.25 亿、fable-5 9.24 亿
- claude_pro：保留 Opus 4.8 旧测 **15.88 亿**（Opus 5 候选 ~1.9 亿未获确认）

## 仍待定 / 证据缺口

- **claude_pro Opus 5**：全网无 token+% 实测；候选 ~1.2~2.4 亿/月（消息口径，low）。另需确认 Pro 档是否含 Opus 5。
- **claude_max_5x Opus 5 独立实测**：#79773 消息口径 ~4~5.4 亿/月与派生 78.5 亿差 ~15×，矛盾未解。
- **Gemini**：全部不进库。孤证 Pro ~40 亿/月、Ultra5x ~200 亿、Ultra20x ~800 亿（r/LLMDevs，low）。本机 Antigravity 可测但 token 计数在 protobuf blob 里，需解码器或第三方工具；quota API 因 agy 凭据失效暂不可读（scripts/agy_quota_probe.py 已备好）。
- **ChatGPT**：Plus 6.16 亿维持（Observatory 折回 7.18 亿同量级）；Pro5x 30.8 亿（候选 35.9）；Pro20x 123.2 亿（三锚 109/131/144 亿，现行居中）。
- **本机 codex rollout 反推**：作废（用户确认账号频繁被 OpenAI 重置，% 与 token 失步）；仅证明机制可行。

## 「GPT 20x 200 亿/月」说法的裁决

非 raw token 实测；最可能是 SemiAnalysis $14k/月 API 等效的高缓存折算（~199 亿）。raw 口径 GPT Pro20x 实测 109~144 亿/月，与 Claude Max20x 157 亿同量级。

## 来源文件

claude-quotas-round5-2026-09.json、gemini-quotas-round5-2026-09.json、chatgpt-quotas-round5-2026-09.json、chatgpt-local-round5-2026-09-06.json（low，重置污染）、quota-round6-2026-09-06.json、claude-adoption-round6-2026-09-06.json
