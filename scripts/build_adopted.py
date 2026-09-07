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
MONTH_WEEKS = CONVENTIONS["monthWeeks"]
YI = 1e8
CURSOR_ULTRA_STANDARD_YI = 77.37
CURSOR_ULTRA_FAST_YI = 30.74
CLAUDE_MAX_20X_YI = round(47.2 * MONTH_WEEKS / 1.5 * 1.25)
CLAUDE_WEEKLY_20X_TO_5X = 2
SUPERGROK_WEEKLY_TOKENS = 127_272_629
SUPERGROK_PANEL_USD = 25
KIMI_199_USED_TOKENS = 243_739_068
KIMI_199_USED_FRACTION = 0.84

STANDARD_MIX = CONVENTIONS["standardTokenMix"]


def blended(cached: float, inp: float, out: float) -> float:
    return STANDARD_MIX["cache"] * cached + STANDARD_MIX["input"] * inp + STANDARD_MIX["output"] * out


def supergrok_monthly_yi(panel_usd: float, digits: int) -> float:
    return round(SUPERGROK_WEEKLY_TOKENS * MONTH_WEEKS / YI * panel_usd / SUPERGROK_PANEL_USD, digits)


def kimi_199_monthly_yi() -> float:
    return round(KIMI_199_USED_TOKENS / KIMI_199_USED_FRACTION * MONTH_WEEKS / YI, 2)


# OpenCode Go 官方给的是共享美元池、每模型月 Usage 和三段价格；按项目统一标准负载折 token。
# 元组：(model, per-model Usage USD, cached read, input, output, 采用价档说明)
# 证据全量快照：data/research/opencode-go-round5-2026-09-06.json（官网价格/Endpoints 共 28 个模型）。
OPENCODE_GO_MODELS = (
    ("grok-4.6", 15, 0.5, 2.0, 6.0, "≤200K 标价；>200K 价翻倍，保留在 research variants"),
    ("gpt-5.6-luna", 15, 0.02, 0.2, 1.2, "≤272K 标价；>272K 档保留在 research variants"),
    ("glm-5.3-flash", 15, 0.03, 0.15, 0.5, "官网单档"),
    ("glm-5.3", 15, 0.26, 1.4, 4.4, "官网单档"),
    ("glm-5.2", 60, 0.26, 1.4, 4.4, "官网单档"),
    ("glm-5.1", 60, 0.26, 1.4, 4.4, "官网单档"),
    ("kimi-k3", 15, 0.3, 3.0, 15.0, "官网单档"),
    ("kimi-k2.7-code", 60, 0.19, 0.95, 4.0, "官网单档"),
    ("kimi-k2.6", 60, 0.16, 0.95, 4.0, "官网单档"),
    ("longcat-2.0", 60, 0.006, 0.3, 1.2, "官网单档"),
    ("mimo-v2.5", 60, 0.0028, 0.14, 0.28, "官网单档"),
    ("mimo-v2.5-pro", 15, 0.003625, 0.435, 0.87, "官网单档"),
    ("minimax-m3", 60, 0.06, 0.3, 1.2, "官网单档"),
    ("minimax-m2.7", 60, 0.06, 0.3, 1.2, "官网单档"),
    ("minimax-m2.5", 60, 0.06, 0.3, 1.2, "价格/Endpoints 表在列；请求估算表未列"),
    ("muse-spark-1.3-contributor", 60, 0.002, 0.1, 0.2, "官网单档"),
    ("muse-spark-1.2-contributor", 60, 0.002, 0.1, 0.2, "官网单档"),
    ("qwen3.8-max", 15, 0.25, 2.0, 6.0, "官网单档"),
    ("qwen3.8-flash", 30, 0.016, 0.15, 0.47, "官网单档"),
    ("qwen3.7-max", 30, 0.5, 2.5, 7.5, "官网单档"),
    ("qwen3.7-plus", 60, 0.04, 0.4, 1.6, "≤256K 标价；>256K 档保留在 research variants"),
    ("qwen3.6-plus", 60, 0.05, 0.5, 3.0, "≤256K 标价；>256K 档保留在 research variants"),
    ("deepseek-v4-pro", 15, 0.022, 0.66, 1.98, "Off-Peak；Peak 额度为其一半，保留在 research variants"),
    ("deepseek-v4-flash", 30, 0.007, 0.22, 0.66, "Off-Peak；Peak 额度为其一半，保留在 research variants"),
    ("deepseek-v4-flash-vision-exp", 15, 0.007, 0.22, 0.66, "Off-Peak；图像另折 input token，不另编图像负载标准"),
    ("hy4-preview", 30, 0.042, 0.834, 2.501, "官网单档"),
    ("hy3", 60, 0.035, 0.14, 0.58, "官网单档"),
    ("omen-alpha", 100, 0.04, 0.2, 0.66, "模型 Usage $100，但共享月池 $60 先绑定"),
)

