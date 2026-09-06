# -*- coding: utf-8 -*-
"""生成 data/adopted.csv：每个 (套餐, 实际服务模型) 一行，一个采用值。

所有取舍在这里写死并注明理由；原始多源数据留在 data/subscription-quotas*.json 不动。
真实单价 = 月费(USD) / 月 token（全口径：输入+缓存读+缓存写+输出一视同仁，月=4周，饱和使用）。
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "adopted.csv"
CONVENTIONS = json.loads((OUT.parent / "conventions.json").read_text(encoding="utf-8"))
USD_PER_CNY = CONVENTIONS["usdPerCny"]
YI = 1e8
CURSOR_ULTRA_FAST_YI = 30.3
CURSOR_ULTRA_STANDARD_YI = (CURSOR_ULTRA_FAST_YI * 2 + 67.8) / 2
CLAUDE_MAX_20X_YI = 157.0
CLAUDE_WEEKLY_20X_TO_5X = 2

# 本机 ccusage 2026-07 实测 agent 工作负载 token 分布，用于把按量 API 三段价折成一个混合价
MIX = dict(cache=406_477_401 / 416_989_306, input=9_040_062 / 416_989_306, output=1_471_843 / 416_989_306)

# ---- 订阅：(plan_id, plan_name, price, currency, served_model, monthly_yi, confidence, source, decision_note)
SUBS = [
    # OpenAI —— Sol 为基准；Terra/Luna/5.5 在 DERIVED 按输入、缓存、输出 credits 混合比换算
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-5.6-sol", 6.16, "medium", "awesome-coding-plan 2026-07-30 实测", ""),
    ("chatgpt_pro_5x", "ChatGPT Pro 5x", 100, "USD", "gpt-5.6-sol", 30.8, "medium", "Plus × 官方 5x", "flat.json 写 38.9 与官方 5x 不符，改 30.8"),
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-5.6-sol", 123.2, "high", "Plus × 官方 20x", "用户拍板 123.2；两个独立印证：OpenAI 社区健康周 7.87 亿 = 24% → 131 亿/月；《财经》2026-08 跑满实测 109 亿/月；文章 200 亿作废"),
    # Anthropic —— Pro保留Opus4.8历史实测；Max采用9/14永久口径估算157亿，非当期boost或纯Opus5硬上限
    #   5x/20x是5h窗口倍率；用户明确20x周池仅为5x的2倍，旧2.25周池比例不再采用
    ("claude_pro", "Claude Pro", 20, "USD", "claude-opus-4.8", 15.88, "medium", "awesome-coding-plan 实测", "Opus4.8历史实测保留，现服务Opus5未重测；round5候选Opus5约1.9亿依赖假定周消息数，用户未确认，不作为实测收紧证据"),
    ("claude_max_20x", "Claude Max 20x (9/14+)", 200, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI, "medium", "Zenn skipbit实测+用户永久口径；claude-adoption-round6-2026-09-06.json", "旧80亿→157亿，9/14起永久口径：47.2亿/周×4÷1.5×1.25≈157；参考区间110~200亿，单点medium。混合模型及非完全同窗样本，非纯Opus5实测硬上限；不取活动期189或裸基准126；历史413/117等旁证保留，不直接采用"),
    ("claude_max_5x", "Claude Max 5x (9/14+)", 100, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI / CLAUDE_WEEKLY_20X_TO_5X, "medium", "用户明确20x周池仅为5x的2倍；claude-adoption-round6-2026-09-06.json", "旧35.6亿→78.5亿，9/14起永久口径157÷2；low→medium按用户确认周池关系推算，非独立实测；不采用36亿消息数候选或70亿/旧2.25倍率；5h窗口4倍关系不套周池"),
    # xAI —— 面板周额度（用户面板：Super $25 / Plus $100 / Heavy $250）是 Grok 自己的额度美元，不等于公开标价美元
    #   （linux.do 按标价记出 Super $90~110 / Heavy $900，比例相同、整体 3.6×）。所以不用标价换算，而用 Super 档实测 token 标定：
    #   V2EX 受控打满 1.27 亿/周 ÷ $25 = 面板 $1 ≈ 508 万 token，再套到 Plus / Heavy。
    ("supergrok", "SuperGrok", 30, "USD", "grok-4.6", 5.09, "high", "V2EX 受控打满实测（非双倍周）1%→100% 新增 1.27 亿/周 ×4", "面板周额度 $25；同帖双倍活动周 2.45 亿/周不采；linux.do 另测 1.44 亿/周同量级"),
    ("supergrok_plus", "SuperGrok Plus", 100, "USD", "grok-4.6", 20.4, "medium", "面板周额度 $100 × Super 标定 508 万 token/$ ×4", "linux.do 用户口述「每用一刀涨 1%」→ 周 $100 吻合"),
    ("supergrok_heavy", "SuperGrok Heavy", 300, "USD", "grok-4.6", 50.9, "medium", "面板周额度 $250 × Super 标定 508 万 token/$ ×4", "= Cursor 最初记录的周 12 亿；标价换算 18 亿作废（面板美元≠标价美元）；Zhang $11.5k/月 → 208 亿未采"),
    ("supergrok_lite", "SuperGrok Lite", 10, "USD", "grok-4.6", 1.5, "low", "aa_grok_build_2026_07", "面板周额度未知，三轮联网均无"),
    # Cursor —— Ultra 用用户 2026-08-11~09-11 面板截图反推：grok-4.6-xhigh 61.0M = 0.9% → 池 67.8 亿（取整区间 64~72）；
    #   xhigh-fast 839.5M = 27.7% → 30.3 亿。Fast 官方标价 $4/$1/$12 = 标准 2×，实测扣费比 2.24×。
    #   交叉验证：839.5M Fast × 混合标价 $1.104 ≈ $927 = 27.7% → 池 ≈ $3,345，与 CellCog 报的 $3,000 同量级。
    #   Pro保留独立面板采用值；Pro+按$800/$3000池比，从round6标准中间值64.2亿反推。
    ("cursor_ultra", "Cursor Ultra", 200, "USD", "grok-4.6", CURSOR_ULTRA_STANDARD_YI, "medium", "截图两行中间值+官方2×；cursor-fast-round6-2026-09-05.json；cursor-adoption-round6-2026-09-06.json", "100亿→64.2亿：(30.3×2+67.8)/2；旧链：口头100→截图67.8→round5恢复100→本次用户放弃100采用64.2。high→medium：中间值而非直接实测；64.2/30.3≈2.119，非严格2×；截图跨发布促销周，双倍额度/折扣混杂未剥离；旧100亿及截图冲突证据保留"),
    ("cursor_ultra_fast", "Cursor Ultra (Fast)", 200, "USD", "grok-4.6", CURSOR_ULTRA_FAST_YI, "high", "截图839.5M / 27.7%直接反推；round6用户确认维持", "保持30.3亿；官方2×折回标准等效60.6亿，与标准截图67.8亿取中间值64.2亿；并非声称64.2/30.3严格等于2；截图跨促销周，保留混杂风险；见cursor-fast-round6-2026-09-05.json；与SuperGrok渠道分开"),
    ("cursor_pro", "Cursor Pro", 20, "USD", "grok-4.6", 4.7, "medium", "Cursor 论坛面板：303.9M = 65% → 4.68 亿；另有用户口述 4~5 亿打满", "保留独立面板采用4.7亿，不随Ultra中间值联动；池按compute cost计非raw token"),
    ("cursor_pro_plus", "Cursor Pro+", 60, "USD", "grok-4.6", CURSOR_ULTRA_STANDARD_YI * 800 / 3000, "medium", "round3面板Pro+池约$800；round6用户确认按Ultra池$3000等比", "18.1亿→17.12亿：64.2×800/3000；旧18.1亿基于Ultra67.8亿，现随标准中间值重算；仍采用$3000池假设，未采$3345或旧$2000替代池；促销周混杂未剥离；见cursor-adoption-round6-2026-09-06.json"),
    # Kimi 国内 —— 199 档本机 ccusage 反推，其余按官网倍率 1x/4x/20x/60x
    ("kimi_allegretto_cn", "Kimi 会员 199", 199, "CNY", "kimi-k3", 11.61, "medium", "本机ccusage 243739068/约84%×4；kimi199-round5-swe17-2026-09-05.json", "额度11.61亿不变，high→medium：占比为用户约数，样本以k3-256k为主且含kimi-for-coding，非纯K3 1M实测；SWE1.7找到V2EX/1235826短时面板，但模型/统计窗口不同，未替换基准；官方K3 1M约2×消耗，不据混合样本直接折半；ACP14.28为旧模型未采；《财经》95元/亿档位不明未采"),
    ("kimi_moderato_cn", "Kimi 会员 99", 99, "CNY", "kimi-k3", 2.32, "medium", "199 档 × 4/20", "保持2.32亿，继承199档K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    ("kimi_andante_cn", "Kimi 会员 49", 49, "CNY", "kimi-k3", 0.58, "medium", "199 档 × 1/20", ""),
    ("kimi_allegro_cn", "Kimi 会员 699", 699, "CNY", "kimi-k3", 34.83, "medium", "199 档 × 60/20", "保持34.83亿，继承199档K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    # Kimi 海外 —— 不画：官方 Code credits 倍率 1×/5×/15×/30× 与国内 1/4/20/60× 体系不同，且无绝对 token 证据
    # 智谱 —— 官方 95% 缓存周表（亿/周）：下限=全峰时，上限=全非峰(×0.5 积分)。取中位 ×4 周。
    #   新客 V3：Lite 118 / Pro 538 / Max 1078；老客 V2 续费：49 / 149 / 469（额度同表，2026-07-31 官方说明）
    *[(f"glm_coding_{tier}_cn_{who}", f"GLM Coding {tier.title()} ({label} ¥{price})", price, "CNY", model, round((lo + hi) / 2 * 4, 2), "high",
       "docs.bigmodel.cn 官方 95% 缓存表中位 ×4", f"官方周区间 {lo}～{hi} 亿")
      for tier, tiers in (("lite", {"glm-5.3": (0.48, 0.97), "glm-5.3-flash": (1.46, 2.92)}),
                          ("pro", {"glm-5.3": (2.90, 5.80), "glm-5.3-flash": (8.77, 17.55)}),
                          ("max", {"glm-5.3": (6.76, 13.52), "glm-5.3-flash": (20.47, 40.95)}))
      for who, label, price in (("new", "新客", {"lite": 118, "pro": 538, "max": 1078}[tier]),
                                ("old", "老客", {"lite": 49, "pro": 149, "max": 469}[tier]))
      for model, (lo, hi) in tiers.items()],
    # MiniMax —— 官方绝对月 token：国内 M3 发布文 + 2026-08 迁移说明；海外 M3 发布文（当时 $20/$50/$120，现价 $22/$55/$132）
    ("minimax_token_plus_cn", "MiniMax Token Plan Plus", 49, "CNY", "minimax-m3", 6.0, "high", "minimaxi.com/blog/minimax-m3 官方", ""),
    ("minimax_token_max_cn", "MiniMax Token Plan Max", 119, "CNY", "minimax-m3", 18.0, "high", "minimaxi.com/blog/minimax-m3 官方", ""),
    ("minimax_token_ultra_cn", "MiniMax Token Plan Ultra", 469, "CNY", "minimax-m3", 71.0, "high", "platform.minimaxi.com 迁移说明 2026-08-19", "发布时 55 亿，迁移后 71 亿"),
    ("minimax_token_plus_global", "MiniMax Token Plan Plus (Global)", 22, "USD", "minimax-m3", 17.0, "high", "minimax.io/blog/minimax-m3 官方", "发布时 $20，现价 $22，额度未见调整"),
    ("minimax_token_max_global", "MiniMax Token Plan Max (Global)", 55, "USD", "minimax-m3", 51.0, "high", "minimax.io/blog/minimax-m3 官方", "发布时 $50"),
    ("minimax_token_ultra_global", "MiniMax Token Plan Ultra (Global)", 132, "USD", "minimax-m3", 98.0, "high", "minimax.io/blog/minimax-m3 官方", "发布时 $120"),
    # 阿里 —— 《财经》2026-08 用 OpenCode 跑满周额度实测：阿里云套餐旗舰模型 ¥101/亿 → ¥200 ÷ 101 ≈ 1.98 亿/月。SubPlan 的 30 亿无实测依据，作废
    ("aliyun_coding_pro_cn", "阿里云百炼 Coding Plan Pro", 200, "CNY", "qwen3.7-plus", 1.98, "medium", "《财经》2026-08 实测 ¥101/亿", "档位未写明，按 ¥200 Pro 折算；旧值 30 亿作废"),
    ("aliyun_coding_pro_global", "Alibaba Cloud Coding Plan Pro", 50, "USD", "qwen3.7-plus", 1.98, "low", "同 CN 档额度", ""),
    # OpenCode Go —— 官方表：月请求数 × 官方"典型请求" token 假设（opencode.ai/docs/go 2026-09-04）
    *[("opencode_go", "OpenCode Go", 10, "USD", model, round(req * tok / YI, 3), "medium",
       f"https://opencode.ai/docs/go/ 官方典型估算 {req:,} req/月 × {tok:,} tok/req", "额度数不变，high→medium：官方典型请求估算，不是硬token上限；美元池$12/5h $30/周 $60/月，另有per-model上限；《财经》OpenCode为测试客户端，未测Go套餐，不作为独立佐证；见fx-caijing-round5-2026-09-05.json")
      for model, req, tok in (
          ("grok-4.6", 845, 390 + 32_500 + 120), ("gpt-5.6-luna", 10_250, 1_000 + 50_000 + 220),
          ("glm-5.3-flash", 7_900, 1_000 + 55_000 + 200), ("glm-5.3", 1_080, 700 + 52_000 + 150),
          ("kimi-k3", 490, 1_050 + 76_500 + 300), ("kimi-k2.7-code", 6_750, 870 + 55_000 + 200),
          ("minimax-m3", 16_000, 510 + 56_000 + 190), ("qwen3.7-plus", 21_600, 500 + 57_000 + 190),
          ("deepseek-v4-pro", 5_200, 750 + 82_000 + 290), ("deepseek-v4-flash", 37_800, 410 + 71_300 + 310),
          ("hy4-preview", 6_770, 830 + 71_500 + 295), ("mimo-v2.5-pro", 16_300, 790 + 86_000 + 305),
      )],
]

# ---- 同一套餐内推更多模型：(基准 plan_id, 基准模型, 新模型, token 倍率, 置信度, 依据, 是否进精选图)
#   倍率 = 基准模型混合标价 / 新模型混合标价（订阅按 compute cost / credits 计量时成立）；Anthropic Fable 用 Reddit 实测订阅内权重
def blended(cached: float, inp: float, out: float) -> float:
    return MIX["cache"] * cached + MIX["input"] * inp + MIX["output"] * out


RATIO_COMPOSER = blended(0.5, 2, 6) / blended(0.2, 0.5, 2.5)   # Grok 4.6 → Composer 2.5 Standard ≈ 2.57165
RATIO_COMPOSER_FAST = blended(0.5, 2, 6) / blended(0.5, 3, 15)
RATIO_SONNET = round(blended(0.5, 5, 25) / blended(0.2, 2, 10), 2)       # Opus → Sonnet 5 = 2.5
DERIVED = [
    # OpenAI：三段 credits 按实测 mix 加权，不再用输入列比例代替全口径
    *[(pid, "gpt-5.6-sol", model, blended(10, 100, 500) / blended(*rates), "medium",
       f"https://learn.chatgpt.com/docs/pricing 三段credits（cache/input/output）Sol=10/100/500，对比{rates}；旧倍率{old_ratio}、旧月额度{sol_yi * old_ratio:g}亿作废；保留Sol基准，按实测mix重算；见audit-round4-2026-09-05.json",
       pid != "chatgpt_pro_5x" and model != "gpt-5.6-terra")
      for pid, sol_yi in (("chatgpt_plus", 6.16), ("chatgpt_pro_5x", 30.8), ("chatgpt_pro_20x", 123.2))
      for model, rates, old_ratio in (("gpt-5.6-terra", (5, 50, 300), 2),
                                      ("gpt-5.6-luna", (0.5, 5, 30), 20),
                                      ("gpt-5.5", (12.5, 125, 750), 0.8))],
    # Anthropic：Sonnet 5 标价 = Opus 的 0.4 → ×2.5；Opus 4.8 与 Opus 5 同价 → ×1；Fable 订阅内权重 6.5×(20x) / 4.25×(5x)，且最多占周额度 50%
    ("claude_pro", "claude-opus-4.8", "claude-sonnet-5", RATIO_SONNET, "medium", "标价比 Opus/Sonnet 2.5×", True),
    ("claude_max_20x", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "medium", "旧200亿→392.5亿，low→medium；157×Opus/Sonnet标价比2.5，9/14永久口径派生，非Sonnet实测；claude-adoption-round6-2026-09-06.json", True),
    ("claude_max_20x", "claude-opus-5", "claude-opus-4.8", 1.0, "low", "旧80亿→157亿；与Opus5同价，9/14永久基准派生；claude-adoption-round6-2026-09-06.json", False),
    ("claude_max_20x", "claude-opus-5", "claude-fable-5", 0.5 / 6.5, "low", "旧6.152亿→12.077亿；157×0.5/6.5，不再预舍入倍率；订阅内6.5×权重且限周额度50%，9/14永久口径派生；claude-adoption-round6-2026-09-06.json", True),
    ("claude_max_5x", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "low", "旧89亿→196.25亿；78.5×标价比2.5，9/14永久口径派生；claude-adoption-round6-2026-09-06.json", False),
    ("claude_max_5x", "claude-opus-5", "claude-fable-5", 0.5 / 4.25, "low", "旧4.187亿→9.235亿；78.5×0.5/4.25，不再预舍入倍率；订阅内4.25×权重且限周额度50%，9/14永久口径派生；claude-adoption-round6-2026-09-06.json", False),
    # Cursor：池按 compute cost 计（官方），Composer 2.5 标价 $0.5/$0.2/$2.5；Grok 4.5 与 4.6 同价
    ("cursor_ultra", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "medium", "Standard：旧257.165亿（Grok100亿基准）→64.2×完整混合倍率2.571647；更早174.246亿基于67.8×2.57；随round6中间值联动，保留促销混杂风险，非实测；见cursor-adoption-round6-2026-09-06.json", True),
    ("cursor_ultra", "grok-4.6", "grok-4.5", 1.0, "medium", "旧100亿→64.2亿，high→medium继承round6标准基准；Cursor官方models-and-pricing两模型同价，非Grok4.5独立实测；不采用xAI公开API缓存价差；见cursor-adoption-round6-2026-09-06.json", False),
    ("cursor_pro", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "medium", "Standard：官方Cursor三段价混合比；旧12.079亿用舍入倍率2.57，现保留完整精度", True),
    ("cursor_pro_plus", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "low", "Standard：旧46.547亿（18.1亿基准）→17.12×完整混合倍率2.571647；随round6的Ultra64.2×800/3000联动，保留跨档与促销混杂假设；见cursor-adoption-round6-2026-09-06.json", False),
    # xAI：订阅面板额度与公开API标价不同；4.5暂按同订阅4.6额度，非API同价断言
    ("supergrok_heavy", "grok-4.6", "grok-4.5", 1.0, "medium", "维持同订阅额度假设50.9亿，尚无4.5独立面板实测；xAI API缓存价差不能直接映射订阅周池；与Cursor渠道分开", False),
    ("supergrok", "grok-4.6", "grok-4.5", 1.0, "medium", "维持同订阅额度假设5.09亿，尚无4.5独立面板实测；xAI API缓存价差不能直接映射订阅周池；与Cursor渠道分开", False),
    # MiniMax：M2.7 与 M3 同价，同一额度
    ("minimax_token_plus_cn", "minimax-m3", "minimax-m2.7", 1.0, "medium", "与 M3 同价", False),
    ("minimax_token_plus_global", "minimax-m3", "minimax-m2.7", 1.0, "medium", "与 M3 同价", False),
]

# ---- 按量 API 基线：(id, name, model, cached, input, output) USD/MTok；用实测 mix 折成混合价
METERED = [
    ("deepseek_v4_flash_offpeak", "DeepSeek V4 Flash API 闲时", "deepseek-v4-flash", 0.007, 0.22, 0.66, "api-docs.deepseek.com"),
    ("deepseek_v4_flash_peak", "DeepSeek V4 Flash API 忙时", "deepseek-v4-flash", 0.014, 0.44, 1.32, "api-docs.deepseek.com"),
    ("deepseek_v4_pro_offpeak", "DeepSeek V4 Pro API 闲时", "deepseek-v4-pro", 0.022, 0.66, 1.98, "api-docs.deepseek.com"),
    ("deepseek_v4_pro_peak", "DeepSeek V4 Pro API 忙时", "deepseek-v4-pro", 0.044, 1.32, 3.96, "api-docs.deepseek.com"),
    ("openai_sol_api", "GPT-5.6 Sol API", "gpt-5.6-sol", 0.4, 4.0, 20.0, "developers.openai.com"),
    ("xai_grok46_api", "Grok 4.6 API (<200k)", "grok-4.6", 0.5, 2.0, 6.0, "docs.x.ai"),
]

# 精选图只画主流套餐 + 前沿相关点，避免 60 个点挤在一起；全量图画全部
MAIN_PLANS = {"chatgpt_plus", "chatgpt_pro_20x", "claude_pro", "claude_max_20x", "cursor_ultra", "cursor_ultra_fast", "cursor_pro",
              "supergrok_heavy", "supergrok", "kimi_allegretto_cn", "glm_coding_pro_cn_new", "glm_coding_pro_cn_old",
              "minimax_token_plus_cn", "minimax_token_plus_global", "aliyun_coding_pro_cn"}
MAIN_EXTRA = {("opencode_go", "deepseek-v4-flash"), ("opencode_go", "glm-5.3-flash")}


def is_main(pid: str, model: str) -> bool:
    return (pid in MAIN_PLANS and model != "gpt-5.6-terra") or (pid, model) in MAIN_EXTRA


EXCLUDED_SUBSCRIPTIONS = {
    ("kimi_andante_cn", "kimi-k3"): "旧0.58亿为199档×1/20推算，2026-09-05用户确认‘就是不能调用，移除’；官方https://www.kimi.com/code/docs/kimi-code/models限定Moderato及以上可调用K3；不虚构K2.7替代额度"
}

FIELDS = ["plan_id", "plan_name", "billing", "price", "currency", "price_usd", "served_model",
          "monthly_tokens", "monthly_yi", "real_usd_per_mtok", "confidence", "chart_tier", "source", "decision_note"]


def sub_row(pid, name, price, cur, model, yi, conf, src, note, tier=None) -> dict:
    if model == "composer-2.5" and not pid.endswith("_composer_fast"):
        name += " (Standard)"
    price_usd = price / USD_PER_CNY if cur == "CNY" else price
    if cur == "CNY":
        fx = CONVENTIONS["exchangeRate"]
        note = (note + f"；汇率1 USD={USD_PER_CNY} CNY（{fx['date']} {fx['kind']}），"
                f"旧汇率{fx['previousRate']}；人民币月费除以汇率换美元；{fx['source']}").lstrip("；")
    tokens = round(yi * YI)
    return dict(plan_id=pid, plan_name=name, billing="subscription", price=price, currency=cur,
                price_usd=round(price_usd, 2), served_model=model, monthly_tokens=int(tokens),
                monthly_yi=round(yi, 3), real_usd_per_mtok=round(price_usd / tokens * 1e6, 5),
                confidence=conf, chart_tier=tier or ("main" if is_main(pid, model) else "full"), source=src, decision_note=note)


def main() -> None:
    rows = [sub_row(*s) for s in SUBS if (s[0], s[4]) not in EXCLUDED_SUBSCRIPTIONS]
    base = {(r["plan_id"], r["served_model"]): r for r in rows}
    for pid, bmodel, model, ratio, conf, how, main_ in DERIVED:
        b = base[(pid, bmodel)]
        rows.append(sub_row(pid, b["plan_name"], b["price"], b["currency"], model, b["monthly_yi"] * ratio, conf,
                            f"由同套餐 {bmodel} {b['monthly_yi']} 亿 × {ratio}", how, "main" if main_ and is_main(pid, bmodel) else "full"))
    for pid in ("cursor_ultra", "cursor_pro", "cursor_pro_plus"):
        b = base[(pid, "grok-4.6")]
        rows.append(sub_row(
            pid + "_composer_fast", b["plan_name"] + " (Composer Fast)", b["price"], b["currency"],
            "composer-2.5", b["monthly_yi"] * RATIO_COMPOSER_FAST,
            "low" if pid == "cursor_pro_plus" else "medium",
            "https://cursor.com/docs/models/cursor-composer-2-5；audit-round4-2026-09-05.json",
            f"新增Fast（产品默认）估算：缓存/输入/输出=0.5/3/15；扣费为Standard的{RATIO_COMPOSER / RATIO_COMPOSER_FAST:.4f}×；"
            f"沿用同套餐Grok标准基准{b['monthly_yi']}亿×{RATIO_COMPOSER_FAST:.8f}，不是实测；不改用户Grok Fast独立实测30.3亿"
            + (f"；round6随标准基准联动，旧Fast额度{dict(cursor_ultra=91.171, cursor_pro_plus=16.502)[pid]}亿，促销/跨档混杂未剥离；见cursor-adoption-round6-2026-09-06.json"
               if pid in ("cursor_ultra", "cursor_pro_plus") else ""),
            b["chart_tier"],
        ))
    for pid, name, model, cached, inp, out, src in METERED:
        rows.append(dict(plan_id=pid, plan_name=name, billing="metered", price="", currency="USD", price_usd="",
                         served_model=model, monthly_tokens="", monthly_yi="", real_usd_per_mtok=round(blended(cached, inp, out), 5),
                         confidence="high", chart_tier="main", source=src,
                         decision_note=f"标价 cached {cached}/in {inp}/out {out} × 实测 mix {MIX['cache']:.1%}/{MIX['input']:.1%}/{MIX['output']:.1%}"))

    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows -> {OUT}")
    for r in sorted((r for r in rows if r["billing"] == "subscription"), key=lambda r: r["real_usd_per_mtok"]):
        print(f"  {r['real_usd_per_mtok']:>8.4f}  {r['plan_name']:<32} {r['served_model']:<18} {r['confidence']}")


if __name__ == "__main__":
    main()
