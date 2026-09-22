# -*- coding: utf-8 -*-
"""生成 data/adopted.csv：每个 (套餐, 实际服务模型) 一行，一个采用值。

所有取舍在这里写死并注明理由；原始多源数据留在 data/subscription-quotas*.json 不动。
真实单价 = 月费(USD) / 月 token（全口径：输入+缓存读+缓存写+输出一视同仁；默认月=4周，厂商独立月池除外；饱和使用）。
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
CHATGPT_PLUS_LUNA_USED_TOKENS = 112_666_769
CHATGPT_PLUS_LUNA_USED_FRACTION = 0.06
CHATGPT_PLUS_ASTRA_USED_TOKENS = 10_336_745
CHATGPT_PLUS_ASTRA_USED_FRACTION = 0.26
# Astra Pro20x 周池 —— round14 后按实测源加权（round10 的 10% 与 Pro20x 档位经用户确认真实）：
#   Observatory 8.53×3 + round10 13.8×3 + g5a 7.52×3 + msg7086 8.07×2 + 图1用户面板 10.0×3
#   + 图4(2/3周) 8.18×2 + 图2 X自述 9.25×1 + 图3 sub2后台 10.3×1 = 171.6/18 = 9.53 亿/周；
#   用户自测≈32亿/月与 lichengzhe 网关 21~23 亿按用户指示不入权；纯口述与下限源不进均值
CHATGPT_PRO20X_ASTRA_WEEK_YI = 9.53
CHATGPT_PRO20X_ASTRA_MONTHLY_YI = round(CHATGPT_PRO20X_ASTRA_WEEK_YI * MONTH_WEEKS, 2)
# Sol Pro20x —— 2026-09-21 用户裁定由 Plus×20 派生值改五源实测加权（权重同 Astra round14 惯例：
#   连续序列/受控打满×3、自述份额×2、社区口述×1；Plus×20=123.2 派生值不入权仅对照）：
#   Observatory 遥测 143.6×3 + 《财经》打满 109×3 + 网关 139.5×2（含两段Astra，混合负载降权不剔除）
#   + 社区健康周 131.2×2 + imon139 口述 120×1 = 1419.2/11
CHATGPT_PRO20X_SOL_MONTHLY_YI = round(1419.2 / 11, 2)
DEVIN_MAX_ASTRA_USED_TOKENS = 305_025_580
DEVIN_MAX_ASTRA_USED_FRACTION = 0.87
# Google AI Pro 周帽 —— round7 用户本地实测：B 整段 55.343M raw（cache 45.688M/输入 9.258M/输出 0.398M）= 周条 +9.88%
#   → raw 周池 5.60 亿。官方按 API worth 合池计权（实证：B1/B2 的 %比 0.405≈worth比 0.407，非 raw比 0.448），
#   故 raw 额度随负载 mix 变：本样本 cache 82.6%（用户指出 Gemini 实际负载打不到 97% cache）——
#   采用 raw 实测口径而非标准负载折算（标准负载口径 $120.1 worth/周≈46.9 亿/月，偏高不采）；
#   与 Step 的 conventions.lowCacheTokenMix 同属"打不到97.5% cache 采实测"口径族（2026-09-22 用户裁定统一）
GOOGLE_PRO_B_TOTAL_TOKENS = 55_343_000
GOOGLE_PRO_B_WEEKLY_FRACTION = 0.0988
KIMI_199_USED_TOKENS = 243_739_068
KIMI_199_USED_FRACTION = 0.84
KIMI_MONTHLY_TO_WEEKLY = 5
KIMI_K27_199_USED_TOKENS = 11_913_113
KIMI_K27_199_MONTHLY_USED_FRACTION = 0.0076
CLAUDE_PRO_SESSION_TOKENS = 32_868_513
CLAUDE_PRO_WEEKLY_FRACTION = 0.07
# Fable 5.1 —— 首个 token×周% 同框样本（round3，用户提供的 Max 账号同日日志）：
#   2443 轮 cache读283M+输出2.6M=285.6M raw → /usage 周额度(all models) 0%→19%；次日3017轮→24%线性互验
CLAUDE_FABLE51_DAY_TOKENS = 285_600_000
CLAUDE_FABLE51_DAY_WEEKLY_FRACTION = 0.19
CLAUDE_FABLE_WEEKLY_CAP = 0.5  # 官方：Fable 系列最多占周额度 50%（5 与 5.1 同规则）
CLAUDE_MAX_20X_WEEKLY_BOOST_YI = 47.2  # skipbit 活动期（+50% boost）周池，round6 永久换算的原始基准
# 2026-09-21 时间线校正：该样本实测于 9/4~9/5 促销期，19% 分母是活动期池 47.2亿/周（非永久池 39.25亿）。
#   会话消耗 0.19×47.2=8.97亿 Opus当量；Opus5 部分 raw≈1.13亿（cache读1.12亿+输出110万，input/write未单列→略低估Opus份额→权重略高估）；
#   Fable5.1 部分 1.725亿 raw 承担其余 → 隐含权重≈4.54×Opus，落在 Fable5 实测 4.25~6.5 区间内自洽。
#   交叉验证：按美元计权同会话≈$201→永久周池$882→纯Fable $1.04/M混合价→17.0亿/月，与权重法 17.3亿 收敛。
CLAUDE_FABLE51_OPUS_SHARE_YI = 1.131
CLAUDE_FABLE51_W = (
    CLAUDE_MAX_20X_WEEKLY_BOOST_YI * CLAUDE_FABLE51_DAY_WEEKLY_FRACTION
    - CLAUDE_FABLE51_OPUS_SHARE_YI
) / (CLAUDE_FABLE51_DAY_TOKENS / YI - CLAUDE_FABLE51_OPUS_SHARE_YI)  # ≈4.54

# Kimi 国内外同名档并为一点（2026-09-14 用户拍板）：月费/单价统一按国际版美元标价，
# 国内实付价保留在 price/currency 供展示层注明差价；额度仍国内档实测/派生口径，
# 海外同名档绝对 token 未实测（国际 Code 倍率 1/5/15/30× ≠ 国内 1/4/20/60×），并点仅作价位展示。
# Andante ¥49 无海外同名档，保持国内口径；Vivace $199 仅海外且无额度证据，不画。
KIMI_INTL = {  # plan_id -> (国际版展示名, 国际版月费 USD)
    "kimi_moderato_cn": ("Kimi Moderato", 19),
    "kimi_allegretto_cn": ("Kimi Allegretto", 39),
    "kimi_allegro_cn": ("Kimi Allegro", 99),
}

STANDARD_MIX = CONVENTIONS["standardTokenMix"]


def blended(cached: float, inp: float, out: float) -> float:
    return STANDARD_MIX["cache"] * cached + STANDARD_MIX["input"] * inp + STANDARD_MIX["output"] * out


LOW_CACHE_MIX = CONVENTIONS["lowCacheTokenMix"]


def blended_low(cached: float, inp: float, out: float) -> float:
    # 低缓存负载（step-5-preview 本机实测 mix）：用于实测打不到 97.5% cache 的渠道
    return LOW_CACHE_MIX["cache"] * cached + LOW_CACHE_MIX["input"] * inp + LOW_CACHE_MIX["output"] * out


def supergrok_monthly_yi(panel_usd: float, digits: int) -> float:
    return round(SUPERGROK_WEEKLY_TOKENS * MONTH_WEEKS / YI * panel_usd / SUPERGROK_PANEL_USD, digits)


def chatgpt_luna_monthly_yi(plan_multiplier: float = 1) -> float:
    return round(
        CHATGPT_PLUS_LUNA_USED_TOKENS / CHATGPT_PLUS_LUNA_USED_FRACTION
        * MONTH_WEEKS * plan_multiplier / YI,
        2,
    )


def chatgpt_astra_monthly_yi() -> float:
    return round(
        CHATGPT_PLUS_ASTRA_USED_TOKENS / CHATGPT_PLUS_ASTRA_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def devin_max_astra_monthly_yi() -> float:
    return round(
        DEVIN_MAX_ASTRA_USED_TOKENS / DEVIN_MAX_ASTRA_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def google_ai_pro_monthly_yi() -> float:
    # raw total ÷ 周占比 → 周池 raw；×4周 → 亿/月（用户实测 mix 的"实际可用"口径）
    return round(
        GOOGLE_PRO_B_TOTAL_TOKENS / GOOGLE_PRO_B_WEEKLY_FRACTION * MONTH_WEEKS / YI,
        2,
    )


def kimi_199_monthly_yi() -> float:
    return round(
        KIMI_199_USED_TOKENS / KIMI_199_USED_FRACTION
        * KIMI_MONTHLY_TO_WEEKLY / YI,
        2,
    )


def kimi_k27_199_monthly_yi() -> float:
    return round(
        KIMI_K27_199_USED_TOKENS
        / KIMI_K27_199_MONTHLY_USED_FRACTION / YI,
        2,
    )


def claude_pro_opus5_monthly_yi() -> float:
    return round(
        CLAUDE_PRO_SESSION_TOKENS / CLAUDE_PRO_WEEKLY_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def claude_fable51_max_monthly_yi() -> float:
    # 纯 Fable5.1 月额度 = 月池 × 50%周帽 ÷ 订阅内权重（round9 起按分解权重，不再用混合当量池直推）
    return round(
        CLAUDE_MAX_20X_YI * CLAUDE_FABLE_WEEKLY_CAP / CLAUDE_FABLE51_W,
        2,
    )


# OpenCode Go 官方给的是共享美元池、每模型月 Usage 和三段价格；按项目统一标准负载折 token。
# 元组：(model, per-model Usage USD, cached read, input, output, 采用价档说明)
# 证据全量快照：data/research/opencode-go-round5-2026-09-06.json（当时 28 个模型）。
# DeepSeek 2026-09-10 增量：opencode-go-deepseek-round6-2026-09-10.json。
# V4 Flash / Vision 已下线，用户要求从采用集删除；现 27 个模型。
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
    ("deepseek-v4.1-flash", 15, 0.003, 0.15, 0.60, "官网新行；Off-Peak；Peak=2×保留在 research variants"),
    ("deepseek-v4-pro", 15, 0.022, 0.66, 1.98, "Off-Peak；Peak 额度为其一半，保留在 research variants；OpenCode 价表未改"),
    ("hy4-preview", 30, 0.042, 0.834, 2.501, "官网单档"),
    ("hy3", 60, 0.035, 0.14, 0.58, "官网单档"),
    ("omen-alpha", 100, 0.04, 0.2, 0.66, "模型 Usage $100，但共享月池 $60 先绑定"),
)

OPENCODE_GO_OLD_YI = {
    "grok-4.6": 0.279, "gpt-5.6-luna": 5.25, "glm-5.3-flash": 4.44, "glm-5.3": 0.571,
    "kimi-k3": 0.381, "kimi-k2.7-code": 3.785, "minimax-m3": 9.072, "qwen3.7-plus": 12.461,
    "deepseek-v4-pro": 4.318, "hy4-preview": 4.917, "mimo-v2.5-pro": 14.196,
}


OPENCODE_GO_DEFAULT_SOURCE = (
    "https://opencode.ai/docs/go/ 官方每模型 Usage 与三段价格；opencode-go-round5-2026-09-06.json"
)
OPENCODE_GO_DEEPSEEK_SOURCE = (
    "https://opencode.ai/docs/go/ 官方每模型 Usage 与三段价格；"
    "opencode-go-deepseek-round6-2026-09-10.json"
)
OPENCODE_GO_NOTES = {
    "deepseek-v4.1-flash": (
        "新增18.182亿：min(共享月池$60, 模型Usage $15) ÷ 统一标准负载加权价；"
        "官网闲时 cached/input/output=$0.003/$0.15/$0.60，高峰2×。官网 Model ID=deepseek-flash，"
        "项目 served_model=deepseek-v4.1-flash 以对接榜单。"
        "用户确认 V4 Flash / Vision 已下线，OpenCode 这两点删除（旧Flash 21.637亿、Vision 10.819亿）。"
        "官方请求数仅作交叉检查，不再作为额度主值；同套餐各模型额度不可相加"
    ),
}


def opencode_go_rows() -> list[tuple]:
    rows = []
    for model, usage, cached, inp, out, variant_note in OPENCODE_GO_MODELS:
        effective_usage = min(60, usage)
        yi = round(effective_usage / blended(cached, inp, out) / 100, 3)
        old = OPENCODE_GO_OLD_YI.get(model)
        change = f"旧{old:g}亿（请求估算）→{yi:g}亿" if old is not None else f"新增{yi:g}亿"
        source = OPENCODE_GO_DEEPSEEK_SOURCE if model.startswith("deepseek-") else OPENCODE_GO_DEFAULT_SOURCE
        note = OPENCODE_GO_NOTES.get(
            model,
            f"{change}：min(共享月池$60, 模型Usage ${usage:g}) ÷ 统一标准负载加权价；{variant_note}。"
            "官方请求数仅作交叉检查，不再作为额度主值；同套餐各模型额度不可相加",
        )
        rows.append((
            "opencode_go", "OpenCode Go", 10, "USD", model, yi, "medium",
            source, note,
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
    ("deepseek-v4.1-flash", 40, 0.003, 0.15, 0.60, "官网新行；Off-Peak；Peak=2×保留在 research variants"),
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


COMMAND_CODE_GOAT_DEFAULT_SOURCE = (
    "https://commandcode.ai/docs/plans/goat 官方每模型 allowance 与三段价；"
    "https://commandcode.ai/pricing；$10→$70 credits；code-subscriptions-round1-2026-09-06.json"
)
COMMAND_CODE_GOAT_DEEPSEEK_SOURCE = (
    "https://commandcode.ai/docs/plans/goat 官方每模型 allowance 与三段价；"
    "https://commandcode.ai/pricing；$10→$70 credits；command-code-goat-deepseek-round1-2026-09-10.json"
)
COMMAND_CODE_GOAT_NOTES = {
    "deepseek-v4.1-flash": (
        "新增48.485亿：min(共享月池$70, 模型allowance $40) ÷ 统一标准负载加权价；"
        "官网闲时 cached/input/output=$0.003/$0.15/$0.60，高峰2×。"
        "用户确认 V4 Flash / Vision 已下线，Command Code 这两点删除（旧Flash 43.274亿、Vision 14.425亿）。"
        "官方请求数仅作交叉检查，不再作为额度主值；忽略 processing fee；同套餐各模型额度不可相加"
    ),
}


def command_code_goat_rows() -> list[tuple]:
    rows = []
    for model, allowance, cached, inp, out, variant_note in COMMAND_CODE_GOAT_MODELS:
        effective_usage = min(COMMAND_CODE_GOAT_SHARED_USD, allowance)
        yi = round(effective_usage / blended(cached, inp, out) / 100, 3)
        source = COMMAND_CODE_GOAT_DEEPSEEK_SOURCE if model.startswith("deepseek-") else COMMAND_CODE_GOAT_DEFAULT_SOURCE
        note = COMMAND_CODE_GOAT_NOTES.get(
            model,
            f"新增{yi:g}亿：min(共享月池$70, 模型allowance ${allowance:g}) ÷ 统一标准负载加权价；{variant_note}。"
            "忽略 processing fee；同套餐各模型额度不可相加；无面板 token+% 截图，按官方绝对credits+价表",
        )
        rows.append((
            "command_code_goat", "Command Code GOAT", 10, "USD", model, yi, "medium",
            source, note,
        ))
    return rows


# Ollama Cloud Pro/Max：官方月度 usage credits × 公开 $/1M；无每模型 cap，共享池打满单模型。
# 元组：(model, cached, input, output, 采用价档说明)
# 证据：data/research/code-subscriptions-round1-2026-09-06.json（ollama.com/pricing 当前有明确 input/cache/output 的模型）。
OLLAMA_PRO_CREDITS_USD = 60
OLLAMA_MAX_CREDITS_USD = 300
OLLAMA_MODELS = (
    ("deepseek-v4.1-flash", 0.003, 0.15, 0.60, "Off-Peak；Peak=2×（Ollama 峰窗 12:00–18:00 UTC Mon–Fri，金额对齐 DeepSeek 官方 V4.1 Flash 但窗口不同）；2026-09-10 起分批上线；Ollama 仅此一个 V4.1 变体；ollama-deepseek-v41-round1-2026-09-11.json"),
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
            "https://ollama.com/blog/transparent-pricing；code-subscriptions-round1-2026-09-06.json；"
            "ollama-deepseek-v41-round1-2026-09-11.json",
            f"新增{yi:g}亿：共享月池 ${credits_usd:g} ÷ 统一标准负载加权价；{variant_note}。"
            "同套餐各模型额度不可相加（共享池按单模型打满）；无面板 token+% 截图，按官方绝对credits+价表",
        ))
    return rows


GLM_WEEKLY_CREDITS = {"lite": 10_000, "pro": 60_000, "max": 140_000}
GLM_CREDIT_RATES = {"glm-5.3": (1.7, 6.9, 24), "glm-5.3-flash": (0.56, 2.3, 8)}


# 阶跃 Step Plan 国内站：官方 Credit 月池，1M Credit = ¥1，按开放平台人民币三段价折 token。
# 证据：platform.stepfun.com/docs/zh/step-plan/overview；pricing/details；
#       data/research/stepfun-step-plan-round1-2026-09-10.json、round3-2026-09-10.json。
# step-5-preview（round5）：用户 Plus 面板 + 本机 210M token 实测互验成立；实测负载 cache 79.0%
# 打不到标准口径 97.5%。2026-09-22 用户裁定：Step 全系统一套 conventions.lowCacheTokenMix
# 「低缓存负载」85%/14.65%/0.35%（step5 实测 79% 留作 decision_note 对照），Gemini raw 实测属同族。
STEPFUN_STEP5_TOKENS = (166_038_390, 43_410_633, 720_954)  # 本机实测 cache读/缓外输入/输出（79.0% mix，作对照保留）
STEPFUN_STEP5_MEASURED_CNY = sum(t * p for t, p in zip(STEPFUN_STEP5_TOKENS, (0.35, 7.0, 20.0))) / sum(STEPFUN_STEP5_TOKENS)
STEPFUN_TIERS = (
    ("stepfun_mini_cn", "Step Plan Mini (¥49)", 49, 400),
    ("stepfun_plus_cn", "Step Plan Plus (¥99)", 99, 1600),
    ("stepfun_pro_cn", "Step Plan Pro (¥199)", 199, 8000),
    ("stepfun_max_cn", "Step Plan Max (¥699)", 699, 40000),
)
STEPFUN_MODELS = (
    ("step-3.5-flash", 0.14, 0.7, 2.1),
    ("step-3.7-flash", 0.27, 1.35, 8.1),
    ("step-5-preview", 0.35, 7.0, 20.0),
)
STEPFUN_SOURCE = (
    "https://platform.stepfun.com/docs/zh/step-plan/overview 官方 Credit 月池 1M Credit=¥1；"
    "https://platform.stepfun.com/docs/zh/guides/pricing/details 人民币三段价；"
    "stepfun-step-plan-round1-2026-09-10.json；stepfun-step-plan-round3-2026-09-10.json；"
    "stepfun-step-plan-round4-2026-09-10.json；stepfun-step5-panel-round5-2026-09-21.json"
)


def stepfun_rows() -> list[tuple]:
    rows = []
    for pid, name, price, credit_m in STEPFUN_TIERS:
        for model, cached, inp, out in STEPFUN_MODELS:
            if model == "step-5-preview":
                blended_cny = blended_low(cached, inp, out)
                yi = round(credit_m / blended_cny / 100, 3)
                conf = "high" if pid == "stepfun_plus_cn" else "medium"
                note = (
                    f"新增{yi:g}亿：国内站月度{credit_m:g}M Credit÷低缓存统一负载混合价¥{blended_cny:.3f}/M"
                    "（conventions.lowCacheTokenMix 85%/14.65%/0.35%，2026-09-22用户裁定Step全系统一口径）。"
                    f"对照：本机实测79.0% mix混合价¥{STEPFUN_STEP5_MEASURED_CNY:.3f}/M，对应{credit_m / STEPFUN_STEP5_MEASURED_CNY / 100:.3f}亿"
                    "（210.17M tokens大样本，OpenCode+DSH同窗）。"
                    + ("Plus面板双向验证：控制台Credit消耗378.15M 与本机token×官方三段价期望376.41M 差+0.46%；"
                       "378.15÷1600=23.63%≈面板剩余77%，官方1600M月池与1M Credit=¥1计费均成立。"
                       if pid == "stepfun_plus_cn" else
                       "借用Plus验证过的Credit计费口径，池额为官方表值、本档未面板验证。")
                    + "分数：AA index 44（用户截图整数读数，疑为 v4.3 后新版 index）；TB4 33.3% 为 AA 独立实测（非自报）。"
                )
            else:
                blended_cny = blended_low(cached, inp, out)
                yi = round(credit_m / blended_cny / 100, 3)
                conf = "medium"
                note = (
                    f"{round(credit_m / blended(cached, inp, out) / 100, 3):g}→{yi:g}亿："
                    "Step实测负载打不到97.5% cache（2026-09-22用户裁定），改套低缓存统一负载"
                    f"（conventions.lowCacheTokenMix 85%/14.65%/0.35%）混合价¥{blended_cny:.3f}/M；"
                    f"国内站月度{credit_m:g}M Credit÷该价，1M Credit=¥1，cached/input/output=¥{cached:g}/{inp:g}/{out:g}。"
                    "英文 $1≈7M 与人民币口径对 3.5 差 0%、对 3.7 因美元价四舍五入少 3.2%，采用中文精确口径。"
                    "未采用旧 Coding Plan Prompt/5h 表；未加 Studio 40% 创作额度；"
                    "step-3.5-flash-2603 与 3.5 同价不单列；step-router-v1 不画独立点。"
                    "无面板 token+% 或打满实测，按官方绝对 Credit+价表+统一低缓存口径"
                )
            rows.append((pid, name, price, "CNY", model, yi, conf, STEPFUN_SOURCE, note))
    return rows


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
    # OpenAI —— Sol 为 Terra/5.5 基准；Luna 改用 Plus 用户面板实测，Pro 档按官方 5x/20x 推算
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-5.6-sol", 6.16, "medium", "awesome-coding-plan 2026-07-30 实测", ""),
    ("chatgpt_pro_5x", "ChatGPT Pro 5x", 100, "USD", "gpt-5.6-sol", 30.8, "medium", "Plus × 官方 5x", "flat.json 写 38.9 与官方 5x 不符，改 30.8"),
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-5.6-sol", CHATGPT_PRO20X_SOL_MONTHLY_YI, "high", "五源实测加权：Observatory 143.6×3 + 《财经》109×3 + 网关 139.5×2 + 健康周 131.2×2 + imon139 120×1；chatgpt-quotas-round5 / caijing-2026-08 / chatgpt-pro20x-gateway-measurement-2026-09-06", f"用户拍板 123.2（Plus×20 派生）→{CHATGPT_PRO20X_SOL_MONTHLY_YI:g} 亿加权值：权重沿用 Astra round14 惯例，派生值不入权仅对照；网关段间 108~154 亿、含两段 Astra 降权不剔除；健康周 7.87 亿=24%→131 亿；《财经》受控打满 109 亿为最低端；imon139 同帖口述「~30 亿/周」；文章 200 亿作废"),
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-5.6-luna", chatgpt_luna_monthly_yi(), "high", "用户Plus面板：112,666,769 total tokens = 周额度约6%；chatgpt-luna-adoption-round6-2026-09-08.json", "旧120.12亿（Sol基准×统一credits价比19.5）→75.11亿：112,666,769÷6%×4周；直接保留面板total，不再套标准负载。6%若为整数四舍五入，范围约69.33~81.94亿/月；实测token构成为cache read 97.06%、普通输入2.61%、输出0.33%"),
    ("chatgpt_pro_5x", "ChatGPT Pro 5x", 100, "USD", "gpt-5.6-luna", chatgpt_luna_monthly_yi(5), "medium", "Plus Luna实测×官方5x；chatgpt-luna-adoption-round6-2026-09-08.json", "旧600.6亿→375.56亿：Plus Luna面板反推基准×官方5x；非Pro 5x账号独立实测"),
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-5.6-luna", chatgpt_luna_monthly_yi(20), "medium", "Plus Luna实测×官方20x；GitHub #8社区美元等效旁证；chatgpt-luna-adoption-round6-2026-09-08.json", "旧2402.4亿→1502.22亿：Plus Luna面板反推基准×官方20x；按截图实际token组成折公开API价，约$1073/周，与社区‘Luna x20不到$1200、Sol x20约$2000’同量级。美元等效仅作池比旁证，不直接换token"),
    # Astra —— 用户Plus账号2026-09-11晚周窗26pt打满直测；Pro20x按round13同框簇挂点（8亿簇5条独立来源），5x按Sol档间4×派生
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-6-astra", chatgpt_astra_monthly_yi(), "high", "用户Plus面板：10,336,745 tokens(input+cache_read) = 周窗剩余26pt；chatgpt-astra-adoption-round7-2026-09-11.json", "新增1.59亿：10,336,745÷26%×4周；本次抽取未含output（Luna同法占0.33%，影响<1%）；26pt为取整读数差，范围约1.53~1.65亿；Plus定价页写明Astra为limited档（可加credits），直测的是实际消耗速率不受影响；round8发现Observatory现测Astra≈4.1×Sol，round7旧权重2×互证口径存疑，本值不依赖权重模型；round13新增Plus同框32~75M/周散布于1.28~3.0亿/月，与1.59亿同量级不改值；Pro20x已按round13挂点"),
    # Pro20x Astra —— round12 因三源分歧2.7×暂不挂点；round13 用户转供同框批次（g5a/g8）+ sdmat 使 8 亿簇达 5 条独立来源，裁决收敛
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-6-astra", CHATGPT_PRO20X_ASTRA_MONTHLY_YI, "medium", "8条实测源加权：Observatory 8.53、round10截图13.8、round13同框7.52、round14用户面板10.0、msg7086 8.07、round14图4(2/3周)8.18、图2自述9.25、图3后台10.3亿/周；chatgpt-astra-round12/13/14", f"新增{CHATGPT_PRO20X_ASTRA_MONTHLY_YI:g}亿：周池{CHATGPT_PRO20X_ASTRA_WEEK_YI:g}亿×{MONTH_WEEKS:g}周——实测源按验证等级加权（面板同框/用户面板/连续序列×3、自述份额×2、社区口述×1），round10的10%与档位经用户确认由不采改为入权；round14新口径：周池≈$1200~1500 list-worth（Astra），同池Sol $2200~2500，内部计权对Astra惩罚~1.9×；用户自测≈32亿/月与lichengzhe网关21~23亿按用户指示不入权，纯口述与仅下限源不进均值；隐含权重≈{CHATGPT_PRO20X_SOL_MONTHLY_YI/4/CHATGPT_PRO20X_ASTRA_WEEK_YI:.2f}×Sol；同源真实测量仍散布6.8~15.6亿/周，账号间池子可能本就不同，此值为加权中心而非普适常数"),
    # Devin —— 用户Max账号本周87pt近满周段astra单列反推（305M tokens/667 calls）；swe-2-max等免费不占额度，Max官方为周池无日上限
    ("devin_max", "Devin Max", 200, "USD", "gpt-6-astra", devin_max_astra_monthly_yi(), "high", "用户Devin Max面板cc usage：本周gpt-6-astra-high total 305,025,580 tokens（calls 667，in 1,998/out 369,918/cache_read 300,944,710/cache_create 3,708,954）= 周额度87pt（剩余100%→13%）；devin-usage-round4-2026-09-14.json；https://devin.ai/pricing Max $200/月", "16.24→14.02亿：305,025,580÷87%×4周；全口径total直接采用不归一；87pt近满周样本（round2 20pt段的3.76倍）取代旧反推，周池406M→350.6M（-13.7%，旧段取整偏差或周池下调，round2/3留作历史证据不覆盖）；取整区间约13.94~14.11亿；命中率按含cache_create口径98.78%（与round2段97.84%同量级，均为极端缓存型负载）；swe-2-max等免费不占额度；Pro $20档无数据不派生"),
    # Google —— Antigravity 合池按 API worth 计权（官方机制）；round7 用户本地实测补上首个周帽同框
    ("google_ai_pro_us", "Google AI Pro", 19.99, "USD", "gemini-3.8-flash", google_ai_pro_monthly_yi(), "high", "用户本地实测：B整段55.343M raw(cache45.69M/in9.26M/out0.40M)=周条+9.88%；gemini-weekly-round7-2026-09-21.json", f"新增{google_ai_pro_monthly_yi():g}亿：55.343M÷9.88%×{MONTH_WEEKS:g}周=周池5.60亿raw；worth计权经B1/B2段内验（%比0.405≈worth比0.407，非raw比0.448），周帽合$120.1 worth；worth池raw额度随负载mix变——本样本cache 82.6%，用户指出Gemini实际负载打不到标准口径的97.5% cache，故采raw实测而非标准负载折算（折算口径46.9亿/月偏高弃用）；LLMDevs Pro~1.0B/周与Ultra~5.0B/周(恰5×)量级吻合；round6的5h锚$20.4→周≈5.9 sprint自洽"),
    ("google_ai_ultra_5x_us", "Google AI Ultra 5x", 99.99, "USD", "gemini-3.8-flash", round(google_ai_pro_monthly_yi() * 5, 2), "low", "官方：Ultra $100 = 5× Pro token worth（antigravity.google/blog 2026-05-19）", f"新增{google_ai_pro_monthly_yi()*5:g}亿：Pro采用值×官方worth倍率5；LLMDevs Ultra~5.0B/周同量级旁证；非独立实测"),
    ("google_ai_ultra_20x_us", "Google AI Ultra 20x", 199.99, "USD", "gemini-3.8-flash", round(google_ai_pro_monthly_yi() * 20, 2), "low", "官方：Ultra $200 = 20× Pro token worth（antigravity.google/blog 2026-05-19）", f"新增{google_ai_pro_monthly_yi()*20:g}亿：Pro采用值×官方worth倍率20；非独立实测"),
    # Anthropic —— Pro采用shownotover面板截图反推Opus5周池；Max采用9/14永久口径估算157亿，非当期boost或纯Opus5硬上限
    #   5x/20x是5h窗口倍率；用户明确20x周池仅为5x的2倍，旧2.25周池比例不再采用；Pro无独立Opus周池（官方文档），7% all-models周读数即绑定约束
    ("claude_pro", "Claude Pro", 20, "USD", "claude-opus-5", claude_pro_opus5_monthly_yi(), "high", "X @shownotover Pro /usage 面板：32.87M total = 周池7%（用户提供截图）；claude-adoption-round8-2026-09-20.json；round9 升 high", f"Opus4.8历史15.88亿→Opus5面板反推{claude_pro_opus5_monthly_yi():g}亿：32,868,513 total（opus5 32.85M + haiku 23k）÷7%×{MONTH_WEEKS:g}周；周池4.70亿、5h池56.7M，周池为绑定约束；周%取整区间约17.5~20.2亿；单会话n=1初定medium；round5候选Opus5约1.9亿（假定周消息数）被面板直测推翻作废；标价闭合校验$25.68吻合；2026-09-21用户裁定Opus4.8旧测不入权——round8曾按基准期读法×1.25=19.85亿作互证，但round6记录该值含+50%活动期boost，忠实映射为÷1.5×1.25=13.23亿且与面板矛盾，故仅面板单源；round9同作者第二条40M=周13%记为张力：新周读法12.3亿/续周读法26.7亿/下限读法不约束，基线不可考不入权；2026-09-21用户裁定升high：面板级形式+价格闭合校验+下调后口径+与Max20x周池比8.35×自洽；#3新周读法12.3亿与Max池比将失衡（$20得$100档的相对池份额异常），反证18.78侧。注：曾引'8.28窗/周与Max同构'为旁证，round9检查点反推Max档5h池~7.1亿（非4.74亿满窗读法）后该互证撤回——Max周满窗数~5.5非8.3"),
    ("claude_max_20x", "Claude Max 20x (9/14+)", 200, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI, "medium", "Zenn skipbit实测+用户永久口径；claude-adoption-round6-2026-09-06.json", f"旧80亿→{CLAUDE_MAX_20X_YI:g}亿，9/14起永久口径：47.2亿/周×{MONTH_WEEKS:g}周÷1.5×1.25后取整；参考区间110~200亿。混合模型及非完全同窗样本，非纯Opus5实测硬上限；不取活动期189或裸基准126；round9 alldonesites纯Opus5满窗中位4.74亿（簇4.15~4.74亿三源）为窗容量读数——5h池口径存分歧：chudi检查点反推~7.1亿、官方20×Pro暗示11.34亿，Max周满窗数~5.5而非早记8.3，窗结构不作采用依据；round9时间线校正后Reddit审计转正：「本周」单号21亿cache读=周52%系9/17重置后下调后读数→周池≈40亿→161亿/月与采用值差3%，为纯Opus负载最优周池corroboration；「上周」237亿raw=230%系活动期大池口径不再矛盾；低端张力仅余其5窗假设95亿"),
    ("claude_max_5x", "Claude Max 5x (9/14+)", 100, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI / CLAUDE_WEEKLY_20X_TO_5X, "medium", "用户明确20x周池仅为5x的2倍；claude-adoption-round6-2026-09-06.json", "旧35.6亿→78.5亿，9/14起永久口径157÷2；low→medium按用户确认周池关系推算，非独立实测；不采用36亿消息数候选或70亿/旧2.25倍率；5h窗口4倍关系不套周池"),
    # Fable 5.1 —— round3 首个同框样本（同日 token 日志 × /usage 周%），覆盖 round7"无实测不推"；
    #   档位按用户判断挂 20x，但月额度绝对值与档位无关（19%直接定池）；若实为5x则隐含权重1.31×而非2.61×
    ("claude_max_20x", "Claude Max 20x (9/14+)", 200, "USD", "claude-fable-5.1", claude_fable51_max_monthly_yi(), "medium", "用户提供样本：Max账号同日 /usage 周额度0%→19% 对应 2443 轮 285.6M raw tokens（cache读283M+输出2.6M）；claude-fable51-round3-2026-09-20.json；round9 时间线校正", f"30.06→{claude_fable51_max_monthly_yi():g}亿：样本实测于9/4~5促销期，19%分母是活动期池47.2亿/周非永久池39.25亿——旧算法把混合当量池错挂永久口径且未拆Opus份额；重分解：消耗0.19×47.2=8.97亿当量，Opus份额1.13亿raw权重1，Fable份额1.725亿raw→隐含权重≈{CLAUDE_FABLE51_W:.2f}×Opus（落进Fable5实测4.25~6.5区间自洽）；月额度=157×50%÷{CLAUDE_FABLE51_W:.2f}；美元计权法独立验证得17.0亿；次日3017轮→24%互验（同期口径一致）；单账号n=1定medium"),
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
    # Kimi —— 月池是周池的5倍（不是项目通用4周）；199档本机ccusage反推，其余按官网1x/4x/20x/60x
    #   同名档国内外并点：price_usd 统一按国际版标价（KIMI_INTL），¥价为国内实付；Andante ¥49 无海外同名档
    ("kimi_allegretto_cn", "Kimi 会员 199", 199, "CNY", "kimi-k3", kimi_199_monthly_yi(), "medium", f"本机ccusage {KIMI_199_USED_TOKENS}/{KIMI_199_USED_FRACTION:.0%}反推周额度×Kimi月池{KIMI_MONTHLY_TO_WEEKLY:g}倍；kimi-adoption-round6-2026-09-08.json", "旧11.61亿→14.51亿：用户确认Kimi月池=周池×5，旧值误套项目通用4周；样本以k3-256k为主且含kimi-for-coding，非纯K3 1M实测；SWE1.7短时面板的模型/统计窗口不同，未替换基准；ACP14.28为旧模型旁证，不直接采用"),
    ("kimi_moderato_cn", "Kimi 会员 99", 99, "CNY", "kimi-k3", round(kimi_199_monthly_yi() * 4 / 20, 2), "medium", "199档×官方4/20；kimi-adoption-round6-2026-09-08.json", "旧2.32亿→2.90亿：随199档改用周池×5；继承K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    ("kimi_andante_cn", "Kimi 会员 49", 49, "CNY", "kimi-k3", round(kimi_199_monthly_yi() / 20, 2), "medium", "199档×官方1/20", ""),
    ("kimi_allegro_cn", "Kimi 会员 699", 699, "CNY", "kimi-k3", round(kimi_199_monthly_yi() * 60 / 20, 2), "medium", "199档×官方60/20；kimi-adoption-round6-2026-09-08.json", "旧34.83亿→43.53亿：随199档改用周池×5；继承K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    # K2.7 Standard —— ¥199纯模型面板直接按月百分比反推；其余档按官方Code credits 1x/4x/20x/60x
    ("kimi_allegretto_cn", "Kimi 会员 199", 199, "CNY", "kimi-k2.7-code", kimi_k27_199_monthly_yi(), "medium", f"V2EX纯K2.7面板 {KIMI_K27_199_USED_TOKENS}/{KIMI_K27_199_MONTHLY_USED_FRACTION:.2%}=15.68亿；kimi-k27-round7-2026-09-08.json；kimi-k27-adoption-round8-2026-09-08.json", "新增K2.7 Standard独立点：采用直接月%反推15.68亿，不与较弱的699档混合样本取中点；可信范围约15.6~16.7亿。单一纯模型账号证据high，但跨账号/时期采用降为medium"),
    ("kimi_moderato_cn", "Kimi 会员 99", 99, "CNY", "kimi-k2.7-code", round(kimi_k27_199_monthly_yi() * 4 / 20, 2), "medium", "199档×官方4/20；kimi-k27-adoption-round8-2026-09-08.json", "新增3.14亿：继承199档15.68亿与官方Code credits倍率；非独立实测"),
    ("kimi_andante_cn", "Kimi 会员 49", 49, "CNY", "kimi-k2.7-code", round(kimi_k27_199_monthly_yi() / 20, 2), "medium", "199档×官方1/20；K2.7 Standard所有会员可用；kimi-k27-adoption-round8-2026-09-08.json", "新增0.78亿：继承199档15.68亿与官方Code credits倍率；非独立实测。该档仅排除K3，不排除K2.7 Standard"),
    ("kimi_allegro_cn", "Kimi 会员 699", 699, "CNY", "kimi-k2.7-code", round(kimi_k27_199_monthly_yi() * 60 / 20, 2), "medium", "199档×官方60/20；kimi-k27-adoption-round8-2026-09-08.json", "新增47.04亿：继承199档15.68亿与官方Code credits倍率；独立699档K2.7占主导混合大样本缩回199档约16.74亿，仅作范围旁证"),
    # Kimi 海外 —— 不单画：官方 Code credits 倍率 1×/5×/15×/30× 与国内 1/4/20/60× 体系不同，且无绝对 token 证据；
    #   同名档按 KIMI_INTL 并入国内点、按国际版美元标价展示，仅海外档（Vivace $199）仍不画
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
    # 阶跃 Step Plan 国内站 —— 官方 Credit 月池 × 人民币三段价；国际站月费不同、不另画。
    *stepfun_rows(),
]

# ---- 不计额度（unmetered）订阅点：月费 ÷ 无界可用量 → $0/MTok。无 token 分母，图上用专用刻度位，不进对数换算。
#   元组：(id, name, price, cur, model, conf, src, note)。促销口径，促销结束必须复核；见 conventions.promotions。
SWE2_PROMO = CONVENTIONS["promotions"]["devin_swe2"]
UNMETERED = [
    ("devin_pro", f"Devin Pro (促销至 {SWE2_PROMO['endDate'][5:].replace('-', '/')})", 20, "USD", "swe-2", "medium",
     "官推2026-09-10：SWE-2 free for all Pro, Max & Teams subscribers for the next month；用户面板同段swe-2 45.5M tokens不计额度；docs.devin.ai/admin/billing/usage 无并发上限；devin-swe2-round1-2026-09-12.json",
     f"新增≈$0/MTok（记0）：SWE-2 促销期对 Pro/Max/Teams 不占额度、不计费，无并发上限→分母无界；用户拍板按促销价进前沿并改变前沿，截止 {SWE2_PROMO['endDate']}（用户给定，官推仅写 for the next month）；取最便宜可得档 Pro $20，Max 同 Y 更贵不重复画；促销结束后必须复核计费权重，定价页永久免费口径为 SWE 1.7 不是 SWE-2"),
]

# ---- 同一套餐内推更多模型：(基准 plan_id, 基准模型, 新模型, token 倍率, 置信度, 依据, 是否进精选图)
#   倍率 = 基准模型混合标价 / 新模型混合标价（订阅按 compute cost / credits 计量时成立）；Anthropic Fable 用 Reddit 实测订阅内权重
RATIO_COMPOSER = blended(0.5, 2, 6) / blended(0.2, 0.5, 2.5)   # Grok 4.6 → Composer 2.5 Standard ≈ 2.57110
RATIO_COMPOSER_FAST = blended(0.5, 2, 6) / blended(0.5, 3, 15)
RATIO_SONNET = round(blended(0.5, 5, 25) / blended(0.2, 2, 10), 2)       # Opus → Sonnet 5 = 2.5
DERIVED = [
    # OpenAI：Terra/5.5仍按三段credits与项目统一标准负载从Sol换算；Luna已有独立实测，不再从Sol派生
    *[(pid, "gpt-5.6-sol", model, blended(10, 100, 500) / blended(*rates), "medium",
       f"https://learn.chatgpt.com/docs/pricing 三段credits（cache/input/output）Sol=10/100/500，对比{rates}；旧倍率{old_ratio}、旧月额度{sol_yi * old_ratio:g}亿作废；保留Sol基准，按项目统一标准负载重算；见audit-round4-2026-09-05.json",
       pid != "chatgpt_pro_5x" and model != "gpt-5.6-terra")
      for pid, sol_yi in (("chatgpt_plus", 6.16), ("chatgpt_pro_5x", 30.8), ("chatgpt_pro_20x", CHATGPT_PRO20X_SOL_MONTHLY_YI))
      for model, rates, old_ratio in (("gpt-5.6-terra", (5, 50, 300), 2),
                                      ("gpt-5.5", (12.5, 125, 750), 0.8))],
    # Anthropic：Sonnet 5 标价 = Opus 的 0.4 → ×2.5；Opus 4.8 与 Opus 5 同价 → ×1；Fable 订阅内权重统一 6.5×（Reddit x5 档 4.25 系 typed meter 软读数、与用户确认 2× 周池比矛盾，不采），且最多占周额度 50%
    ("claude_pro", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "medium", "旧39.7亿→46.95亿：基准随round8换Opus5面板反推18.78亿×标价比2.5；claude-adoption-round8-2026-09-20.json", True),
    ("claude_pro", "claude-opus-5", "claude-opus-4.8", 1.0, "low", "与Opus5同价同池，round8基准派生；历史实测15.88亿留作round5前证据不覆盖；claude-adoption-round8-2026-09-20.json", False),
    ("claude_max_20x", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "medium", "旧200亿→392.5亿，low→medium；157×Opus/Sonnet标价比2.5，9/14永久口径派生，非Sonnet实测；claude-adoption-round6-2026-09-06.json", True),
    ("claude_max_20x", "claude-opus-5", "claude-opus-4.8", 1.0, "low", "旧80亿→157亿；与Opus5同价，9/14永久基准派生；claude-adoption-round6-2026-09-06.json", False),
    ("claude_max_20x", "claude-opus-5", "claude-fable-5", 0.5 / 6.5, "low", "旧6.152亿→12.077亿；157×0.5/6.5，不再预舍入倍率；订阅内6.5×权重且限周额度50%，9/14永久口径派生；claude-adoption-round6-2026-09-06.json", True),
    ("claude_max_5x", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "low", "旧89亿→196.25亿；78.5×标价比2.5，9/14永久口径派生；claude-adoption-round6-2026-09-06.json", False),
    ("claude_max_5x", "claude-opus-5", "claude-fable-5", 0.5 / 4.25, "low", "维持9.235亿：x5档唯一实测权重4.25×（Reddit 1vx0k69，原帖自标typed meter偏软）；注意与用户确认2×池比矛盾——若20x=12.077亿成立则5x按池比应约6.04亿，但那需要无实测的统一权重假设，用户裁定按实测数据来；claude-adoption-round7-2026-09-14.json", False),
    # Fable 5.1：20x 已按 round3 同框样本挂 30.06亿（SUBS 直测行）；5x 借其隐含权重 2.61 派生，
    #   注意 Fable5 权重两档本就不同（6.5/4.25），跨档同权重只是假设 → low
    ("claude_max_5x", "claude-opus-5", "claude-fable-5.1", CLAUDE_FABLE_WEEKLY_CAP / CLAUDE_FABLE51_W, "low", f"15.03→{78.5*CLAUDE_FABLE_WEEKLY_CAP/CLAUDE_FABLE51_W:g}亿：78.5×0.5/{CLAUDE_FABLE51_W:.2f}——借20x同框样本隐含权重派生（round9 时间线校正后权重2.61→4.54），非独立实测；单权重跨档沿用仍属假设（Fable5 两档不同为前车之鉴）；claude-fable51-round3/round9", False),
    # Astra Pro5x：沿用 Sol 档间 4× 关系由 20x 采用值派生；prolite 同框 2.31亿/周≈9.2亿/月量级接近（多代理高负载偏大，不直接采）
    ("chatgpt_pro_5x", "gpt-5.6-sol", "gpt-6-astra", CHATGPT_PRO20X_ASTRA_MONTHLY_YI / CHATGPT_PRO20X_SOL_MONTHLY_YI, "low", f"{CHATGPT_PRO20X_ASTRA_MONTHLY_YI/4:g}→{30.8*CHATGPT_PRO20X_ASTRA_MONTHLY_YI/CHATGPT_PRO20X_SOL_MONTHLY_YI:g}亿：{CHATGPT_PRO20X_ASTRA_MONTHLY_YI:g}×30.8/{CHATGPT_PRO20X_SOL_MONTHLY_YI:g}（沿用Sol 20x→5x档间比例，基准随Sol 20x加权值联动{CHATGPT_PRO20X_SOL_MONTHLY_YI/30.8:.2f}×）；round12 codex#45085 prolite同框2.31亿/周≈9.2亿/月量级接近但为多代理Astra High放大样本，不直接采；chatgpt-astra-sameframe-round13-2026-09-20.json", False),
    # Pro 档 Fable 5/5.1 套餐内不可用（走 usage credits，官方 high），不挂点
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
METERED_NOTES = {
    "deepseek_v41_flash_offpeak": "旧0.00811（¥0.02/¥1/¥4÷6.7787）→0.00825；改用官方美元标价 cached/input/output=$0.003/$0.15/$0.60，套项目统一标准负载。不再用人民币÷项目汇率。api-docs.deepseek.com 2026-09-10；用户确认；list-prices-deepseek-v41-round2-2026-09-10.json。旧V4点按用户要求不改。",
    "deepseek_v41_flash_peak": "旧0.01623（¥0.04/¥2/¥8÷6.7787）→0.01650；改用官方美元标价 cached/input/output=$0.006/$0.30/$1.20，套项目统一标准负载。高峰=闲时2倍。api-docs.deepseek.com 2026-09-10；用户确认；list-prices-deepseek-v41-round2-2026-09-10.json。旧V4点按用户要求不改。",
}
METERED = [
    ("deepseek_v41_flash_offpeak", "DeepSeek V4.1 Flash API 闲时", "deepseek-v4.1-flash", 0.003, 0.15, 0.60, "https://api-docs.deepseek.com/quick_start/pricing/；list-prices-deepseek-v41-round2-2026-09-10.json"),
    ("deepseek_v41_flash_peak", "DeepSeek V4.1 Flash API 忙时", "deepseek-v4.1-flash", 0.006, 0.30, 1.20, "https://api-docs.deepseek.com/quick_start/pricing/；list-prices-deepseek-v41-round2-2026-09-10.json"),
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
    ("anthropic_fable51_api", "Claude Fable 5.1 API", "claude-fable-5.1", 0.25, 10.0, 50.0, "platform.claude.com/docs/en/about-claude/pricing；cache read $0.25=base input×0.025（其他模型0.1×），in/out 与 Fable 5 同价；claude-fable51-round1-2026-09-13.json"),
    ("openai_terra_api", "GPT-5.6 Terra API", "gpt-5.6-terra", 0.2, 2.0, 12.0, "developers.openai.com"),
    ("openai_luna_api", "GPT-5.6 Luna API", "gpt-5.6-luna", 0.02, 0.2, 1.2, "developers.openai.com"),
]

# 精选图只画主流套餐 + 前沿相关点，避免 60 个点挤在一起；全量图画全部
MAIN_PLANS = {"chatgpt_plus", "chatgpt_pro_20x", "claude_pro", "claude_max_20x", "cursor_ultra", "cursor_ultra_fast", "cursor_pro",
              "google_ai_pro_us",
              "supergrok_heavy", "supergrok", "kimi_allegretto_cn", "glm_coding_pro_cn_new_peak", "glm_coding_pro_cn_new_mid", "glm_coding_pro_cn_new_offpeak", "glm_coding_pro_cn_old_peak", "glm_coding_pro_cn_old_mid", "glm_coding_pro_cn_old_offpeak",
              "minimax_token_plus_cn", "minimax_token_plus_global", "aliyun_coding_pro_cn", "devin_max", "devin_pro"}
MAIN_EXTRA = {
    ("opencode_go", "deepseek-v4.1-flash"),
    ("opencode_go", "glm-5.3-flash"),
    ("command_code_goat", "deepseek-v4.1-flash"),
}


def is_main(pid: str, model: str) -> bool:
    return (pid in MAIN_PLANS and model != "gpt-5.6-terra") or (pid, model) in MAIN_EXTRA


EXCLUDED_SUBSCRIPTIONS = {
    ("kimi_andante_cn", "kimi-k3"): "旧0.58亿为199档按4周×1/20推算；即使按Kimi周池×5修正为0.73亿，也因2026-09-05用户确认‘就是不能调用’而继续排除；官方https://www.kimi.com/code/docs/kimi-code/models限定Moderato及以上可调用K3；同档可用的K2.7 Standard已作为独立点纳入"
}

FIELDS = ["plan_id", "plan_name", "plan_name_en", "billing", "price", "currency", "price_usd", "served_model",
          "monthly_tokens", "monthly_yi", "real_usd_per_mtok", "unmetered", "promo_until", "confidence", "chart_tier", "source", "decision_note",
          "plan_gen", "workload"]


def plan_gen_of(pid: str) -> str:
    # 套餐代际标注（2026-09-22 用户裁定）：GLM Coding 老客档=v2、新客档=v3（与 plot_quotas plan_name 映射一致）；
    # Kimi 音乐名会员档=v1（新套餐 Plus/Pro/Max 未入库，届时为当前代不标）。其余套餐为当前代不标。
    if pid.startswith("glm_coding_"):
        return "v2" if "_old_" in pid else "v3"
    if pid.startswith("kimi_"):
        return "v1"
    return ""


def workload_of(pid: str, billing: str) -> str:
    # 额度口径分类（2026-09-22，详情面板用）：标准负载折算=美元/积分池÷standardTokenMix混合价；
    # 低缓存负载=÷lowCacheTokenMix；measured=面板/ccusage raw token 直测或同源派生，不经负载折算。
    if billing == "metered":
        return "standard"  # API 标价行恒按标准负载加权
    if pid.startswith("stepfun_"):
        return "lowCache"
    if pid.startswith(("opencode_", "command_code_", "ollama_", "glm_coding_")):
        return "standard"
    return "measured"


def sub_row(pid, name, price, cur, model, yi, conf, src, note, tier=None) -> dict:
    if model == "composer-2.5" and not pid.endswith("_composer_fast"):
        name += " (Standard)"
    intl = KIMI_INTL.get(pid)
    if intl is not None:
        name_en, price_usd = intl
        note = (note + f"；同名档国内外并为一点：月费与单价统一按国际版 {name_en} ${price_usd:g} 标价"
                f"（旧按国内 ¥{price}÷{USD_PER_CNY:g}≈${price / USD_PER_CNY:.2f}），price/currency 仍记国内实付价；"
                "额度仍国内档口径，海外同名档绝对 token 未实测，并点仅作价位展示").lstrip("；")
    else:
        name_en = ""
        price_usd = price / USD_PER_CNY if cur == "CNY" else price
        if cur == "CNY":
            fx = CONVENTIONS["exchangeRate"]
            note = (note + f"；汇率1 USD={USD_PER_CNY} CNY（{fx['date']} {fx['kind']}），"
                    f"旧汇率{fx['previousRate']}；人民币月费除以汇率换美元；{fx['source']}").lstrip("；")
    monthly_yi = round(yi, 3)
    tokens = round(monthly_yi * YI)
    return dict(plan_id=pid, plan_name=name, plan_name_en=name_en, billing="subscription", price=price, currency=cur,
                price_usd=round(price_usd, 2), served_model=model, monthly_tokens=int(tokens),
                monthly_yi=monthly_yi, real_usd_per_mtok=round(price_usd / tokens * 1e6, 5), unmetered="", promo_until="",
                confidence=conf, chart_tier=tier or ("main" if is_main(pid, model) else "full"), source=src, decision_note=note,
                plan_gen=plan_gen_of(pid), workload=workload_of(pid, "subscription"))


def unmetered_row(pid, name, price, cur, model, conf, src, note) -> dict:
    return dict(plan_id=pid, plan_name=name, plan_name_en="", billing="subscription", price=price, currency=cur,
                price_usd=round(price / USD_PER_CNY if cur == "CNY" else price, 2), served_model=model,
                monthly_tokens="", monthly_yi="", real_usd_per_mtok=0, unmetered="true", promo_until=SWE2_PROMO["endDate"],
                confidence=conf, chart_tier="main" if is_main(pid, model) else "full", source=src, decision_note=note)


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
    rows += [unmetered_row(*u) for u in UNMETERED]
    for pid, name, model, cached, inp, out, src in METERED:
        rows.append(dict(plan_id=pid, plan_name=name, plan_name_en="", billing="metered", price="", currency="USD", price_usd="",
                         served_model=model, monthly_tokens="", monthly_yi="", real_usd_per_mtok=round(blended(cached, inp, out), 5),
                         unmetered="", promo_until="", confidence="high", chart_tier="main", source=src,
                         decision_note=METERED_NOTES.get(pid, f"标价 cached {cached}/in {inp}/out {out} × 项目统一标准负载 {STANDARD_MIX['cache']:.1%}/{STANDARD_MIX['input']:.2%}/{STANDARD_MIX['output']:.2%}")))

    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows -> {OUT}")
    for r in sorted((r for r in rows if r["billing"] == "subscription"), key=lambda r: r["real_usd_per_mtok"]):
        print(f"  {r['real_usd_per_mtok']:>8.4f}  {r['plan_name']:<32} {r['served_model']:<18} {r['confidence']}")


if __name__ == "__main__":
    main()