OPENCODE_GO_OLD_YI = {
    "grok-4.6": 0.279, "gpt-5.6-luna": 5.25, "glm-5.3-flash": 4.44, "glm-5.3": 0.571,
    "kimi-k3": 0.381, "kimi-k2.7-code": 3.785, "minimax-m3": 9.072, "qwen3.7-plus": 12.461,
    "deepseek-v4-pro": 4.318, "deepseek-v4-flash": 27.224, "hy4-preview": 4.917, "mimo-v2.5-pro": 14.196,
}


def opencode_go_rows() -> list[tuple]:
    rows = []
    for model, usage, cached, inp, out, variant_note in OPENCODE_GO_MODELS:
        effective_usage = min(60, usage)
        yi = round(effective_usage / blended(cached, inp, out) / 100, 3)
        old = OPENCODE_GO_OLD_YI.get(model)
        change = f"旧{old:g}亿（请求估算）→{yi:g}亿" if old is not None else f"新增{yi:g}亿"
        rows.append((
            "opencode_go", "OpenCode Go", 10, "USD", model, yi, "medium",
            "https://opencode.ai/docs/go/ 官方每模型 Usage 与三段价格；opencode-go-round5-2026-09-06.json",
            f"{change}：min(共享月池$60, 模型Usage ${usage:g}) ÷ 统一标准负载加权价；{variant_note}。"
            "官方请求数仅作交叉检查，不再作为额度主值；同套餐各模型额度不可相加",
        ))
    return rows


# Command Code GOAT：共享月池 $70 + 每模型 monthly allowance；effective=min(70, allowance)。
# 元组：(model, allowance USD, cached, input, output, 采用价档说明)
# 证据：https://commandcode.ai/docs/plans/goat 完整两表（Every model + New models）；
#       data/research/code-subscriptions-round1-2026-09-06.json。cache write 不进统一标准负载。
COMMAND_CODE_GOAT_SHARED_USD = 70
COMMAND_CODE_GOAT_MODELS = (
    # —— Every model 表（含既有 11 行，勿删）——
    ("gpt-5.6-sol", 70, 0.5, 5.0, 30.0, "官网三段价"),
    ("glm-5.2", 70, 0.26, 1.4, 4.4, "官网三段价"),
    ("hy3", 70, 0.035, 0.14, 0.58, "官网三段价"),
    ("qwen3.8-27b", 70, 0.04, 0.4, 3.0, "官网三段价"),
    ("deepseek-v4-flash", 60, 0.007, 0.22, 0.66, "Off-Peak；Peak≈2×（01–04 & 06–10 UTC weekdays），与OpenCode口径一致"),
    ("kimi-k2.7-code", 60, 0.19, 0.95, 4.0, "官网三段价"),
    ("minimax-m3", 47, 0.06, 0.3, 1.2, "官网页成交/折扣三段价（-50%类）"),
    ("glm-5.3-flash", 40, 0.03, 0.15, 0.5, "官网三段价"),
    ("gemini-3.8-flash", 40, 0.15, 1.5, 7.5, "官网三段价"),
    ("qwen3.7-max", 33, 0.5, 2.5, 7.5, "官网三段价"),
    ("qwen3.7-plus", 33, 0.08, 0.4, 1.6, "官网三段价（本渠道 cache read=$0.08）"),
    ("qwen3.6-plus", 33, 0.1, 0.5, 3.0, "官网三段价（本渠道 cache read=$0.10）"),
    ("mimo-v2.5", 30, 0.0028, 0.14, 0.28, "官网页成交/折扣三段价"),
    ("deepseek-v4-pro", 20, 0.022, 0.66, 1.98, "Off-Peak；Peak≈2×（01–04 & 06–10 UTC weekdays），与OpenCode口径一致"),
    ("gpt-5.6-luna", 20, 0.02, 0.2, 1.2, "官网三段价"),
    ("qwen3.8-max", 20, 0.25, 2.0, 6.0, "官网三段价"),
    ("mimo-v2.5-pro", 20, 0.0036, 0.435, 0.87, "官网页成交/折扣三段价"),
    # —— New models 表（新模型默认 2× credits，Gemini 3.7 Flash 例外 $40）——
    ("qwen3.8-max-0902", 20, 0.25, 2.0, 6.0, "官网三段价；New models 默认$20"),
    ("hy4-preview", 20, 0.042, 0.834, 2.501, "官网三段价；New models 默认$20"),
    ("qwen3.8-flash", 20, 0.016, 0.16, 0.47, "官网三段价（本渠道 input=$0.16）；New models 默认$20"),
    ("deepseek-v4-flash-vision-exp", 20, 0.007, 0.22, 0.66, "Off-Peak；Peak≈2×；New models 默认$20"),
    ("deepseek-v4-flash-fast", 20, 0.07, 0.28, 0.56, "官网三段价；New models 默认$20；与Flash额度分开"),
    ("glm-5.3", 20, 0.26, 1.4, 4.4, "官网三段价；New models 默认$20"),
    ("muse-spark-1.3", 20, 0.15, 1.25, 4.25, "官网标准档三段价；New models 默认$20"),
    ("muse-spark-1.3-contributor", 20, 0.002, 0.1, 0.2, "官网 contributor 三段价；New models 默认$20"),
    ("muse-spark-1.2", 20, 0.15, 1.25, 4.25, "官网标准档三段价；New models 默认$20"),
    ("muse-spark-1.2-contributor", 20, 0.002, 0.1, 0.2, "官网 contributor 三段价；New models 默认$20"),
    ("kimi-k3", 20, 0.3, 3.0, 15.0, "官网三段价；New models 默认$20"),
    ("kimi-k2.7-code-highspeed", 20, 0.38, 1.9, 8.0, "官网三段价；速度变体独立$20，不继承K2.7 Code的$60"),
    ("grok-4.5", 20, 0.5, 2.0, 6.0, "官网三段价；New models 默认$20"),
    ("grok-4.6", 20, 0.5, 2.0, 6.0, "官网三段价；New models 默认$20"),
    ("gemini-3.7-flash", 40, 0.15, 1.5, 7.5, "官网三段价；New models 表写$40"),
    ("glm-5.2-fast", 20, 0.5, 3.0, 10.25, "官网三段价；速度变体独立$20，不继承GLM-5.2的$70"),
    ("inkling", 20, 0.17, 1.0, 4.05, "官网三段价；New models 默认$20"),
    ("inkling-small", 20, 0.1, 0.5, 1.2, "官网三段价；New models 默认$20"),
    ("step-3.7-flash", 20, 0.04, 0.2, 1.15, "官网三段价；New models 默认$20"),
    ("step-3.5-flash", 20, 0.02, 0.1, 0.3, "官网三段价；New models 默认$20"),
    ("nemotron-3-ultra", 20, 0.12, 0.6, 2.4, "官网三段价；New models 默认$20"),
)


def command_code_goat_rows() -> list[tuple]:
    rows = []
    for model, allowance, cached, inp, out, variant_note in COMMAND_CODE_GOAT_MODELS:
        effective_usage = min(COMMAND_CODE_GOAT_SHARED_USD, allowance)
        yi = round(effective_usage / blended(cached, inp, out) / 100, 3)
        rows.append((
            "command_code_goat", "Command Code GOAT", 10, "USD", model, yi, "medium",
            "https://commandcode.ai/docs/plans/goat 官方每模型 allowance 与三段价；"
            "https://commandcode.ai/pricing；$10→$70 credits；code-subscriptions-round1-2026-09-06.json",
            f"新增{yi:g}亿：min(共享月池$70, 模型allowance ${allowance:g}) ÷ 统一标准负载加权价；{variant_note}。"
            "忽略 processing fee；同套餐各模型额度不可相加；无面板 token+% 截图，按官方绝对credits+价表",
        ))
    return rows


# Ollama Cloud Pro/Max：官方月度 usage credits × 公开 $/1M；无每模型 cap，共享池打满单模型。
# 元组：(model, cached, input, output, 采用价档说明)
# 证据：data/research/code-subscriptions-round1-2026-09-06.json（ollama.com/pricing 当前有明确 input/cache/output 的模型）。
OLLAMA_PRO_CREDITS_USD = 60
OLLAMA_MAX_CREDITS_USD = 300
OLLAMA_MODELS = (
    ("deepseek-v4-flash", 0.007, 0.22, 0.66, "Off-Peak；Peak=2×（12:00–18:00 UTC Mon–Fri），与项目/OpenCode DeepSeek 峰谷口径一致"),
    ("deepseek-v4-pro", 0.022, 0.66, 1.98, "Off-Peak；Peak=2×（12:00–18:00 UTC Mon–Fri），与项目/OpenCode DeepSeek 峰谷口径一致"),
    ("glm-5.3", 0.26, 1.4, 4.4, "官网三段价"),
    ("glm-5.3-flash", 0.03, 0.15, 0.5, "官网三段价"),
    ("glm-5.2", 0.26, 1.4, 4.4, "官网三段价"),
    ("glm-5.1", 0.2, 1.0, 3.2, "官网三段价"),
    ("kimi-k3", 0.3, 3.0, 15.0, "官网三段价"),
    ("kimi-k2.7-code", 0.19, 0.95, 4.0, "官网三段价"),
    ("minimax-m3", 0.12, 0.6, 2.4, "官网三段价（Ollama 标价约为 OpenCode/Command 常见成交价 2×，用本渠道价表）"),
    ("minimax-m2.7", 0.06, 0.3, 1.2, "官网三段价"),
)


def ollama_rows(plan_id: str, plan_name: str, price_usd: float, credits_usd: float) -> list[tuple]:
    rows = []
    for model, cached, inp, out, variant_note in OLLAMA_MODELS:
        yi = round(credits_usd / blended(cached, inp, out) / 100, 3)
        rows.append((
            plan_id, plan_name, price_usd, "USD", model, yi, "medium",
            "https://ollama.com/pricing 官方 usage credits 与三段价；"
            "https://ollama.com/blog/transparent-pricing；code-subscriptions-round1-2026-09-06.json",
            f"新增{yi:g}亿：共享月池 ${credits_usd:g} ÷ 统一标准负载加权价；{variant_note}。"
            "同套餐各模型额度不可相加（共享池按单模型打满）；无面板 token+% 截图，按官方绝对credits+价表",
        ))
    return rows


GLM_WEEKLY_CREDITS = {"lite": 10_000, "pro": 60_000, "max": 140_000}
GLM_CREDIT_RATES = {"glm-5.3": (1.7, 6.9, 24), "glm-5.3-flash": (0.56, 2.3, 8)}


def glm_rows() -> list[tuple]:
    rows = []
    prices = {"new": {"lite": 118, "pro": 538, "max": 1078}, "old": {"lite": 49, "pro": 149, "max": 469}}
    for tier, credits in GLM_WEEKLY_CREDITS.items():
        for who, label in (("new", "新客"), ("old", "老客")):
            for model, rates in GLM_CREDIT_RATES.items():
                peak_week_yi = credits * 10_000 / blended(*rates) / YI
                for band, band_label, multiplier in (("peak", "忙时", 1), ("mid", "中间值", 1.5), ("offpeak", "闲时", 2)):
                    monthly_yi = round(peak_week_yi * multiplier * MONTH_WEEKS, 2)
                    rows.append((
                        f"glm_coding_{tier}_cn_{who}_{band}", f"GLM Coding {tier.title()} ({label} ¥{prices[who][tier]}) {band_label}",
                        prices[who][tier], "CNY", model, monthly_yi, "high",
                        "docs.bigmodel.cn 官方周积分与三段积分系数；standard-token-mix-round1-2026-09-07.json",
                        f"统一标准负载；周积分{credits:g}，{band_label}系数{multiplier:g}×，周{peak_week_yi * multiplier:.3f}亿×{MONTH_WEEKS:g}周={monthly_yi:g}亿；不再取峰谷中位",
                    ))
    return rows


# ---- 订阅：(plan_id, plan_name, price, currency, served_model, monthly_yi, confidence, source, decision_note)
SUBS = [
    # OpenAI —— Sol 为基准；Terra/Luna/5.5 在 DERIVED 按输入、缓存、输出 credits 混合比换算
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-5.6-sol", 6.16, "medium", "awesome-coding-plan 2026-07-30 实测", ""),
    ("chatgpt_pro_5x", "ChatGPT Pro 5x", 100, "USD", "gpt-5.6-sol", 30.8, "medium", "Plus × 官方 5x", "flat.json 写 38.9 与官方 5x 不符，改 30.8"),
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-5.6-sol", 123.2, "high", "Plus × 官方 20x", "用户拍板 123.2；两个独立印证：OpenAI 社区健康周 7.87 亿 = 24% → 131 亿/月；《财经》2026-08 跑满实测 109 亿/月；文章 200 亿作废；第三方旁证：OpenClawFarm 网关 2026-08-21~09-06 对正价 Pro 20x 账号 250 个百分点的 raw token 实测 139.5 亿/月（段间 108~154 亿，实际负载 cache 94.7%，直接给出 total tokens、不再按标准负载归一），见 chatgpt-pro20x-gateway-measurement-2026-09-06.json；逐段复核发现汇总仍含两段Astra，139.5亿仅作混合负载旁证，不视为纯Sol实测；采用值未改"),
    # Anthropic —— Pro保留Opus4.8历史实测；Max采用9/14永久口径估算157亿，非当期boost或纯Opus5硬上限
    #   5x/20x是5h窗口倍率；用户明确20x周池仅为5x的2倍，旧2.25周池比例不再采用
    ("claude_pro", "Claude Pro", 20, "USD", "claude-opus-4.8", 15.88, "medium", "awesome-coding-plan 实测", "Opus4.8历史实测保留，现服务Opus5未重测；round5候选Opus5约1.9亿依赖假定周消息数，用户未确认，不作为实测收紧证据"),
    ("claude_max_20x", "Claude Max 20x (9/14+)", 200, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI, "medium", "Zenn skipbit实测+用户永久口径；claude-adoption-round6-2026-09-06.json", f"旧80亿→{CLAUDE_MAX_20X_YI:g}亿，9/14起永久口径：47.2亿/周×{MONTH_WEEKS:g}周÷1.5×1.25后取整；参考区间110~200亿。混合模型及非完全同窗样本，非纯Opus5实测硬上限；不取活动期189或裸基准126"),
    ("claude_max_5x", "Claude Max 5x (9/14+)", 100, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI / CLAUDE_WEEKLY_20X_TO_5X, "medium", "用户明确20x周池仅为5x的2倍；claude-adoption-round6-2026-09-06.json", "旧35.6亿→78.5亿，9/14起永久口径157÷2；low→medium按用户确认周池关系推算，非独立实测；不采用36亿消息数候选或70亿/旧2.25倍率；5h窗口4倍关系不套周池"),
    # xAI —— 面板周额度（用户面板：Super $25 / Plus $100 / Heavy $250）是 Grok 自己的额度美元，不等于公开标价美元
    #   （linux.do 按标价记出 Super $90~110 / Heavy $900，比例相同、整体 3.6×）。所以不用标价换算，而用 Super 档实测 token 标定：
    #   V2EX 受控打满 1.27 亿/周 ÷ $25 = 面板 $1 ≈ 508 万 token，再套到 Plus / Heavy。
    ("supergrok", "SuperGrok", 30, "USD", "grok-4.6", supergrok_monthly_yi(25, 2), "high", f"V2EX受控打满{SUPERGROK_WEEKLY_TOKENS:,} token/周×{MONTH_WEEKS:g}周", f"采用{supergrok_monthly_yi(25, 2):g}亿：{SUPERGROK_WEEKLY_TOKENS:,}×{MONTH_WEEKS:g}周；面板周额度$25；同帖双倍活动周2.45亿不采；linux.do另测1.44亿/周同量级"),
    ("supergrok_plus", "SuperGrok Plus", 100, "USD", "grok-4.6", supergrok_monthly_yi(100, 1), "medium", f"面板周额度$100×Super精确标定×{MONTH_WEEKS:g}周", f"采用{supergrok_monthly_yi(100, 1):g}亿：{SUPERGROK_WEEKLY_TOKENS:,}×{MONTH_WEEKS:g}周×100/25，按一位小数取值；linux.do用户口述每用一刀涨1%与周$100吻合"),
    ("supergrok_heavy", "SuperGrok Heavy", 300, "USD", "grok-4.6", supergrok_monthly_yi(250, 1), "medium", f"面板周额度$250×Super精确标定×{MONTH_WEEKS:g}周", f"采用{supergrok_monthly_yi(250, 1):g}亿：{SUPERGROK_WEEKLY_TOKENS:,}×{MONTH_WEEKS:g}周×250/25，按一位小数取值；标价换算18亿作废（面板美元≠标价美元）；Zhang 208亿未采"),
    ("supergrok_lite", "SuperGrok Lite", 10, "USD", "grok-4.6", 1.5, "low", "aa_grok_build_2026_07", "面板周额度未知，三轮联网均无"),
    # Cursor —— 两张个人Ultra截图均在2026-08-25永久扩池后；社区图可能因首周半价用量集中而使tokens/Usage%反推偏高。
    #   Fast取用户当前平滑账号最大样本863.8M/28.1%=30.74亿；Standard取用户67.78亿与社区86.95亿主行中间值77.37亿。
    #   Pro保留独立面板采用值；Pro+按$800/$3000池比，从round8标准77.37亿反推。
    ("cursor_ultra", "Cursor Ultra", 200, "USD", "grok-4.6", CURSOR_ULTRA_STANDARD_YI, "medium", "两张调整后个人Ultra标准主行中间值；cursor-adoption-round8-2026-09-06.json", "旧80亿→77.37亿：(用户当前平滑账号61.0M/0.9%=67.78亿 + 社区8/26图1478.2M/17%=86.95亿)/2。社区图可能有大量首周半价用量，按费用百分比反推略高；中间值不是单行直接实测，token类型分布与面板取整差异保留"),
    ("cursor_ultra_fast", "Cursor Ultra (Fast)", 200, "USD", "grok-4.6", CURSOR_ULTRA_FAST_YI, "high", "用户当前平滑账号截图863.8M/28.1%直接反推；cursor-adoption-round8-2026-09-06.json", "旧40亿→30.74亿；取最大样本xhigh-fast行直接反推，百分比取整区间30.69~30.80亿；同图较小high-fast行24.43亿不采。Standard/Fast不强制raw token严格2×，因为面板按费用扣减且token类型构成不同；官方三段费率2×事实不变；与SuperGrok渠道分开"),
    ("cursor_pro", "Cursor Pro", 20, "USD", "grok-4.6", 4.7, "medium", "Cursor 论坛面板：303.9M = 65% → 4.68 亿；另有用户口述 4~5 亿打满", "保留独立面板采用4.7亿，不随Ultra中间值联动；池按compute cost计非raw token"),
    ("cursor_pro_plus", "Cursor Pro+", 60, "USD", "grok-4.6", CURSOR_ULTRA_STANDARD_YI * 800 / 3000, "medium", "round3面板Pro+池约$800；按Ultra池$3000等比；cursor-adoption-round8-2026-09-06.json", "旧21.33亿→20.63亿：77.37×800/3000；继承跨档池规模假设，非独立实测；未采社区图反推$4500~4800作为官方池；促销与账号差异保留"),
    # Kimi 国内 —— 199 档本机 ccusage 反推，其余按官网倍率 1x/4x/20x/60x
    ("kimi_allegretto_cn", "Kimi 会员 199", 199, "CNY", "kimi-k3", kimi_199_monthly_yi(), "medium", f"本机ccusage {KIMI_199_USED_TOKENS}/{KIMI_199_USED_FRACTION:.0%}×{MONTH_WEEKS:g}周；kimi199-round5-swe17-2026-09-05.json", "额度11.61亿不变，high→medium：占比为用户约数，样本以k3-256k为主且含kimi-for-coding，非纯K3 1M实测；SWE1.7短时面板的模型/统计窗口不同，未替换基准；ACP14.28为旧模型未采"),
    ("kimi_moderato_cn", "Kimi 会员 99", 99, "CNY", "kimi-k3", round(kimi_199_monthly_yi() * 4 / 20, 2), "medium", "199档×官方4/20", "继承199档K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    ("kimi_andante_cn", "Kimi 会员 49", 49, "CNY", "kimi-k3", round(kimi_199_monthly_yi() / 20, 2), "medium", "199档×官方1/20", ""),
    ("kimi_allegro_cn", "Kimi 会员 699", 699, "CNY", "kimi-k3", round(kimi_199_monthly_yi() * 60 / 20, 2), "medium", "199档×官方60/20", "继承199档K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    # Kimi 海外 —— 不画：官方 Code credits 倍率 1×/5×/15×/30× 与国内 1/4/20/60× 体系不同，且无绝对 token 证据
    # 智谱 —— 官方周积分与三段积分系数按项目统一标准负载换算；忙时与闲时分开按月展示。
    *glm_rows(),
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
    # OpenCode Go —— 官网全量模型；美元额度 × 项目统一标准负载，旧请求估算仅作旁证。
    *opencode_go_rows(),
    # Command Code GOAT —— 官网每模型 allowance + 三段价；effective=min($70, allowance)；不含 Muse Code（仅5h请求窗）。
    *command_code_goat_rows(),
    # Ollama Cloud Pro/Max —— 官方 credits × 官方价表；DeepSeek 用 off-peak。
    *ollama_rows("ollama_pro", "Ollama Pro", 20, OLLAMA_PRO_CREDITS_USD),
    *ollama_rows("ollama_max", "Ollama Max", 100, OLLAMA_MAX_CREDITS_USD),
]

# ---- 同一套餐内推更多模型：(基准 plan_id, 基准模型, 新模型, token 倍率, 置信度, 依据, 是否进精选图)
#   倍率 = 基准模型混合标价 / 新模型混合标价（订阅按 compute cost / credits 计量时成立）；Anthropic Fable 用 Reddit 实测订阅内权重
RATIO_COMPOSER = blended(0.5, 2, 6) / blended(0.2, 0.5, 2.5)   # Grok 4.6 → Composer 2.5 Standard ≈ 2.57110
RATIO_COMPOSER_FAST = blended(0.5, 2, 6) / blended(0.5, 3, 15)
RATIO_SONNET = round(blended(0.5, 5, 25) / blended(0.2, 2, 10), 2)       # Opus → Sonnet 5 = 2.5
DERIVED = [
    # OpenAI：三段 credits 按项目统一标准负载加权，不再用输入列比例代替全口径
    *[(pid, "gpt-5.6-sol", model, blended(10, 100, 500) / blended(*rates), "medium",
       f"https://learn.chatgpt.com/docs/pricing 三段credits（cache/input/output）Sol=10/100/500，对比{rates}；旧倍率{old_ratio}、旧月额度{sol_yi * old_ratio:g}亿作废；保留Sol基准，按项目统一标准负载重算；见audit-round4-2026-09-05.json",
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
    ("cursor_ultra", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "medium", f"旧80亿基准→77.37亿×统一标准负载倍率{RATIO_COMPOSER:.6f}；随round8标准中间值联动，非Composer实测；见cursor-adoption-round8-2026-09-06.json", True),
    ("cursor_ultra", "grok-4.6", "grok-4.5", 1.0, "medium", "旧80亿→77.37亿，继承round8标准基准；Cursor官方models-and-pricing两模型同价，非Grok4.5独立实测；不采用xAI公开API缓存价差；见cursor-adoption-round8-2026-09-06.json", False),
    ("cursor_pro", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "medium", "Standard：官方Cursor三段价混合比；旧12.079亿用舍入倍率2.57，现保留完整精度", True),
    ("cursor_pro_plus", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "low", f"旧21.33亿基准→20.63亿×统一标准负载倍率{RATIO_COMPOSER:.6f}；随round8的Ultra77.37×800/3000联动，保留跨档假设；见cursor-adoption-round8-2026-09-06.json", False),
    # xAI：订阅面板额度与公开API标价不同；4.5暂按同订阅4.6额度，非API同价断言
    ("supergrok_heavy", "grok-4.6", "grok-4.5", 1.0, "medium", "维持同订阅额度假设50.9亿，尚无4.5独立面板实测；xAI API缓存价差不能直接映射订阅周池；与Cursor渠道分开", False),
    ("supergrok", "grok-4.6", "grok-4.5", 1.0, "medium", "维持同订阅额度假设5.09亿，尚无4.5独立面板实测；xAI API缓存价差不能直接映射订阅周池；与Cursor渠道分开", False),
    # MiniMax：M2.7 与 M3 同价，同一额度
    ("minimax_token_plus_cn", "minimax-m3", "minimax-m2.7", 1.0, "medium", "与 M3 同价", False),
    ("minimax_token_plus_global", "minimax-m3", "minimax-m2.7", 1.0, "medium", "与 M3 同价", False),
]

# ---- 按量 API 基线：(id, name, model, cached, input, output) USD/MTok；用项目统一标准负载折成混合价
METERED = [
    ("deepseek_v4_flash_offpeak", "DeepSeek V4 Flash API 闲时", "deepseek-v4-flash", 0.007, 0.22, 0.66, "api-docs.deepseek.com"),
    ("deepseek_v4_flash_peak", "DeepSeek V4 Flash API 忙时", "deepseek-v4-flash", 0.014, 0.44, 1.32, "api-docs.deepseek.com"),
    ("deepseek_v4_pro_offpeak", "DeepSeek V4 Pro API 闲时", "deepseek-v4-pro", 0.022, 0.66, 1.98, "api-docs.deepseek.com"),
    ("deepseek_v4_pro_peak", "DeepSeek V4 Pro API 忙时", "deepseek-v4-pro", 0.044, 1.32, 3.96, "api-docs.deepseek.com"),
    ("openai_sol_api", "GPT-5.6 Sol API", "gpt-5.6-sol", 0.4, 4.0, 20.0, "developers.openai.com"),
    ("xai_grok46_api", "Grok 4.6 API (<200k)", "grok-4.6", 0.5, 2.0, 6.0, "docs.x.ai"),
    # 2026-09-06 补齐 Claude 与 GPT-5.6 其余档的官方按量价，让 Claude / ChatGPT 订阅点在同榜有 API 基线可比
    ("anthropic_opus5_api", "Claude Opus 5 API", "claude-opus-5", 0.5, 5.0, 25.0, "platform.claude.com/docs/en/about-claude/pricing"),
    ("anthropic_sonnet5_api", "Claude Sonnet 5 API", "claude-sonnet-5", 0.2, 2.0, 10.0, "platform.claude.com/docs/en/about-claude/pricing"),
    ("anthropic_fable5_api", "Claude Fable 5 API", "claude-fable-5", 1.0, 10.0, 50.0, "platform.claude.com/docs/en/about-claude/pricing"),
    ("openai_terra_api", "GPT-5.6 Terra API", "gpt-5.6-terra", 0.2, 2.0, 12.0, "developers.openai.com"),
    ("openai_luna_api", "GPT-5.6 Luna API", "gpt-5.6-luna", 0.02, 0.2, 1.2, "developers.openai.com"),
]

# 精选图只画主流套餐 + 前沿相关点，避免 60 个点挤在一起；全量图画全部
MAIN_PLANS = {"chatgpt_plus", "chatgpt_pro_20x", "claude_pro", "claude_max_20x", "cursor_ultra", "cursor_ultra_fast", "cursor_pro",
              "supergrok_heavy", "supergrok", "kimi_allegretto_cn", "glm_coding_pro_cn_new_peak", "glm_coding_pro_cn_new_mid", "glm_coding_pro_cn_new_offpeak", "glm_coding_pro_cn_old_peak", "glm_coding_pro_cn_old_mid", "glm_coding_pro_cn_old_offpeak",
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
    monthly_yi = round(yi, 3)
    tokens = round(monthly_yi * YI)
    return dict(plan_id=pid, plan_name=name, billing="subscription", price=price, currency=cur,
                price_usd=round(price_usd, 2), served_model=model, monthly_tokens=int(tokens),
                monthly_yi=monthly_yi, real_usd_per_mtok=round(price_usd / tokens * 1e6, 5),
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
            f"沿用同套餐Grok标准基准{b['monthly_yi']}亿×{RATIO_COMPOSER_FAST:.8f}，不是实测；Grok Fast采用用户当前账号独立反推30.74亿，不套到Composer"
            + (f"；round8随标准基准联动，旧Composer Fast额度{dict(cursor_ultra=72.937, cursor_pro_plus=19.45)[pid]}亿，促销/跨档混杂未剥离；见cursor-adoption-round8-2026-09-06.json"
               if pid in ("cursor_ultra", "cursor_pro_plus") else ""),
            b["chart_tier"],
        ))
    for pid, name, model, cached, inp, out, src in METERED:
        rows.append(dict(plan_id=pid, plan_name=name, billing="metered", price="", currency="USD", price_usd="",
                         served_model=model, monthly_tokens="", monthly_yi="", real_usd_per_mtok=round(blended(cached, inp, out), 5),
                         confidence="high", chart_tier="main", source=src,
                         decision_note=f"标价 cached {cached}/in {inp}/out {out} × 项目统一标准负载 {STANDARD_MIX['cache']:.1%}/{STANDARD_MIX['input']:.2%}/{STANDARD_MIX['output']:.2%}"))

    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows -> {OUT}")
    for r in sorted((r for r in rows if r["billing"] == "subscription"), key=lambda r: r["real_usd_per_mtok"]):
        print(f"  {r['real_usd_per_mtok']:>8.4f}  {r['plan_name']:<32} {r['served_model']:<18} {r['confidence']}")


if __name__ == "__main__":
    main()
