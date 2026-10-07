# -*- coding: utf-8 -*-
"""生成 data/adopted.csv：每个 (套餐, 实际服务模型) 一行，一个采用值。

所有取舍在这里写死并注明理由；原始多源数据留在 data/subscription-quotas*.json 不动。
真实单价 = 月费(USD) / 月 token（全口径：输入+缓存读+缓存写+输出一视同仁；默认月=4周，厂商独立月池除外；饱和使用）。
"""
from __future__ import annotations

import csv
import json
import re
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
# Grok 4.6 周池 —— 2026-09-30 裁定带分项实测统一折算（此前为 raw 合计口径）：
#   issue #56（Grok Build _x.ai/billing 每 5 分钟轮询周额度 %，对照 unified.jsonl）两个完整平常周
#   cache 206.4M / 入 15.3M / 出 1.29M = +193 个百分点，按 Grok API 价折 worth $141.54；
#   V2EX 受控打满 127,272,629 token（整周 100%）无分项，按已是标准档计 worth $71.909；
#   两样本按百分点合并 ÷293pp → 周 worth ÷ 标准档混合价 $0.565/MTok = 周池 token
#   （计算在 SUPERGROK_WEEKLY_TOKENS，定义于 blended 之后）；疑似双倍活动周（236M、274M）与低命中周未计入。
SUPERGROK46_ISSUE56_SEGMENT = {"cache_read": 206_400_000, "input": 15_300_000, "output": 1_290_000}
SUPERGROK_V2EX_WEEK_TOKENS = 127_272_629
# Grok 4.7 周池：round2 维护者本机实测（Grok Build CLI，xhigh）——「这次」窗 cache 51,728,640 /
#   未缓存入 4,621,905 / 出 278,838 = 56,629,383 tok = 周额度 +45.5475%（裁定三窗中该窗最可信：
#   消耗份额最大、读数取整误差占比最小；「之前」8% 窗反推 176.1M、汇总 132.1M 不采）。
#   round1（三会话 13.44M/约8%→168.0M/周）删除版份额系推断，偏高约 35%，已被本轮取代。
#   「之前」窗已确认为 round1 三会话之和：删除版实得 628,541 tok、实占约 0.36% 周池（round1 按约 1% 估）。
#   2026-09-30 起按标价折 worth ÷45.5475% ÷ 标准档混合价换算（见 SUPERGROK47_WEEKLY_TOKENS）。
SUPERGROK47_ROUND2_SEGMENT = {"cache_read": 51_728_640, "input": 4_621_905, "output": 278_838}
SUPERGROK47_ROUND2_FRACTION = 0.455475
SUPERGROK_PANEL_USD = 25
CHATGPT_PLUS_LUNA_USED_TOKENS = 112_666_769
CHATGPT_PLUS_LUNA_USED_FRACTION = 0.06
CHATGPT_PLUS_ASTRA_USED_TOKENS = 10_336_745
CHATGPT_PLUS_ASTRA_USED_FRACTION = 0.26
# GPT-6 Sol（9/22 新发）Plus —— 2026-09-24 维护者本机 Codex 实测：当日增量 15,716,975 tok（全 gpt-6-sol）= 周额度约 6%
CHATGPT_PLUS_SOL6_SEGMENT = {"input": 693_878, "output": 46_713, "cache_read": 14_976_384}
CHATGPT_PLUS_SOL6_USED_TOKENS = 15_716_975
CHATGPT_PLUS_SOL6_USED_FRACTION = 0.06
assert sum(CHATGPT_PLUS_SOL6_SEGMENT.values()) == CHATGPT_PLUS_SOL6_USED_TOKENS
# GPT-6 Luna（9/22 新发）Plus —— round2：2026-09-28 维护者本机 Codex 实测（effort=max）：
#   新一周窗 09-27 22:09 97% → 09-28 20:44 91%（6pp），段内 +137,648,446 tok 全为 gpt-6-luna
#   （gpt-5.6-luna 累计 205,934,189 未动、6sol/astra 计数未动）。本周 22.94M tok/pp ≈ round1 合并样本
#   11.01M 的 2.08×（standard 段 10.20M 的 2.25×），两侧取整区间不重叠，判周池放大或 effort 计权变化而非噪声；
#   裁定新一周分开记，采用本周样本，round1（48%→35%，143,157,917 tok/13pp→44.05亿）留作对照不合并不平均
CHATGPT_PLUS_LUNA6_SEGMENT = {"input": 3_129_683, "output": 757_355, "cache_read": 133_761_408}
CHATGPT_PLUS_LUNA6_USED_TOKENS = 137_648_446
CHATGPT_PLUS_LUNA6_USED_FRACTION = 0.06
assert sum(CHATGPT_PLUS_LUNA6_SEGMENT.values()) == CHATGPT_PLUS_LUNA6_USED_TOKENS
# GPT-6.1 Sol（GPT-6 Sol 后继）Plus —— 2026-09-30 维护者本机 Codex 实测：周窗剩余 81%→50%（31pp），
#   整段 55,532,850 tok 全为 gpt-6.1-sol（=81%→65% + 65%→60% + 60%→50% 三段边界拼合；截图标题 82%/32pp，
#   起始读数更正为 81%）
CHATGPT_PLUS_SOL61_SEGMENT = {"input": 2_742_389, "output": 254_397, "cache_read": 52_536_064,
                              "cache_write": 0}
CHATGPT_PLUS_SOL61_USED_TOKENS = 55_532_850
CHATGPT_PLUS_SOL61_USED_FRACTION = 0.31
assert sum(CHATGPT_PLUS_SOL61_SEGMENT.values()) == CHATGPT_PLUS_SOL61_USED_TOKENS
# GPT-5.6 Luna Plus —— chatgpt-luna-adoption-round6 样本分项（cache_read 109,356,416 / input 2,941,040 / output 369,313）
CHATGPT_PLUS_LUNA_SEGMENT = {"input": 2_941_040, "output": 369_313, "cache_read": 109_356_416}
assert sum(CHATGPT_PLUS_LUNA_SEGMENT.values()) == CHATGPT_PLUS_LUNA_USED_TOKENS
# 实测样本统一折算价目（cached, input, output，USD/MTok）——2026-09-30 裁定：
#   带 token 分项的实测样本按该模型标价折 list-worth 再按负载档混合价换算
GPT6_SOL_LIST = (0.2, 2.0, 10.0)       # $2/$10 为 AA 页标价；cached 按 0.1× 推定
GPT6_LUNA_LIST = (0.01, 0.1, 0.5)      # scores-gpt6luna-round1 存档 AA 标价；cached 按 0.1× 推定
GPT61_SOL_LIST = (0.1, 2.0, 10.0)      # GPT-6.1 Sol 官方价：learn.chatgpt.com token rates credits 2.5/50/250 ÷25；developers.openai.com $2/$0.10/$10（cached=输入5%，写$2.5段内为0）
GPT6_ASTRA_LIST = (1.0, 10.0, 50.0)
GPT56_LUNA_LIST = (0.02, 0.2, 1.2)     # METERED openai_luna_api（1:10:60）
GROK_LIST = (0.5, 2.0, 6.0)            # Grok 4.6/4.7 <200K 官方 API 价（docs.x.ai）
GEMINI_FLASH_LIST = (0.075, 0.75, 3.75)  # Gemini Flash 引入价至 2026-12-31（gemini-weekly-round7）
# Astra Pro20x 周池 —— round14 后按实测源加权（round10 的 10% 与 Pro20x 档位经确认属实）：
#   Observatory 8.53×3 + round10 13.8×3 + g5a 7.52×3 + msg7086 8.07×2 + 图1维护者面板 10.0×3
#   + 图4(2/3周) 8.18×2 + 图2 X自述 9.25×1 + 图3 sub2后台 10.3×1 = 171.6/18 = 9.53 亿/周；
#   维护者自测≈32亿/月与 lichengzhe 网关 21~23 亿按裁定不入权；纯口述与下限源不进均值
CHATGPT_PRO20X_ASTRA_WEEK_YI = 9.53
CHATGPT_PRO20X_ASTRA_MONTHLY_YI = round(CHATGPT_PRO20X_ASTRA_WEEK_YI * MONTH_WEEKS, 2)
# Sol Pro20x —— 2026-09-21 裁定由 Plus×20 派生值改五源实测加权（权重同 Astra round14 惯例：
#   连续序列/受控打满×3、自述份额×2、社区口述×1；Plus×20=123.2 派生值不入权仅对照）：
#   Observatory 遥测 143.6×3 + 《财经》打满 109×3 + 网关 139.5×2（含两段Astra，混合负载降权不剔除）
#   + 社区健康周 131.2×2 + imon139 口述 120×1 = 1419.2/11
CHATGPT_PRO20X_SOL_MONTHLY_YI = round(1419.2 / 11, 2)
# Devin Max —— 同账号 cc usage 两段实测：Astra 段为 round4 87pt 近满周（305,025,580 tok/667 calls，
#   剩余100%→13%）；Opus 5.5 段为双检查点增量（2026-09-23，云端剩余75%→27% 差48pt，
#   xhigh +1,142 calls/+512,221,810 tok hit 92.38%、high +118/+13,111,946 hit 89.32%，合计525,333,756）；
#   裁定各段 pp 全归对应模型增量（swe-2 等免费不占额度）。
#   2026-09-24 裁定：两段实测负载均偏离标准档，入库按标价折 list-worth 再按统一负载档换算
#   （Opus 5.5 用 Anthropic 档、Astra 用标准档——OpenAI 无缓存写费，cache_create 按普通输入计）；
#   raw total 口径留作对照见各行注。worth 对账（恒定池假说）：Opus5.5 段 $336.4(5m写)~$457.2(1h写)
#   →池$700.8~952.5；Astra 段 $356.6~365.8→池$409.8~420.5——恒定池成立须 Opus5.5 按 ~0.6× 标价计，
#   折算只依赖标价比例，不依赖绝对值。
DEVIN_MAX_ASTRA_SEGMENT = {"cache_read": 300_944_710, "cache_create": 3_708_954, "input": 1_998, "output": 369_918}
DEVIN_MAX_ASTRA_USED_TOKENS = 305_025_580
DEVIN_MAX_ASTRA_USED_FRACTION = 0.87
DEVIN_MAX_OPUS55_SEGMENT = {"cache_read": 483_137_835, "cache_create": 40_275_697, "input": 2_672, "output": 1_917_552}
DEVIN_MAX_OPUS55_USED_TOKENS = 525_333_756
DEVIN_MAX_OPUS55_USED_FRACTION = 0.48
OPUS55_LIST = (0.2, 4.0, 20.0)  # cached/input/output 官方标价；5 分钟缓存写价见 ANTHROPIC_CACHE_WRITE_5M
assert sum(DEVIN_MAX_ASTRA_SEGMENT.values()) == DEVIN_MAX_ASTRA_USED_TOKENS
assert sum(DEVIN_MAX_OPUS55_SEGMENT.values()) == DEVIN_MAX_OPUS55_USED_TOKENS
# Droid Max × Opus 5.5 —— 维护者 Factory Droid 本机 /limits 周窗（7-day rolling）已用 1%→9% 两段增量直测：
#   1→5（xhigh）+35,598,616 tok、5→9（high，新会话 47f9711d）+36,567,946 tok，合计 72,166,562 tok ÷ 8pp；
#   段内 auto 0 增量、glm-5.3-flash +50,317（占 0.14%，Droid Core 免费池不进 Opus 速率）；
#   1→9 合计分拆 in 793,017/out 375,172/cache_create 3,640,056/cache_read 67,311,924/thinking 46,393
#   （hit 93.82%，factoryCredits 16,935,482）；同 devin_max×opus-5.5 口径按标价折 worth 再按 Anthropic 档换算，
#   thinking 不计费（2026-09-29 裁定；factoryCredits 对账亦不含 thinking）。
DROID_MAX_OPUS55_SEGMENTS = {"1to5_xhigh": 35_598_616, "5to9_high": 36_567_946}
DROID_MAX_OPUS55_SEGMENT = {"cache_read": 67_311_924, "cache_create": 3_640_056, "input": 793_017,
                            "output": 375_172, "thinking": 46_393}
DROID_MAX_OPUS55_USED_TOKENS = 72_166_562
DROID_MAX_OPUS55_USED_FRACTION = 0.08
assert sum(DROID_MAX_OPUS55_SEGMENTS.values()) == DROID_MAX_OPUS55_USED_TOKENS
assert sum(DROID_MAX_OPUS55_SEGMENT.values()) == DROID_MAX_OPUS55_USED_TOKENS
# Droid Pro × Opus 5.5 —— 社区口述（X @SnowyWar36965，2026-09-28）：Pro $20 跑 Opus 5.5 小动画用掉 5h 窗约 70%，
#   帖主按等价 API 消耗折算 5h≈$15.4 / 周≈$45 / 月≈$160（Max 10x 对应 $154/$450/$1,600）；
#   无 token 分拆与面板截图，只取帖主月值 list-worth，按 Anthropic 档换算（同 droid_max 口径）。
DROID_PRO_OPUS55_COMMUNITY_WORTH_USD = {"5h": 15.4, "week": 45.0, "month": 160.0}
# Factory 30 天滚动窗 = 2× 7 天窗（2026-10-03 维护者裁定）：Droid 月额度按周 ×2，不用通用 ×4 周。
DROID_MONTH_WEEKS = 2
# Google AI Pro 周帽 —— round7 维护者本地实测：B 整段 55.343M raw = 周条 +9.88%。
#   官方按 API worth 合池计权（实证：B1/B2 的 %比 0.405≈worth比 0.407，非 raw比 0.448）；
#   实测 cache 82.6% 打不到标准 97% cache——2026-09-30 裁定带分项样本按标价折 worth 后用低缓存档
#   换算（标准档口径 44.78 亿不采，raw 口径 20.70 亿留作对照）
GOOGLE_PRO_B_TOTAL_TOKENS = 55_343_000
GOOGLE_PRO_B_WEEKLY_FRACTION = 0.0988
GOOGLE_PRO_B_SEGMENT = {"cache_read": 45_688_000, "input": 9_258_000, "output": 398_000}
# issue #54（NTRYourWaifu，agy /quota 每 5 分钟轮询周额度 %）：三个周窗、只计 3.8 Flash ≥95% 区段
#   853.43M raw = +165.77 个百分点，与维护者本机样本按百分点合并（2026-09-29 裁定）
GOOGLE_PRO_ISSUE54_TOKENS = 853_430_000
GOOGLE_PRO_ISSUE54_WEEKLY_PP = 165.77
GOOGLE_PRO_ISSUE54_SEGMENT = {"cache_read": 695_700_000, "input": 146_250_000, "output": 11_480_000}
# issue #55（NTRYourWaifu，agy CLI 同法）：只计 3.6 Flash ≥95% 区段，95.60M raw = +21.70pp
GOOGLE_PRO_ISSUE55_WEEKLY_PP = 21.70
GOOGLE_PRO_ISSUE55_SEGMENT = {"cache_read": 78_320_000, "input": 14_950_000, "output": 2_330_000}
KIMI_199_USED_TOKENS = 243_739_068
KIMI_199_USED_FRACTION = 0.84
KIMI_MONTHLY_TO_WEEKLY = 5
KIMI_K27_199_USED_TOKENS = 11_913_113
KIMI_K27_199_MONTHLY_USED_FRACTION = 0.0076
CLAUDE_PRO_SESSION_TOKENS = 32_868_513
CLAUDE_PRO_WEEKLY_FRACTION = 0.07
# issue #53（NTRYourWaifu，2026-09-30 裁定改用）：两个 Pro 账号 9/14~9/22（均在永久 +25% 之后）每 5 分钟轮询
#   /api/oauth/usage seven_day %、按 message.id 去重 —— Opus 5 共 1,022.02M raw = 周 +148 个百分点；
#   两个整周分别 24.60 / 28.96 亿。取代 @shownotover 单读数 7%（疑似 9/14 前口径），不与之合并
CLAUDE_PRO_OPUS5_ISSUE53_TOKENS = 1_022_020_000
CLAUDE_PRO_OPUS5_ISSUE53_WEEKLY_PP = 148.0
# issue #53 段分项（百万 token）；缓存写全为 1h 档（按实际档位计价，同 #52 口径）
CLAUDE_PRO_OPUS5_ISSUE53_SEGMENT_M = {"cache_read": 1004.96, "cache_write_1h": 12.99,
                                    "input": 0.01, "output": 4.06}
# Opus 5 价目：cache 读 $0.5 / 1h 写 $10 / 入 $5 / 出 $25 → 段 worth $733.93
CLAUDE_PRO_OPUS5_ISSUE53_WORTH_USD = round(
    CLAUDE_PRO_OPUS5_ISSUE53_SEGMENT_M["cache_read"] * 0.5
    + CLAUDE_PRO_OPUS5_ISSUE53_SEGMENT_M["cache_write_1h"] * 10.0
    + CLAUDE_PRO_OPUS5_ISSUE53_SEGMENT_M["input"] * 5.0
    + CLAUDE_PRO_OPUS5_ISSUE53_SEGMENT_M["output"] * 25.0, 4)
# Fable 5.1 —— 首个 token×周% 同框样本（round3，维护者提供的 Max 账号同日日志）：
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

# Opus 5.5 —— round1 社区窗池样本（维护者提供 X @MiaAI_lab 推文截图）：xHigh 1h2m 烧 10.305亿 raw
#   (in 1.4M / out 8.0M / cache读 1.0B / cache写 21.1M) ＝ ~75% of 5h limit → raw 5h池 13.74亿。
#   档位裁定挂 Max 20x（推文未标档；隐含加权窗池量级仅与 Max20x 簇自洽）。
#   月额 = 采用月池(加权) ÷ 隐含权重；权重由样本自解，恰与官方标价混合比 0.5143 收敛
#   （差 1.2%，标价权重法 305.28亿 留作备选不采）。官方发布(9/22)同步上调 Pro/Max/Team
#   5h 上限并发放 rate-limit reset——窗池为发布期口径；公告仅提 5h 调整，周池沿用采用值。
#   交叉验证：13.74亿×0.5143=7.07亿加权 ≈ chudi 反推 Opus5 5h池 7.15亿(-1.1%) 自洽；
#   样本按新价计 $471.1 ≈ 推文 $482.63(+2.4%，token 取整内闭合)。
CLAUDE_OPUS55_SESSION_TOKENS = 1_030_500_000
CLAUDE_OPUS55_5H_FRACTION = 0.75
CLAUDE_OPUS55_POOL5H_YI = CLAUDE_OPUS55_SESSION_TOKENS / CLAUDE_OPUS55_5H_FRACTION / YI  # ≈13.74
CLAUDE_OPUS55_5H_WEIGHTED_YI = 7.15  # chudi 检查点反推 Opus5 5h池（round9 口径之一），作隐含权重锚
CLAUDE_OPUS55_W = CLAUDE_OPUS55_5H_WEIGHTED_YI / CLAUDE_OPUS55_POOL5H_YI  # ≈0.5204
CLAUDE_OPUS55_MAX20X_RAW_MONTHLY_YI = round(CLAUDE_MAX_20X_YI / CLAUDE_OPUS55_W, 2)  # ≈301.7，2026-09-30 前采用值（raw 未折算），留作对照
CLAUDE_OPUS55_SESSION = {"input": 1_400_000, "output": 8_000_000, "cache_read": 1_000_000_000, "cache_write": 21_100_000}
CLAUDE_MAX20X_WINDOWS_PER_WEEK = 5.5  # round10 条目#15 同账号多周 /usage 截图：Max 20x ≈5.5 满窗/周
CLAUDE_MAX20X_TO_PRO_WEEKLY = 10.0  # Max 20x 周额度 = Pro ×10（5h 窗 20×、20x 周池 = 5x 的 2 倍）

# Kimi 国内外同名档并为一点（2026-09-14 裁定）：月费/单价统一按国际版美元标价，
# 国内实付价保留在 price/currency 供展示层注明差价；额度仍国内档实测/派生口径，
# 海外同名档绝对 token 未实测（国际 Code 倍率 1/5/15/30× ≠ 国内 1/4/20/60×），并点仅作价位展示。
# Andante ¥49 无海外同名档，保持国内口径；Vivace $199 仅海外且无额度证据，不画。
# MiMo Token Plan：mimo.mi.com 同档同池双币种标价（¥ 国内 / $ 国际），国内外并点口径与 Kimi 相同
KIMI_INTL = {  # plan_id -> (国际版展示名, 国际版月费 USD)
    "mimo_token_lite_day": ("MiMo Token Plan Lite (Day)", 6),
    "mimo_token_lite_night": ("MiMo Token Plan Lite (Night 0.8x)", 6),
    "mimo_token_standard_day": ("MiMo Token Plan Standard (Day)", 16),
    "mimo_token_standard_night": ("MiMo Token Plan Standard (Night 0.8x)", 16),
    "mimo_token_pro_day": ("MiMo Token Plan Pro (Day)", 50),
    "mimo_token_pro_night": ("MiMo Token Plan Pro (Night 0.8x)", 50),
    "mimo_token_max_day": ("MiMo Token Plan Max (Day)", 100),
    "mimo_token_max_night": ("MiMo Token Plan Max (Night 0.8x)", 100),
    "kimi_moderato_cn": ("Kimi Moderato", 19),
    "kimi_allegretto_cn": ("Kimi Allegretto", 39),
    "kimi_allegro_cn": ("Kimi Allegro", 99),
}

STANDARD_MIX = CONVENTIONS["standardTokenMix"]


def blended(cached: float, inp: float, out: float) -> float:
    return STANDARD_MIX["cache"] * cached + STANDARD_MIX["input"] * inp + STANDARD_MIX["output"] * out


LOW_CACHE_MIX = CONVENTIONS["lowCacheTokenMix"]


def blended_low(cached: float, inp: float, out: float) -> float:
    # 低缓存负载（step-5-preview 本机实测 mix）：用于实测打不到标准 97% cache 的渠道
    return LOW_CACHE_MIX["cache"] * cached + LOW_CACHE_MIX["input"] * inp + LOW_CACHE_MIX["output"] * out


ANTHROPIC_MIX = CONVENTIONS["anthropicTokenMix"]
# 份额与标准档联动防漂移：Anthropic 档 = 标准档的普通输入份额改按缓存写价
assert (ANTHROPIC_MIX["cache"], ANTHROPIC_MIX["cacheWrite"], ANTHROPIC_MIX["output"]) == (
    STANDARD_MIX["cache"], STANDARD_MIX["input"], STANDARD_MIX["output"])
# Anthropic 5 分钟缓存写入价（platform.claude.com pricing；Fable 5.1 见 claude-fable51-round1-2026-09-13.json）
ANTHROPIC_CACHE_WRITE_5M = {"claude-opus-5": 6.25, "claude-sonnet-5": 2.5, "claude-fable-5": 12.5,
                          "claude-fable-5.1": 12.5, "claude-opus-5.5": 5.0}


def blended_anthropic(cached: float, write: float, out: float) -> float:
    # Anthropic 档混合价：缓存读 + 缓存写(5m) + 输出（CONVENTIONS §2.4，2026-09-24 裁定）
    return ANTHROPIC_MIX["cache"] * cached + ANTHROPIC_MIX["cacheWrite"] * write + ANTHROPIC_MIX["output"] * out


def worth_usd(seg: dict, price: tuple) -> float:
    # 段 list-worth（USD）：(cached, input, output) 价目
    return (seg["cache_read"] * price[0] + seg["input"] * price[1] + seg["output"] * price[2]) / 1e6


# Grok 4.6 周池（折算口径）：(V2EX worth $71.909 + #56 worth $141.54) ÷293pp ×100 = 周 $72.85 ÷ $0.565
SUPERGROK_WEEKLY_TOKENS = round(
    (SUPERGROK_V2EX_WEEK_TOKENS * blended(*GROK_LIST) / 1e6
     + worth_usd(SUPERGROK46_ISSUE56_SEGMENT, GROK_LIST))
    / (100 + 193) * 100 / blended(*GROK_LIST) * 1e6)
# Grok 4.7 周池（折算口径）：「这次」窗 worth $36.78 ÷45.5475% = 周 $80.75 ÷ 标准档 $0.565
SUPERGROK47_WEEKLY_TOKENS = round(
    worth_usd(SUPERGROK47_ROUND2_SEGMENT, GROK_LIST) / SUPERGROK47_ROUND2_FRACTION
    / blended(*GROK_LIST) * 1e6)


def supergrok_monthly_yi(panel_usd: float, digits: int, weekly: float = SUPERGROK_WEEKLY_TOKENS) -> float:
    return round(weekly * MONTH_WEEKS / YI * panel_usd / SUPERGROK_PANEL_USD, digits)


def chatgpt_luna_monthly_yi(plan_multiplier: float = 1) -> float:
    # 段 worth $3.2185 ÷6% ×4周 = 月 $214.57 ÷ 标准档混合价 $0.0304/MTok（2026-09-30 统一折算）
    return round(
        worth_usd(CHATGPT_PLUS_LUNA_SEGMENT, GPT56_LUNA_LIST) / CHATGPT_PLUS_LUNA_USED_FRACTION
        * MONTH_WEEKS / blended(*GPT56_LUNA_LIST) * 1e6 * plan_multiplier / YI,
        2,
    )


def chatgpt_luna_raw_monthly_yi() -> float:
    # raw total 口径 75.11 亿，留作对照
    return round(
        CHATGPT_PLUS_LUNA_USED_TOKENS / CHATGPT_PLUS_LUNA_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def chatgpt_astra_monthly_yi() -> float:
    return round(
        CHATGPT_PLUS_ASTRA_USED_TOKENS / CHATGPT_PLUS_ASTRA_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def chatgpt_sol6_monthly_yi() -> float:
    # 段 worth $4.8502 ÷6% ×4周 = 月 $323.34 ÷ 标准档 $0.294/MTok（2026-09-30 统一折算）
    return round(
        worth_usd(CHATGPT_PLUS_SOL6_SEGMENT, GPT6_SOL_LIST) / CHATGPT_PLUS_SOL6_USED_FRACTION
        * MONTH_WEEKS / blended(*GPT6_SOL_LIST) * 1e6 / YI,
        2,
    )


def chatgpt_sol6_raw_monthly_yi() -> float:
    # raw total 口径 10.48 亿，留作对照
    return round(
        CHATGPT_PLUS_SOL6_USED_TOKENS / CHATGPT_PLUS_SOL6_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def chatgpt_luna6_monthly_yi() -> float:
    # 段 worth $2.0293 ÷6% ×4周 = 月 $135.28 ÷ 标准档 $0.0147/MTok（2026-09-30 统一折算）
    return round(
        worth_usd(CHATGPT_PLUS_LUNA6_SEGMENT, GPT6_LUNA_LIST) / CHATGPT_PLUS_LUNA6_USED_FRACTION
        * MONTH_WEEKS / blended(*GPT6_LUNA_LIST) * 1e6 / YI,
        2,
    )


def chatgpt_luna6_raw_monthly_yi() -> float:
    # raw total 口径 91.77 亿，留作对照
    return round(
        CHATGPT_PLUS_LUNA6_USED_TOKENS / CHATGPT_PLUS_LUNA6_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def chatgpt_sol61_monthly_yi() -> float:
    # 段 worth $13.2824 ÷31% ×4周 = 月 $171.39 ÷ 标准档 $0.197/MTok（GPT-6.1 Sol 官方价）
    # 若按 GPT-6 Sol 价 (0.2,2,10) 折算：worth $18.5360 → 8.14 亿，留作对照
    return round(
        worth_usd(CHATGPT_PLUS_SOL61_SEGMENT, GPT61_SOL_LIST) / CHATGPT_PLUS_SOL61_USED_FRACTION
        * MONTH_WEEKS / blended(*GPT61_SOL_LIST) * 1e6 / YI,
        2,
    )


def chatgpt_sol61_raw_monthly_yi() -> float:
    # raw total 口径 7.17 亿（整段 55,532,850÷31%×4周），留作对照
    return round(
        CHATGPT_PLUS_SOL61_USED_TOKENS / CHATGPT_PLUS_SOL61_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def devin_max_astra_raw_monthly_yi() -> float:
    # 原始 total 口径（raw token ÷ 段占比 ×4周），入库后留作对照
    return round(
        DEVIN_MAX_ASTRA_USED_TOKENS / DEVIN_MAX_ASTRA_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def devin_max_astra_segment_worth_usd() -> float:
    # 段 list-worth：OpenAI 无缓存写费，cache_create 按普通输入 $10 计
    s = DEVIN_MAX_ASTRA_SEGMENT
    return (s["cache_read"] * 1.0 + (s["cache_create"] + s["input"]) * 10.0 + s["output"] * 50.0) / 1e6


def devin_max_astra_monthly_yi() -> float:
    # 段 worth ÷87% ×4周 ÷ 标准负载混合价 $1.47/MTok（2026-09-24 裁定）
    return round(
        devin_max_astra_segment_worth_usd() / DEVIN_MAX_ASTRA_USED_FRACTION
        * MONTH_WEEKS / blended(*GPT6_ASTRA_LIST) / 100,
        2,
    )


def devin_max_opus55_raw_monthly_yi() -> float:
    return round(
        DEVIN_MAX_OPUS55_USED_TOKENS / DEVIN_MAX_OPUS55_USED_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def devin_max_opus55_segment_worth_usd() -> float:
    # 段 list-worth：cache_create 按 Opus 5.5 的 5 分钟缓存写价 $5/MTok
    s = DEVIN_MAX_OPUS55_SEGMENT
    return (s["cache_read"] * OPUS55_LIST[0] + s["cache_create"] * ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"]
            + s["input"] * OPUS55_LIST[1] + s["output"] * OPUS55_LIST[2]) / 1e6


def devin_max_opus55_monthly_yi() -> float:
    # 段 worth ÷48% ×4周 ÷ Anthropic 档混合价 $0.419/MTok（2026-09-24 裁定）
    return round(
        devin_max_opus55_segment_worth_usd() / DEVIN_MAX_OPUS55_USED_FRACTION
        * MONTH_WEEKS / blended_anthropic(OPUS55_LIST[0], ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"], OPUS55_LIST[2]) / 100,
        2,
    )


def droid_max_opus55_raw_monthly_yi() -> float:
    return round(
        DROID_MAX_OPUS55_USED_TOKENS / DROID_MAX_OPUS55_USED_FRACTION
        * DROID_MONTH_WEEKS / YI,
        2,
    )


def droid_max_opus55_segment_worth_usd() -> float:
    # 段 list-worth：cache_create 按 Opus 5.5 的 5 分钟缓存写价 $5/MTok，thinking 不计
    s = DROID_MAX_OPUS55_SEGMENT
    return (s["cache_read"] * OPUS55_LIST[0] + s["cache_create"] * ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"]
            + s["input"] * OPUS55_LIST[1] + s["output"] * OPUS55_LIST[2]) / 1e6


def droid_max_opus55_monthly_yi() -> float:
    # 段 worth ÷8% ×2（月＝2×周）÷ Anthropic 档混合价 $0.419/MTok
    return round(
        droid_max_opus55_segment_worth_usd() / DROID_MAX_OPUS55_USED_FRACTION
        * DROID_MONTH_WEEKS / blended_anthropic(OPUS55_LIST[0], ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"], OPUS55_LIST[2]) / 100,
        2,
    )


def droid_pro_opus55_monthly_yi() -> float:
    # 帖主周 list-worth $45 ×2（月＝2×周）÷ Anthropic 档混合价 $0.419/MTok
    return round(
        DROID_PRO_OPUS55_COMMUNITY_WORTH_USD["week"] * DROID_MONTH_WEEKS
        / blended_anthropic(OPUS55_LIST[0], ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"], OPUS55_LIST[2]) / 100,
        2,
    )


def google_ai_pro_monthly_yi() -> float:
    # 两样本 worth 按百分点合并（B $11.8626 + #54 $204.915）÷175.65pp → 周 worth ×4周
    #   ÷ 低缓存档混合价 $0.19125/MTok（2026-09-30 裁定带分项实测统一折算）
    weekly_worth = (worth_usd(GOOGLE_PRO_B_SEGMENT, GEMINI_FLASH_LIST)
                    + worth_usd(GOOGLE_PRO_ISSUE54_SEGMENT, GEMINI_FLASH_LIST)) / (
                        GOOGLE_PRO_B_WEEKLY_FRACTION * 100 + GOOGLE_PRO_ISSUE54_WEEKLY_PP) * 100
    return round(
        weekly_worth * MONTH_WEEKS / blended_low(*GEMINI_FLASH_LIST) * 1e6 / YI,
        2,
    )


def google_ai_pro_raw_monthly_yi() -> float:
    # raw 合计口径 20.70 亿，留作对照
    return round(
        (GOOGLE_PRO_B_TOTAL_TOKENS + GOOGLE_PRO_ISSUE54_TOKENS)
        / (GOOGLE_PRO_B_WEEKLY_FRACTION * 100 + GOOGLE_PRO_ISSUE54_WEEKLY_PP)
        * 100 * MONTH_WEEKS / YI,
        2,
    )


def google_ai_pro_36_monthly_yi() -> float:
    # issue #55 段 worth $25.824 ÷21.70pp → 周 worth ×4周 ÷ 低缓存档 $0.19125/MTok
    return round(
        worth_usd(GOOGLE_PRO_ISSUE55_SEGMENT, GEMINI_FLASH_LIST) / GOOGLE_PRO_ISSUE55_WEEKLY_PP
        * 100 * MONTH_WEEKS / blended_low(*GEMINI_FLASH_LIST) * 1e6 / YI,
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


def claude_pro_opus5_panel_monthly_yi() -> float:
    # 旧 @shownotover 面板口径（18.78），仅作对照
    return round(
        CLAUDE_PRO_SESSION_TOKENS / CLAUDE_PRO_WEEKLY_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def claude_pro_opus5_monthly_yi() -> float:
    # 段 worth $733.93 ÷148pp = 每 1% $4.96 → 周 worth ×4周 ÷ Anthropic 档混合价 $0.76625/MTok
    #   （2026-09-30 裁定带分项实测统一折算，替换 raw total 口径 27.62）
    return round(
        CLAUDE_PRO_OPUS5_ISSUE53_WORTH_USD / CLAUDE_PRO_OPUS5_ISSUE53_WEEKLY_PP * 100
        * MONTH_WEEKS
        / blended_anthropic(0.5, ANTHROPIC_CACHE_WRITE_5M["claude-opus-5"], 25.0) / 100,
        2,
    )


def claude_pro_opus5_raw_monthly_yi() -> float:
    # issue #53 raw total 口径 27.62 亿（1,022.02M÷148pp×100×4周），留作对照
    return round(
        CLAUDE_PRO_OPUS5_ISSUE53_TOKENS / CLAUDE_PRO_OPUS5_ISSUE53_WEEKLY_PP * 100
        * MONTH_WEEKS / YI,
        2,
    )


# Opus 5.5 × Pro —— round10 Reddit 满窗样本（2026-09-25 裁定按标价折 worth 再按 Anthropic 档负载换算）：
#   r/ClaudeCode 帖 Pro $20 打满 5h 窗 = 151,193,723 raw（读149.82M/写1.13M/入458/出242k）＝周额度 13.333%（周池=7.5窗）
CLAUDE_PRO_OPUS55_SEGMENT = {"cache_read": 149_816_660, "cache_write": 1_134_356, "input": 458, "output": 242_249}
CLAUDE_PRO_OPUS55_5H_TOKENS = 151_193_723
CLAUDE_PRO_OPUS55_5H_WEEKLY_FRACTION = 0.13333
assert sum(CLAUDE_PRO_OPUS55_SEGMENT.values()) == CLAUDE_PRO_OPUS55_5H_TOKENS
# issue #52（NTRYourWaifu，2026-09-29 裁定并入）：两个 Pro 账号每 5 分钟轮询 /api/oauth/usage
#   seven_day %、按 message.id 去重、只计 Opus 5.5 ≥95% 区段 —— 1,396.81M raw = 周 +183 个百分点，
#   标价 worth $587.52（读 $0.2 / 1h 写 $8 / 5m 写 $5 / 入 $4 / 出 $20）
CLAUDE_PRO_OPUS55_ISSUE52_WORTH_USD = 587.52
CLAUDE_PRO_OPUS55_ISSUE52_WEEKLY_PP = 183.0


def claude_pro_opus55_raw_monthly_yi() -> float:
    # 原始 total 口径（raw token ÷ 周占比 ×4周），入库后留作对照
    return round(
        CLAUDE_PRO_OPUS55_5H_TOKENS / CLAUDE_PRO_OPUS55_5H_WEEKLY_FRACTION
        * MONTH_WEEKS / YI,
        2,
    )


def claude_pro_opus55_segment_worth_usd() -> float:
    # 段 list-worth：cache_write 按 Opus 5.5 的 5 分钟缓存写价 $5/MTok
    s = CLAUDE_PRO_OPUS55_SEGMENT
    return (s["cache_read"] * OPUS55_LIST[0] + s["cache_write"] * ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"]
            + s["input"] * OPUS55_LIST[1] + s["output"] * OPUS55_LIST[2]) / 1e6


def claude_pro_opus55_monthly_yi() -> float:
    # （Reddit 段 worth + #52 worth）÷（13.333 + 183 个百分点）→ 每 pp worth ×100 ×4周 ÷ Anthropic 档混合价 $0.419/MTok
    #   （2026-09-29 裁定按百分点合并，替换 2026-09-25 单段口径）
    worth_per_pp = (claude_pro_opus55_segment_worth_usd() + CLAUDE_PRO_OPUS55_ISSUE52_WORTH_USD) / (
        CLAUDE_PRO_OPUS55_5H_WEEKLY_FRACTION * 100 + CLAUDE_PRO_OPUS55_ISSUE52_WEEKLY_PP)
    return round(
        worth_per_pp * 100 * MONTH_WEEKS
        / blended_anthropic(OPUS55_LIST[0], ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"], OPUS55_LIST[2]) / 100,
        2,
    )


def claude_opus55_max20x_session_worth_usd() -> float:
    # MiaAI 样本 list-worth（写按 5m $5，与推文 $482.63 闭合）
    s = CLAUDE_OPUS55_SESSION
    return (s["cache_read"] * OPUS55_LIST[0] + s["cache_write"] * ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"]
            + s["input"] * OPUS55_LIST[1] + s["output"] * OPUS55_LIST[2]) / 1e6


def claude_max20x_opus55_sources() -> dict:
    # 两路各自折成「Max 20x 周额度百分点」：MiaAI 75% 窗 ÷ 5.5 窗/周；Pro 196.333pp ÷ 10
    mia_pp = CLAUDE_OPUS55_5H_FRACTION * 100 / CLAUDE_MAX20X_WINDOWS_PER_WEEK
    pro_pp = (CLAUDE_PRO_OPUS55_5H_WEEKLY_FRACTION * 100 + CLAUDE_PRO_OPUS55_ISSUE52_WEEKLY_PP) / CLAUDE_MAX20X_TO_PRO_WEEKLY
    pro_worth = claude_pro_opus55_segment_worth_usd() + CLAUDE_PRO_OPUS55_ISSUE52_WORTH_USD
    return {"mia": (claude_opus55_max20x_session_worth_usd(), mia_pp), "pro10": (pro_worth, pro_pp)}


def claude_max20x_opus55_yi(worth: float, pp: float) -> float:
    return round(worth / pp * 100 * MONTH_WEEKS
                 / blended_anthropic(OPUS55_LIST[0], ANTHROPIC_CACHE_WRITE_5M["claude-opus-5.5"], OPUS55_LIST[2]) / 100, 2)


# 2026-09-30 裁定：MiaAI 窗 ×5.5 窗/周 与 Pro ×10 按 Max 20x 周百分点加权合并（Anthropic 档）
CLAUDE_OPUS55_MAX20X_MONTHLY_YI = claude_max20x_opus55_yi(
    sum(w for w, _ in claude_max20x_opus55_sources().values()),
    sum(p for _, p in claude_max20x_opus55_sources().values()),
)  # ≈315.38


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
# 2026-09-30 full re-verification: goat-opencode-catalogs-round3-2026-09-30.json —
#   V4 Flash / Vision Exp back in the official catalog, re-adopted; gpt-6-luna added;
#   glm-5.3-flash and deepseek-v4.1-flash Usage raised to $60; omen-alpha, glm-5.1,
#   minimax-m2.5, qwen3.7-max, qwen3.6-plus delisted (absent from official tables); now 28 models.
OPENCODE_GO_MODELS = (
    ("grok-4.6", 15, 0.5, 2.0, 6.0, "≤200K 标价；>200K 价翻倍，保留在 research variants"),
    ("grok-4.7", 15, 0.5, 2.0, 6.0, "≤200K 标价；>200K 价翻倍，保留在 research variants；mimo-v26-grok47-catalogs-round1-2026-09-22.json"),
    ("gpt-5.6-luna", 15, 0.02, 0.2, 1.2, "≤272K 标价；>272K 档保留在 research variants"),
    ("gpt-6-luna", 15, 0.01, 0.1, 0.5, "new official row; <=272K list price; >272K band kept in research variants; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("glm-5.3-flash", 60, 0.03, 0.15, 0.5, "official Usage $15->$60 (reverified 2026-09-30); goat-opencode-catalogs-round3-2026-09-30.json"),
    ("glm-5.3", 15, 0.26, 1.4, 4.4, "官网单档"),
    ("glm-5.2", 60, 0.26, 1.4, 4.4, "官网单档"),
    ("kimi-k3", 15, 0.3, 3.0, 15.0, "官网单档"),
    ("kimi-k2.7-code", 60, 0.19, 0.95, 4.0, "官网单档"),
    ("kimi-k2.6", 60, 0.16, 0.95, 4.0, "官网单档"),
    ("longcat-2.0", 60, 0.006, 0.3, 1.2, "官网单档"),
    ("mimo-v2.5", 60, 0.0028, 0.14, 0.28, "官网单档"),
    ("mimo-v2.5-pro", 15, 0.003625, 0.435, 0.87, "官网单档"),
    ("mimo-v2.6-flash", 60, 0.0028, 0.14, 0.28, "官网单档；Usage $60"),
    ("mimo-v2.6-pro", 15, 0.003625, 0.435, 0.87, "官网单档；Usage $15；与 v2.5-pro 同 Usage 档"),
    ("minimax-m3", 60, 0.06, 0.3, 1.2, "官网单档"),
    ("minimax-m2.7", 60, 0.06, 0.3, 1.2, "官网单档"),
    ("muse-spark-1.3-contributor", 60, 0.002, 0.1, 0.2, "官网单档"),
    ("muse-spark-1.2-contributor", 60, 0.002, 0.1, 0.2, "官网单档"),
    ("qwen3.8-max", 15, 0.25, 2.0, 6.0, "官网单档"),
    ("qwen3.8-flash", 30, 0.016, 0.15, 0.47, "官网单档"),
    ("qwen3.7-plus", 60, 0.04, 0.4, 1.6, "≤256K 标价；>256K 档保留在 research variants"),
    ("deepseek-v4.1-flash", 60, 0.003, 0.15, 0.60, "官网 Monthly limit 永久 $60；Off-Peak；Peak=2×保留在 research variants"),
    ("deepseek-v4-pro", 15, 0.022, 0.66, 1.98, "Off-Peak；Peak 额度为其一半，保留在 research variants；OpenCode 价表未改"),
    ("deepseek-v4-flash", 30, 0.003, 0.15, 0.60, "back in official catalog, Usage $30 (restored after the 9/10 removal); Off-Peak; Peak=2x kept in research variants; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("deepseek-v4-flash-vision-exp", 15, 0.003, 0.15, 0.60, "back in official catalog, Usage $15 (restored after the 9/10 removal); Off-Peak; Peak=2x kept in research variants; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("hy4-preview", 30, 0.042, 0.834, 2.501, "官网单档"),
    ("hy3", 60, 0.035, 0.14, 0.58, "官网单档"),
)

OPENCODE_GO_OLD_YI = {
    "grok-4.6": 0.279, "gpt-5.6-luna": 5.25, "glm-5.3-flash": 4.44, "glm-5.3": 0.571,
    "kimi-k3": 0.381, "kimi-k2.7-code": 3.785, "minimax-m3": 9.072, "qwen3.7-plus": 12.461,
    "deepseek-v4-pro": 4.318, "hy4-preview": 4.917, "mimo-v2.5-pro": 14.196,
}


OPENCODE_GO_DEFAULT_SOURCE = (
    "https://opencode.ai/docs/go/ official per-model Usage and three-part pricing; opencode-go-round5-2026-09-06.json; "
    "goat-opencode-catalogs-round3-2026-09-30.json"
)
OPENCODE_GO_DEEPSEEK_SOURCE = (
    "https://opencode.ai/docs/go/ 官方每模型 Usage 与三段价格；"
    "opencode-go-deepseek-round7-2026-09-30.json"
)
OPENCODE_GO_NOTES = {
    "deepseek-v4.1-flash": (
        "15.528→62.112亿：min(共享月池$60, 模型Usage $60) ÷ 统一标准负载加权价；"
        "官网闲时 cached/input/output=$0.003/$0.15/$0.60，高峰2×。"
        "模型月Usage由$15升为永久$60（官网曾标4x限时至9/27，9/30页面撤标按$60常态列示，确认永久；"
        "估算请求130,000/月为旧$15档32,500的4倍，交叉一致）。官网 Model ID 现为 deepseek-v4.1-flash。"
        "官方请求数仅作交叉检查，不再作为额度主值；同套餐各模型额度不可相加"
    ),
    "deepseek-v4-flash": (
        "restored: official Usage $30 (reverified 2026-09-30; removed 09-10 as confirmed offline); "
        "min(shared monthly pool $60, model Usage $30) / standard-workload blended price; "
        "off-peak cached/input/output=$0.003/$0.15/$0.60, peak 2x; official estimate 65,000 requests/mo. "
        "Per-model allowances within the plan do not add"
    ),
    "deepseek-v4-flash-vision-exp": (
        "restored: official Usage $15 (reverified 2026-09-30; removed 09-10 as confirmed offline); "
        "min(shared monthly pool $60, model Usage $15) / standard-workload blended price; "
        "off-peak cached/input/output=$0.003/$0.15/$0.60, peak 2x; official estimate 32,500 requests/mo. "
        "Per-model allowances within the plan do not add"
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
    ("deepseek-v4.1-flash", 60, 0.003, 0.15, 0.60, "官网 allowance 永久 $60；Off-Peak；Peak=2×保留在 research variants"),
    ("kimi-k2.7-code", 60, 0.19, 0.95, 4.0, "官网三段价"),
    ("deepseek-v4-flash", 60, 0.003, 0.15, 0.60, "back in official catalog as 'V4 Flash (latest)' at $60 (restored after the 9/10 removal); Off-Peak; Peak=2x kept in research variants; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("deepseek-v4.1-flash-fast", 60, 0.016, 0.16, 0.58, "new official row 'V4.1 Flash Fast' at $60 (off-peak $0.016/$0.16/$0.58, 57,500 requests/mo); goat-opencode-catalogs-round3-2026-09-30.json"),
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
    ("grok-4.7", 20, 0.5, 2.0, 6.0, "official three-part price; $20 (moved to the New models table on 2026-09-30)"),
    # —— New models 表（新模型默认 2× credits，Gemini 3.7 Flash 例外 $40）——
    ("gpt-6-luna", 20, 0.01, 0.1, 0.5, "official three-part price; New models table $20 (cache write $0.125); goat-opencode-catalogs-round3-2026-09-30.json"),
    ("qwen3.8-omni-flash", 20, 0.016, 0.15, 0.47, "official three-part price; New models table $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("qwen3.8-max-0902", 20, 0.25, 2.0, 6.0, "官网三段价；New models 默认$20"),
    ("hy4-preview", 20, 0.042, 0.834, 2.501, "官网三段价；New models 默认$20"),
    ("qwen3.8-flash", 20, 0.016, 0.16, 0.47, "官网三段价（本渠道 input=$0.16）；New models 默认$20"),
    ("glm-5.3-flashx", 20, 0.075, 0.37, 1.25, "official three-part price; New models table $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("deepseek-v4-flash-vision-exp", 20, 0.003, 0.15, 0.60, "back in official catalog as 'V4 Flash Vision (exp)' at $20 (restored after the 9/10 removal); Off-Peak; Peak=2x kept in research variants; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("deepseek-v4-flash-fast", 20, 0.07, 0.28, 0.56, "官网三段价；New models 默认$20；与Flash额度分开"),
    ("glm-5.3", 20, 0.26, 1.4, 4.4, "官网三段价；New models 默认$20"),
    ("muse-spark-1.3", 20, 0.15, 1.25, 4.25, "官网标准档三段价；New models 默认$20"),
    ("muse-spark-1.3-contributor", 20, 0.002, 0.1, 0.2, "官网 contributor 三段价；New models 默认$20"),
    ("muse-spark-1.2", 20, 0.15, 1.25, 4.25, "官网标准档三段价；New models 默认$20"),
    ("muse-spark-1.2-contributor", 20, 0.002, 0.1, 0.2, "官网 contributor 三段价；New models 默认$20"),
    ("kimi-k3", 20, 0.3, 3.0, 15.0, "official three-part price; New models table $20 (temporary $60 promo through 10/7, not adopted per temp-promo policy)"),
    ("kimi-k2.7-code-highspeed", 20, 0.38, 1.9, 8.0, "官网三段价；速度变体独立$20，不继承K2.7 Code的$60"),
    ("grok-4.5", 20, 0.5, 2.0, 6.0, "官网三段价；New models 默认$20"),
    ("grok-4.6", 20, 0.5, 2.0, 6.0, "官网三段价；New models 默认$20"),
    ("mimo-v2.6-pro", 20, 0.0036, 0.435, 0.87, "官网三段价；New models 默认$20"),
    ("mimo-v2.6-flash", 20, 0.0028, 0.14, 0.28, "official three-part price; moved to New models table at $20 (no longer in the Every model $30 table); goat-opencode-catalogs-round3-2026-09-30.json"),
    ("mimo-v2.6-pro-ultraspeed", 10, 0.036, 4.35, 8.70, "官网三段价；官方明示按Pro价10×故仅配$10 credits"),
    ("gemini-3.7-flash", 40, 0.15, 1.5, 7.5, "官网三段价；New models 表写$40"),
    ("glm-5.2-fast", 20, 0.5, 3.0, 10.25, "官网三段价；速度变体独立$20，不继承GLM-5.2的$70"),
    ("inkling", 20, 0.17, 1.0, 4.05, "官网三段价；New models 默认$20"),
    ("inkling-small", 20, 0.1, 0.5, 1.2, "官网三段价；New models 默认$20"),
    ("step-5-preview", 20, 0.05, 1.0, 2.7, "official three-part price; New models table $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("step-3.7-flash", 20, 0.04, 0.2, 1.15, "官网三段价；New models 默认$20"),
    ("step-3.5-flash", 20, 0.02, 0.09, 0.3, "official three-part price, input $0.10->$0.09 (reverified 2026-09-30); New models default $20"),
    ("nemotron-3-ultra", 20, 0.12, 0.6, 2.4, "官网三段价；New models 默认$20"),
    ("jev", 20, 0.0, 0.042, 0.0, "new official row; New models table $20; input $0.042, cache read/output free; Decision model (typesafe/jev); goat-opencode-catalogs-round3-2026-09-30.json"),
    ("longcat-2.0", 50, 0.006, 0.3, 1.2, "official three-part price; Every model table $50; goat-opencode-catalogs-round3-2026-09-30.json"),
    # -- standalone tier --
    ("claude-sonnet-5.5", 10, 0.2, 2.0, 10.0, "official three-part price; standalone table $10 (launched 2026-09-28); cache write $2.50 excluded from standard workload; goat-opencode-catalogs-round3-2026-09-30.json"),
    # -- Older models table (all $20) --
    ("kimi-k2.6", 20, 0.16, 0.95, 4.0, "official three-part price; Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("kimi-k2.5", 20, 0.1, 0.6, 3.0, "official three-part price; Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("glm-5.1", 20, 0.26, 1.4, 4.4, "official three-part price; Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("glm-5", 20, 0.2, 1.0, 3.2, "official three-part price; Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("qwen3.7-flash", 20, 0.006, 0.03, 0.13, "official three-part price (<=32K band; <=256K/>256K bands kept in research); Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("qwen3.6-max-preview", 20, 0.26, 1.3, 7.8, "official three-part price; Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("minimax-m2.7", 20, 0.06, 0.3, 1.2, "official three-part price; Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
    ("minimax-m2.5", 20, 0.03, 0.3, 1.2, "official three-part price; Older models all $20; goat-opencode-catalogs-round3-2026-09-30.json"),
)


COMMAND_CODE_GOAT_DEFAULT_SOURCE = (
    "https://commandcode.ai/docs/plans/goat official per-model allowance and three-part pricing; "
    "https://commandcode.ai/pricing; $10->$70 credits; code-subscriptions-round1-2026-09-06.json; "
    "goat-opencode-catalogs-round3-2026-09-30.json"
)
COMMAND_CODE_GOAT_DEEPSEEK_SOURCE = (
    "https://commandcode.ai/docs/plans/goat 官方每模型 allowance 与三段价；"
    "https://commandcode.ai/pricing；$10→$70 credits；command-code-goat-deepseek-round2-2026-09-30.json"
)
COMMAND_CODE_GOAT_NOTES = {
    "deepseek-v4.1-flash": (
        "41.408→62.112亿：min(共享月池$70, 模型allowance $60) ÷ 统一标准负载加权价；"
        "官网闲时 cached/input/output=$0.003/$0.15/$0.60，高峰2×。"
        "模型月allowance由$40升为永久$60（官网估算请求154,000/月与$60档 V4 Flash latest 完全同档，确认永久）。"
        "官方请求数仅作交叉检查，不再作为额度主值；忽略 processing fee；同套餐各模型额度不可相加"
    ),
    "deepseek-v4-flash": (
        "restored: official 'V4 Flash (latest)' allowance $60 (reverified 2026-09-30; removed 09-10 as confirmed offline); "
        "min(shared monthly pool $70, model allowance $60) / standard-workload blended price; "
        "off-peak cached/input/output=$0.003/$0.15/$0.60, peak 2x; official estimate 154,000 requests/mo. "
        "Processing fee ignored; per-model allowances within the plan do not add"
    ),
    "deepseek-v4-flash-vision-exp": (
        "restored: official 'V4 Flash Vision (exp)' allowance $20 (reverified 2026-09-30; removed 09-10 as confirmed offline); "
        "min(shared monthly pool $70, model allowance $20) / standard-workload blended price; "
        "off-peak cached/input/output=$0.003/$0.15/$0.60, peak 2x. "
        "Processing fee ignored; per-model allowances within the plan do not add"
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
# step-5-preview（round5）：维护者 Plus 面板 + 本机 210M token 实测互验成立；实测负载 cache 79.0%
# 打不到标准口径 97%。2026-09-22 裁定：Step 全系统一套 conventions.lowCacheTokenMix
# 「低缓存负载」85%/14.5%/0.5%（step5 实测 79% 留作 decision_note 对照），Gemini raw 实测属同族。
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
                    f"（conventions.lowCacheTokenMix {LOW_CACHE_MIX['cache']:.0%}/{LOW_CACHE_MIX['input']:.1%}/{LOW_CACHE_MIX['output']:.1%}，2026-09-22裁定Step全系统一口径）。"
                    f"对照：本机实测79.0% mix混合价¥{STEPFUN_STEP5_MEASURED_CNY:.3f}/M，对应{credit_m / STEPFUN_STEP5_MEASURED_CNY / 100:.3f}亿"
                    "（210.17M tokens大样本，OpenCode+DSH同窗）。"
                    + ("Plus面板双向验证：控制台Credit消耗378.15M 与本机token×官方三段价期望376.41M 差+0.46%；"
                       "378.15÷1600=23.63%≈面板剩余77%，官方1600M月池与1M Credit=¥1计费均成立。"
                       if pid == "stepfun_plus_cn" else
                       "借用Plus验证过的Credit计费口径，池额为官方表值、本档未面板验证。")
                    + "分数：AA index 44（维护者截图整数读数，疑为 v4.3 后新版 index）；TB4 33.3% 为 AA 独立实测（非自报）。"
                )
            else:
                blended_cny = blended_low(cached, inp, out)
                yi = round(credit_m / blended_cny / 100, 3)
                conf = "medium"
                note = (
                    f"{round(credit_m / blended(cached, inp, out) / 100, 3):g}→{yi:g}亿："
                    "Step实测负载打不到标准97% cache（2026-09-22裁定），改套低缓存统一负载"
                    f"（conventions.lowCacheTokenMix {LOW_CACHE_MIX['cache']:.0%}/{LOW_CACHE_MIX['input']:.1%}/{LOW_CACHE_MIX['output']:.1%}）混合价¥{blended_cny:.3f}/M；"
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


# 小米 MiMo Token Plan：官方月度 Credits 池 ÷ 分模型分类型 burn 率折 token（mimo.mi.com 订阅文档）。
# Credits 为虚拟计量单位（cached/input/output 每 token 所扣 credits 各不相同），非固定美元面值。
# 套餐覆盖 8 款：v2.6-pro / v2.6-flash / v2.5-pro / v2.5 / v2.5-asr / tts×3（ASR 按时长、TTS 免费不入图）；
# V2.6 于 2026-09-22 列入官方支持清单（发布次日文档更新，维护者面板截图互证），burn 率与 v2.5 对应档一致。
# 夜间 00:00-08:00（北京）consumption 0.8× → 同 credits 多换 25% token，与 GLM/DeepSeek 闲时同型，
# 按惯例拆独立情景点（日间基准 / 夜间0.8×）。首购88折、年付88折不采（一次性/换约折扣）。
# ¥价与$价同档同池：国内外并点、月费按国际版美元标价（Kimi 并点口径），¥价记入决策注。
# 证据：data/research/mimo-token-plan-round1-2026-09-22.json
MIMO_TOKEN_TIERS = (
    # (tier_slug, name, price_cny, price_usd, monthly_credits)
    ("lite", "Lite", 39, 6, 4_100_000_000),
    ("standard", "Standard", 99, 16, 11_000_000_000),
    ("pro", "Pro", 329, 50, 38_000_000_000),
    ("max", "Max", 659, 100, 82_000_000_000),
)
MIMO_CREDIT_RATES = {  # model -> (cached_input, input, output) credits/token
    "mimo-v2.6-pro": (2.5, 300, 600),
    "mimo-v2.6-flash": (2, 100, 200),
    "mimo-v2.5-pro": (2.5, 300, 600),
    "mimo-v2.5": (2, 100, 200),
}
MIMO_SOURCE = (
    "https://mimo.mi.com/docs Token Plan 官方档位/Credits池/burn率/夜间0.8×/首购88折；"
    "mimo-token-plan-round1-2026-09-22.json"
)
MIMO_OPENCODE_TOKENS = (67_848_448, 4_479_135, 1_388_760)  # OpenCode harness 单日 cache读/缓外输入/输出，对照保留
MIMO_OPENCODE_MIX = tuple(t / sum(MIMO_OPENCODE_TOKENS) for t in MIMO_OPENCODE_TOKENS)


def mimo_rows() -> list[tuple]:
    rows = []
    for slug, name, price_cny, price_usd, credits in MIMO_TOKEN_TIERS:
        for model, rates in MIMO_CREDIT_RATES.items():
            burn = blended(*rates)
            oc_burn = sum(m * r for m, r in zip(MIMO_OPENCODE_MIX, rates))
            base_yi = credits / burn / YI
            for band, band_label, factor in (("day", "日间", 1.0), ("night", "夜间0.8×", 1 / 0.8)):
                monthly_yi = round(base_yi * factor, 2)
                oc_yi = round(credits / oc_burn / YI * factor, 2)
                rows.append((
                    f"mimo_token_{slug}_{band}", f"MiMo Token Plan {name} {band_label}",
                    price_cny, "CNY", model, monthly_yi, "medium", MIMO_SOURCE,
                    f"新增{monthly_yi:g}亿：月池{credits / 1e9:g}B Credits÷统一标准负载混合burn {burn:g} credits/token"
                    f"（该模型 cached/input/output={rates[0]:g}/{rates[1]:g}/{rates[2]:g} credits/token）"
                    + ("；夜间00:00-08:00（北京）consumption×0.8，同credits多换25% token" if band == "night" else "；日间基准消耗档")
                    + "；套餐覆盖 v2.6-pro/v2.6-flash/v2.5-pro/v2.5 共4款文本模型（2026-09-22文档更新+维护者面板互证）；"
                    "耗尽即停不透支；同套餐各模型额度不可相加（共享 Credits 池按单模型打满）；"
                    "面板互证：2026-09-22 单日按官方 burn 率应扣 23.47 亿 vs 面板实扣 21.91 亿"
                    "（−6.6%，夜间0.8×与时区归属解释），burn 率获面板级互证；"
                    f"对照：OpenCode harness 单日实测 mix（cache读{MIMO_OPENCODE_MIX[0]:.2%}/输入{MIMO_OPENCODE_MIX[1]:.2%}/输出{MIMO_OPENCODE_MIX[2]:.2%}）"
                    f"下为 {oc_yi:g}亿，不采用——2026-09-23 裁定低缓存系 OpenCode harness 所致，"
                    "另一客户端两题 35.72M tok 实测 cache 95.0%，按标准负载；"
                    "证据 mimo-token-plan-panel-round2-2026-09-23.json、mimo-client-sample-round3-2026-09-23.json",
                ))
    return rows


# ---- 订阅：(plan_id, plan_name, price, currency, served_model, monthly_yi, confidence, source, decision_note)
SUBS = [
    # OpenAI —— Sol 为 Terra/5.5 基准；Luna 改用 Plus 维护者面板实测，Pro 档按官方 5x/20x 推算
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-5.6-sol", 6.16, "medium", "awesome-coding-plan 2026-07-30 实测", "未折算：样本无 token 分项（2026-07-30 实测只给 total），保留 raw"),
    ("chatgpt_pro_5x", "ChatGPT Pro 5x", 100, "USD", "gpt-5.6-sol", 30.8, "medium", "Plus × 官方 5x", "flat.json 写 38.9 与官方 5x 不符，改 30.8"),
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-5.6-sol", CHATGPT_PRO20X_SOL_MONTHLY_YI, "high", "五源实测加权：Observatory 143.6×3 + 《财经》109×3 + 网关 139.5×2 + 健康周 131.2×2 + imon139 120×1；chatgpt-quotas-round5 / caijing-2026-08 / chatgpt-pro20x-gateway-measurement-2026-09-06", f"裁定 123.2（Plus×20 派生）→{CHATGPT_PRO20X_SOL_MONTHLY_YI:g} 亿加权值：权重沿用 Astra round14 惯例，派生值不入权仅对照；网关段间 108~154 亿、含两段 Astra 降权不剔除；健康周 7.87 亿=24%→131 亿；《财经》受控打满 109 亿为最低端；imon139 同帖口述「~30 亿/周」；文章 200 亿作废；未折算：五源加权、多数来源无 token 分项，保留 raw"),
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-5.6-luna", chatgpt_luna_monthly_yi(), "high", "维护者Plus面板：112,666,769 total tokens = 周额度约6%；chatgpt-luna-adoption-round6-2026-09-08.json；workload-conversion-round1-2026-09-30.json", f"75.11→{chatgpt_luna_monthly_yi():g}亿（2026-09-30 裁定带分项实测统一折算）：段 worth ${worth_usd(CHATGPT_PLUS_LUNA_SEGMENT, GPT56_LUNA_LIST):.4f}（cache 109.36M×$0.02＋入2.94M×$0.2＋出0.37M×$1.2）÷6%×4周＝${worth_usd(CHATGPT_PLUS_LUNA_SEGMENT, GPT56_LUNA_LIST)/0.06*4:.2f} ÷标准档混合价${blended(*GPT56_LUNA_LIST):.4f}/MTok；raw 口径 {chatgpt_luna_raw_monthly_yi():g} 留作对照。以下为原采用决策——旧120.12亿（Sol基准×统一credits价比19.5）→75.11亿：112,666,769÷6%×4周（原 raw 口径）；6%若为整数四舍五入，折算口径范围约65.2~77.0亿/月（raw 口径 69.33~81.94）；实测token构成为cache read 97.06%、普通输入2.61%、输出0.33%"),
    ("chatgpt_pro_5x", "ChatGPT Pro 5x", 100, "USD", "gpt-5.6-luna", chatgpt_luna_monthly_yi(5), "medium", "Plus Luna实测×官方5x；chatgpt-luna-adoption-round6-2026-09-08.json", "旧600.6亿→375.56亿→352.91亿：Plus Luna实测×官方5x（2026-09-30 折算口径 75.11→70.58 随动）；非Pro 5x账号独立实测"),
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-5.6-luna", chatgpt_luna_monthly_yi(20), "medium", "Plus Luna实测×官方20x；GitHub #8社区美元等效旁证；chatgpt-luna-adoption-round6-2026-09-08.json", "旧2402.4亿→1502.22亿→1411.63亿：Plus Luna实测×官方20x（2026-09-30 折算口径 75.11→70.58 随动）；按截图实际token组成折公开API价，约$1073/周，与社区‘Luna x20不到$1200、Sol x20约$2000’同量级。美元等效仅作池比旁证，不直接换token"),
    # Astra —— 维护者Plus账号2026-09-11晚周窗26pt打满直测；Pro20x按round13同框簇挂点（8亿簇5条独立来源），5x按Sol档间4×派生
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-6-astra", chatgpt_astra_monthly_yi(), "high", "维护者Plus面板：10,336,745 tokens(input+cache_read) = 周窗剩余26pt；chatgpt-astra-adoption-round7-2026-09-11.json", "新增1.59亿：10,336,745÷26%×4周；本次抽取未含output（Luna同法占0.33%，影响<1%）；26pt为取整读数差，范围约1.53~1.65亿；Plus定价页写明Astra为limited档（可加credits），直测的是实际消耗速率不受影响；round8发现Observatory现测Astra≈4.1×Sol，round7旧权重2×互证口径存疑，本值不依赖权重模型；round13新增Plus同框32~75M/周散布于1.28~3.0亿/月，与1.59亿同量级不改值；Pro20x已按round13挂点；未折算：抽取只含 input＋cache_read，缺 output 分项"),
    # GPT-6 Sol（9/22 新发）—— 维护者Plus账号2026-09-24本机Codex当日增量直测；只挂Plus，Pro 5x/20x不派生（裁定）
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-6-sol", chatgpt_sol6_monthly_yi(), "high", "维护者本机Codex实测：当日增量gpt-6-sol total 15,716,975 tokens（input 693,878/output 46,713含reasoning 14,925/cache_read 14,976,384，hit 95.57%）= 周额度约6%；chatgpt-gpt6sol-plus-round1-2026-09-24.json；workload-conversion-round1-2026-09-30.json", f"10.48→{chatgpt_sol6_monthly_yi():g}亿（2026-09-30 裁定带分项实测统一折算）：段 worth ${worth_usd(CHATGPT_PLUS_SOL6_SEGMENT, GPT6_SOL_LIST):.4f}（cache 14.98M×$0.2＋入0.69M×$2＋出0.05M×$10）÷6%×4周＝${worth_usd(CHATGPT_PLUS_SOL6_SEGMENT, GPT6_SOL_LIST)/0.06*4:.2f} ÷标准档混合价${blended(*GPT6_SOL_LIST):.3f}/MTok；raw 口径 {chatgpt_sol6_raw_monthly_yi():g} 留作对照。以下为原采用决策——新增{chatgpt_sol6_raw_monthly_yi():g}亿：15,716,975÷6%×4周（原 raw 口径）；6%为口述取整，5.5~6.5%折算口径对应10.15~12.00亿（raw 口径9.67~11.43）；$2/$10与AA页标价一致，cached 0.1×推定未见官方页；昨日77.8M无周%检查点不参与；Pro 5x/20x不派生（裁定只挂Plus）；榜分见scores-gpt6sol-round1-2026-09-24.json"),
    # GPT-6 Luna（9/22 新发）—— 维护者Plus账号本机Codex新一周周窗直测；round2（97%→91%，effort=max）取代 round1；只挂Plus，Pro 5x/20x不派生（沿Sol裁定）
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-6-luna", chatgpt_luna6_monthly_yi(), "high", "维护者本机Codex实测（effort=max）：新一周窗09-27 22:09 97%→09-28 20:44 91%增量全为gpt-6-luna total 137,648,446 tokens（input 3,129,683/output 757,355含reasoning 471,268/cache_read 133,761,408，hit 97.71%）；chatgpt-gpt6luna-plus-round2-2026-09-28.json", f"91.77→{chatgpt_luna6_monthly_yi():g}亿（2026-09-30 裁定带分项实测统一折算）：段 worth ${worth_usd(CHATGPT_PLUS_LUNA6_SEGMENT, GPT6_LUNA_LIST):.4f}（cache 133.76M×$0.01＋入3.13M×$0.1＋出0.76M×$0.5）÷6%×4周＝${worth_usd(CHATGPT_PLUS_LUNA6_SEGMENT, GPT6_LUNA_LIST)/0.06*4:.2f} ÷标准档混合价${blended(*GPT6_LUNA_LIST):.4f}/MTok；raw 口径 {chatgpt_luna6_raw_monthly_yi():g} 留作对照。以下为原采用决策——44.05→{chatgpt_luna6_raw_monthly_yi():g}亿：137,648,446÷6%×4周（原 raw 口径）；面板整数%读数Δpp5~7折算口径对应78.88~110.44亿（raw 口径78.66~110.12）；本周22.94M tok/pp≈round1合并样本11.01M的2.08×（standard段10.20M的2.25×），两侧取整区间不重叠，判为周池放大或effort计权变化（本周max、round1未记effort，两因果链不可区分）而非噪声；裁定新一周分开记，round1 44.05亿留作对照不合并不平均；段内gpt-5.6-luna累计205,934,189、6sol/astra均未动，6pp全归6-luna；Pro 5x/20x不派生（沿Sol裁定）；榜分沿用scores-gpt6luna-round1-2026-09-26.json"),
    # GPT-6.1 Sol —— 维护者Plus账号本机Codex周窗直测（剩余81%→50%，31pp，round1~round3三段拼合）；只挂Plus，Pro 5x/20x不派生（沿Sol裁定）；暂无榜分
    ("chatgpt_plus", "ChatGPT Plus", 20, "USD", "gpt-6.1-sol", chatgpt_sol61_monthly_yi(), "high", "维护者本机Codex实测：周窗剩余81%→50%（31pp）整段 gpt-6.1-sol total 55,532,850 tokens（input 2,742,389/cache_read 52,536,064/cache_write 0/output 254,397含reasoning 72,105，hit 95.04%）；chatgpt-gpt61sol-plus-round1/round2/round3-2026-09-30.json；workload-conversion-round1-2026-09-30.json", f"7.75→{chatgpt_sol61_monthly_yi():g}亿（2026-09-30 裁定带分项实测统一折算，并入第三段60%→50%后整体重算）：段 worth ${worth_usd(CHATGPT_PLUS_SOL61_SEGMENT, GPT61_SOL_LIST):.4f}（cache 52.54M×$0.10＋入2.74M×$2＋出0.25M×$10）÷31%×4周＝${worth_usd(CHATGPT_PLUS_SOL61_SEGMENT, GPT61_SOL_LIST)/0.31*4:.2f} ÷标准档混合价${blended(*GPT61_SOL_LIST):.3f}/MTok；GPT-6.1 Sol 官方价 $0.10/$2/$10（learn.chatgpt.com credits 2.5/50/250 ÷25，cached=输入5%，取代先按 6-Sol $0.2 假设的 8.96亿；若仍按 6-Sol 价为 8.14亿留作对照）；raw 口径 {chatgpt_sol61_raw_monthly_yi():g} 留作对照。；疑点（2026-10-01 裁定先记录、按整段 81%→50% 采用）：第三段 60%→50% 每 1% $0.330，比前两段 $0.476/$0.473 低约 30%，10pp 整数读数取整（约 ±10%）不足以解释，原因未明。缓存读价经2026-10-01 确认：GPT-6.1 Sol $0.10、GPT-6 Sol $0.20。原采用决策——新增{chatgpt_sol61_raw_monthly_yi():g}亿：整段55,532,850÷31%×4周（=81%→65%段30,109,568÷16pp + 65%→60%段10,562,908÷5pp + 60%→50%段14,860,374÷10pp，三段边界拼合且分量逐项吻合）；面板整数%读数Δpp30~32折算口径对应8.43~8.99亿；截图标题82%/32pp起始读数经更正为81%；按6.1官方credits档反推周池1,071cr（$42.85），linux.do观察Plus约3,426cr/周与Pro20x同池Sol-worth÷20更接近5.6等价费率下的$119.6/周——订阅内计费率或池口径差异记入不确定性；分段密度（6.1价）：seg1 $0.476/pp、seg2 $0.473/pp、seg3 $0.330/pp；Pro 5x/20x不派生（沿Sol裁定）；暂无榜分，有分后补supplement"),
    # Pro20x Astra —— round12 因三源分歧2.7×暂不挂点；round13 维护者转交的同框批次（g5a/g8）+ sdmat 使 8 亿簇达 5 条独立来源，裁决收敛
    ("chatgpt_pro_20x", "ChatGPT Pro 20x", 200, "USD", "gpt-6-astra", CHATGPT_PRO20X_ASTRA_MONTHLY_YI, "medium", "8条实测源加权：Observatory 8.53、round10截图13.8、round13同框7.52、round14维护者面板10.0、msg7086 8.07、round14图4(2/3周)8.18、图2自述9.25、图3后台10.3亿/周；chatgpt-astra-round12/13/14", f"新增{CHATGPT_PRO20X_ASTRA_MONTHLY_YI:g}亿：周池{CHATGPT_PRO20X_ASTRA_WEEK_YI:g}亿×{MONTH_WEEKS:g}周——实测源按验证等级加权（面板同框/维护者面板/连续序列×3、自述份额×2、社区口述×1），round10的10%与档位经确认由不采改为入权；round14新口径：周池≈$1200~1500 list-worth（Astra），同池Sol $2200~2500，内部计权对Astra惩罚~1.9×；维护者自测≈32亿/月与lichengzhe网关21~23亿按裁定不入权，纯口述与仅下限源不进均值；隐含权重≈{CHATGPT_PRO20X_SOL_MONTHLY_YI/4/CHATGPT_PRO20X_ASTRA_WEEK_YI:.2f}×Sol；同源真实测量仍散布6.8~15.6亿/周，账号间池子可能本就不同，此值为加权中心而非普适常数；未折算：八源加权、多数来源无 token 分项"),
    # Devin —— 维护者Max账号本周87pt近满周段astra单列反推（305M tokens/667 calls）；swe-2-max等免费不占额度，Max官方为周池无日上限
    ("devin_max", "Devin Max", 200, "USD", "gpt-6-astra", devin_max_astra_monthly_yi(), "medium", "维护者Devin Max面板cc usage：本周gpt-6-astra-high total 305,025,580 tokens（calls 667，in 1,998/out 369,918/cache_read 300,944,710/cache_create 3,708,954）= 周额度87pt（剩余100%→13%）；devin-usage-round4-2026-09-14.json；anthropic-token-mix-round1-2026-09-24.json；https://devin.ai/pricing Max $200/月", f"{devin_max_astra_raw_monthly_yi():g}→{devin_max_astra_monthly_yi():g}亿（2026-09-24裁定按统一负载折算）：段 worth ${devin_max_astra_segment_worth_usd():.2f}（cache读300.945M×$1＋写/输入3.711M×$10＋输出0.370M×$50；OpenAI无缓存写费，cache_create按普通输入计）÷87%×4周＝月${devin_max_astra_segment_worth_usd()/0.87*4:.2f} list-worth ÷ 标准负载混合价${blended(1,10,50):.2f}/MTok；面板%取整区间约11.03~11.28亿；原始total口径305,025,580÷87%×4周＝14.02亿留作对照；87pt近满周样本（round2 20pt段的3.76倍）取代旧反推，raw周池406M→350.6M（-13.7%，round2/3留作历史证据）；命中率按含cache_create口径98.78%（与round2段97.84%同量级，极端缓存型负载）；swe-2-max等免费不占额度；折算假设Devin按标价比例扣额度；Pro $20档无数据不派生"),
    # Opus 5.5 —— 同账号同面板双检查点增量法：云端剩余75%→27%段内 Opus5.5 净增525.3M raw
    ("devin_max", "Devin Max", 200, "USD", "claude-opus-5.5", devin_max_opus55_monthly_yi(), "medium", "维护者Devin Max面板cc usage双检查点：云端周额度剩余75%→27%（差48pt）段内 claude-opus-5-5-xhigh +1,142 calls/+512,221,810 tok、claude-opus-5-5-high +118/+13,111,946，合计 +1,260 calls/+525,333,756 tokens；devin-opus55-round1-2026-09-23.json；anthropic-token-mix-round1-2026-09-24.json；https://devin.ai/pricing Max $200/月", f"{devin_max_opus55_raw_monthly_yi():g}→{devin_max_opus55_monthly_yi():g}亿（2026-09-24裁定按统一负载折算）：本段实测负载 cache读91.97%/cache写7.67%/输入0.001%/输出0.365% 偏离标准档；按Opus 5.5标价 cached$0.2/写5m $5/in$4/out$20 折段 worth ${devin_max_opus55_segment_worth_usd():.2f} ÷48%×4周＝月${devin_max_opus55_segment_worth_usd()/0.48*4:.2f} list-worth ÷ Anthropic档混合价${blended_anthropic(0.2,5.0,20.0):.3f}/MTok；面板%取整区间约65.53~68.32亿；cache写按1h $8敏感性77.12亿不采；原始total口径525,333,756÷48%×4周＝43.78亿（取整42.88~44.71）留作对照；裁定48pp全归Opus 5.5（若段内有其他计费模型消耗，Opus实际所占pp更少、周池更大，本值偏保守）；swe-2等免费不占额度；worth对账：恒定池口径Opus5.5按约0.6×标价计（与Astra周池3.12×张力指向共享池模型加权）；仅本行与同面板Astra行折算；effort仅影响速率；Pro $20档无数据不派生"),
    # Factory Droid —— 维护者Max账号 /limits 周窗 1%→9% 两段增量直测；月＝2×周（30 天窗绑定）；Pro 另挂社区口述点（low），Plus 不派生
    ("droid_max", "Droid Max", 200, "USD", "claude-opus-5.5", droid_max_opus55_monthly_yi(), "medium", "维护者Factory Droid本机实测：周额度（7-day rolling）已用1%→5%段（xhigh）+35,598,616 tok、5%@08:13→9%@12:40段（high，新会话47f9711d）+36,567,946 tok，合计+72,166,562 tok全为claude-opus-5-5（auto 0增量；glm-5.3-flash +50,317 属Droid Core免费池不计）；合计分拆 in 793,017/out 375,172/cache_create 3,640,056/cache_read 67,311,924/thinking 46,393；droid-opus55-max-round1-2026-09-29.json；https://factory.ai/pricing Max $200/月", f"首个Factory Droid点，按devin_max×opus-5.5同口径折算：1→9合计负载 cache读93.27%/cache写5.04%/输入1.10%/输出0.52%/thinking0.06%（hit 93.82%）偏离标准档；按Opus 5.5标价 cached$0.2/写5m $5/in$4/out$20（thinking 46,393不计费，裁定；与factoryCredits 16,935,482≈worth÷$4×1.6对账一致）折段 worth ${droid_max_opus55_segment_worth_usd():.2f} ÷8%×{DROID_MONTH_WEEKS:g}（Factory 30天窗＝2×7天窗，2026-10-03裁定；原按×4周为50.52亿）＝月${droid_max_opus55_segment_worth_usd()/0.08*DROID_MONTH_WEEKS:.2f} list-worth ÷ Anthropic档混合价${blended_anthropic(0.2,5.0,20.0):.3f}/MTok＝{droid_max_opus55_monthly_yi():g}亿；1%/9%为取整读数，Δpp∈[7,9]对应约22.46~28.87亿；cache写按1h $8敏感性26.96亿不采；原始total口径72,166,562÷8%×{DROID_MONTH_WEEKS:g}＝{droid_max_opus55_raw_monthly_yi():g}亿（周池902,082,025 raw）留作对照；factoryCredits 16,935,482≈2.12亿credits/周；两段4pp各8.90M/9.14M tok每pp（差2.7%），effort仅影响速率；Factory另有5h与30天滚动窗，月额度以30天窗（＝2×周池）为绑定约束；Pro $20/Plus $100官方仅写约1/10、1/5 Max用量，不派生"),
    ("droid_pro", "Droid Pro", 20, "USD", "claude-opus-5.5", droid_pro_opus55_monthly_yi(), "low", "X @SnowyWar36965 社区口述（2026-09-28，维护者转交截图）：Droid Pro $20 跑 Claude Opus 5.5 小动画用掉 5h 窗约70%，帖主按等价 API 消耗折算 5h≈$15.4、周≈$45、月≈$160（Max 10x≈$154/$450/$1,600，约合 1.76/5.1/18 亿 token）；droid-pro-opus55-community-round1-2026-09-29.json；https://factory.ai/pricing Pro $20/月", f"帖主周 list-worth ${DROID_PRO_OPUS55_COMMUNITY_WORTH_USD['week']:g}×{DROID_MONTH_WEEKS:g}（Factory 30天窗＝2×7天窗，2026-10-03裁定）＝${DROID_PRO_OPUS55_COMMUNITY_WORTH_USD['week']*DROID_MONTH_WEEKS:g} ÷ Anthropic档混合价${blended_anthropic(0.2,5.0,20.0):.3f}/MTok＝{droid_pro_opus55_monthly_yi():g}亿（同 droid_max×opus-5.5 口径；帖主自带 token 列 18亿/$1,600≈$0.89/MTok 为其自身负载，不采）；帖主月值 ${DROID_PRO_OPUS55_COMMUNITY_WORTH_USD['month']:g}（{DROID_PRO_OPUS55_COMMUNITY_WORTH_USD['month']/blended_anthropic(0.2,5.0,20.0)/100:.2f}亿，原采用值）约为其周值3.56×，与30天窗＝2×周不符，不采；弱点：口述估算、无面板截图与 token 分拆、n=1、5h/周/月换算过程未公开 → low；对照：本机实测 Droid Max 月 worth ${droid_max_opus55_segment_worth_usd()/0.08*DROID_MONTH_WEEKS:,.2f} ÷ 官方约10× ＝ Pro 约${droid_max_opus55_segment_worth_usd()/0.08*DROID_MONTH_WEEKS/10:.2f}（{droid_max_opus55_segment_worth_usd()/0.08*DROID_MONTH_WEEKS/10/blended_anthropic(0.2,5.0,20.0)/100:.2f}亿），帖主值约为其 {DROID_PRO_OPUS55_COMMUNITY_WORTH_USD['week']*DROID_MONTH_WEEKS/(droid_max_opus55_segment_worth_usd()/0.08*DROID_MONTH_WEEKS/10):.2f}×"),
    # Google —— Antigravity 合池按 API worth 计权（官方机制）；round7 维护者本地实测补上首个周帽同框
    ("google_ai_pro_us", "Google AI Pro", 19.99, "USD", "gemini-3.8-flash", google_ai_pro_monthly_yi(), "high", "issue #54（NTRYourWaifu）：agy /quota 每 5 分钟轮询周额度 %，三个周窗、只计 3.8 Flash ≥95% 区段，853.43M raw = +165.77pp；community-issues-round1-2026-09-29.json；维护者本地实测：B整段55.343M raw(cache45.69M/in9.26M/out0.40M)=周条+9.88%；gemini-weekly-round7-2026-09-21.json；workload-conversion-round1-2026-09-30.json", f"20.70→{google_ai_pro_monthly_yi():g}亿（2026-09-30 裁定带分项实测统一折算，低缓存档）：两样本 worth 按百分点合并（本机B段 cache 45.69M/入9.26M/出0.40M＝${worth_usd(GOOGLE_PRO_B_SEGMENT, GEMINI_FLASH_LIST):.4f}＋#54 cache 695.70M/入146.25M/出11.48M＝${worth_usd(GOOGLE_PRO_ISSUE54_SEGMENT, GEMINI_FLASH_LIST):.3f}）÷175.65pp＝$1.23415/pp → 周$123.42×4周 ÷ 低缓存档混合价$0.19125/MTok；实测 cache 82~84% 属低缓存族，标准档口径 44.78 亿不采；raw 口径 {google_ai_pro_raw_monthly_yi():g} 留作对照。以下为 2026-09-29 原采用决策（raw 口径）——22.41→20.70亿，2026-09-29 裁定：issue #54（agy /quota 每 5 分钟周额度 %，三个周窗，只计 3.8 Flash 占 95% 以上区段）853.43M raw = 周 +165.77 个百分点（单看 20.59），与维护者本机样本 55.343M = +9.88% 按百分点合并：(55.343+853.43)÷(9.88+165.77)＝5.1738M/pp ×100×4周＝20.70亿 raw。两样本 cache 命中均约 82.6%。worth 每 1% 约 $1.19~1.25，与 effort 无关。证据：community-issues-round1-2026-09-29.json；原样本见 gemini-weekly-round 证据。"),
    ("google_ai_pro_us", "Google AI Pro", 19.99, "USD", "gemini-3.6-flash", google_ai_pro_36_monthly_yi(), "medium", "issue #55（NTRYourWaifu）：agy CLI 每 5 分钟轮询周额度 %，只计 3.6 Flash ≥95% 区段，95.60M raw = 周 +21.70pp；community-issues-round1-2026-09-29.json；workload-conversion-round1-2026-09-30.json", f"17.62→{google_ai_pro_36_monthly_yi():g}亿（2026-09-30 裁定带分项实测统一折算，低缓存档）：#55 段 worth ${worth_usd(GOOGLE_PRO_ISSUE55_SEGMENT, GEMINI_FLASH_LIST):.3f}（cache 78.32M×$0.075＋入14.95M×$0.75＋出2.33M×$3.75）÷21.70pp＝$1.19005/pp → 周$119.0×4周 ÷ 低缓存档$0.19125/MTok；raw 口径 17.62 留作对照。以下为 2026-09-29 原采用决策（raw 口径）——新增17.62亿，2026-09-29 裁定：issue #55（agy CLI，方法同 #54，只计 3.6 Flash 占 95% 以上区段）95.60M raw = 周 +21.70 个百分点 ×100×4周，cache 命中 84.0%。每 1% 标价美元约 $1.19，与 3.8 Flash 相同，支持 Google AI Pro 各模型共用按价额度池。样本仅 21.7 个百分点、单一投稿人 → medium。不派生 Ultra。证据：community-issues-round1-2026-09-29.json。"),
    ("google_ai_ultra_5x_us", "Google AI Ultra 5x", 99.99, "USD", "gemini-3.8-flash", round(google_ai_pro_monthly_yi() * 5, 2), "low", "官方：Ultra $100 = 5× Pro token worth（antigravity.google/blog 2026-05-19）", f"新增{google_ai_pro_monthly_yi()*5:g}亿：Pro采用值×官方worth倍率5；LLMDevs Ultra~5.0B/周同量级旁证；非独立实测"),
    ("google_ai_ultra_20x_us", "Google AI Ultra 20x", 199.99, "USD", "gemini-3.8-flash", round(google_ai_pro_monthly_yi() * 20, 2), "low", "官方：Ultra $200 = 20× Pro token worth（antigravity.google/blog 2026-05-19）", f"新增{google_ai_pro_monthly_yi()*20:g}亿：Pro采用值×官方worth倍率20；非独立实测"),
    # Anthropic —— Pro采用shownotover面板截图反推Opus5周池；Max采用9/14永久口径估算157亿，非当期boost或纯Opus5硬上限
    #   5x/20x是5h窗口倍率；已确认20x周池仅为5x的2倍，旧2.25周池比例不再采用；Pro无独立Opus周池（官方文档），7% all-models周读数即绑定约束
    ("claude_pro", "Claude Pro", 20, "USD", "claude-opus-5", claude_pro_opus5_monthly_yi(), "high", "issue #53（NTRYourWaifu）：两个 Pro 账号 9/14~9/22 轮询 /api/oauth/usage seven_day %、按 message.id 去重，Opus 5 共 1,022.02M raw = 周 +148pp；community-issues-round1-2026-09-29.json；旧源 X @shownotover Pro /usage 面板 32.87M = 周池7%（claude-adoption-round8-2026-09-20.json）不再入权；workload-conversion-round1-2026-09-30.json", f"27.62→{claude_pro_opus5_monthly_yi():g}亿（2026-09-30 裁定带分项实测统一折算，Anthropic 档）：段 worth ${CLAUDE_PRO_OPUS5_ISSUE53_WORTH_USD:g}（读1,004.96M×$0.5＋1h写12.99M×$10＋入0.01M×$5＋出4.06M×$25）＝每1% $4.96 → 周$495.9×4周 ÷ Anthropic 档混合价${blended_anthropic(0.5, ANTHROPIC_CACHE_WRITE_5M['claude-opus-5'], 25.0):.5f}/MTok；raw 口径 {claude_pro_opus5_raw_monthly_yi():g} 留作对照。以下为 issue #53 采用决策——{claude_pro_opus5_panel_monthly_yi():g}→{claude_pro_opus5_raw_monthly_yi():g}亿，2026-09-30 裁定改用 issue #53：两个 Pro 账号、全部在 9/14 永久 +25% 之后，1,022.02M raw（读1,004.96M/1h写12.99M/入0.01M/出4.06M）＝周 +148 个百分点 → 6.906M/pp ×100 ×{MONTH_WEEKS:g}周；两个整周分别 24.60/28.96 亿；按标价每 1% worth $4.96。旧面板样本每 1% $3.67（7% 整数读数，区间 17.53~20.23 亿），高出 35%/47% 与 +25% 调整幅度相近，疑为 9/14 前测得，故不与之合并（合并为 27.22 亿不采）；Anthropic 档 worth 口径 25.89 亿（2026-09-30 起改判为采用，见首行）。张力：与 Max 20x 采用值 157 的比从 8.35× 变为 5.68×，与 Opus 5.5 的 301.7/30.54≈9.9× 不一致，指向 Max 20x 侧口径或 5.5/5 池权重（#52/#53 推约 0.843），待裁定。以下为旧 18.78 决策原文——Opus4.8历史15.88亿→Opus5面板反推{claude_pro_opus5_panel_monthly_yi():g}亿：32,868,513 total（opus5 32.85M + haiku 23k）÷7%×{MONTH_WEEKS:g}周；周池4.70亿、5h池56.7M，周池为绑定约束；周%取整区间约17.5~20.2亿；单会话n=1初定medium；round5候选Opus5约1.9亿（假定周消息数）被面板直测推翻作废；标价闭合校验$25.68吻合；2026-09-21裁定Opus4.8旧测不入权——round8曾按基准期读法×1.25=19.85亿作互证，但round6记录该值含+50%活动期boost，忠实映射为÷1.5×1.25=13.23亿且与面板矛盾，故仅面板单源；round9同作者第二条40M=周13%记为张力：新周读法12.3亿/续周读法26.7亿/下限读法不约束，基线不可考不入权；2026-09-21裁定升high：面板级形式+价格闭合校验+下调后口径+与Max20x周池比8.35×自洽；#3新周读法12.3亿与Max池比将失衡（$20得$100档的相对池份额异常），反证18.78侧。注：曾引'8.28窗/周与Max同构'为旁证，round9检查点反推Max档5h池~7.1亿（非4.74亿满窗读法）后该互证撤回——Max周满窗数~5.5非8.3"),
    ("claude_max_20x", "Claude Max 20x (9/14+)", 200, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI, "medium", "Zenn skipbit实测+维护者永久口径；claude-adoption-round6-2026-09-06.json", f"旧80亿→{CLAUDE_MAX_20X_YI:g}亿，9/14起永久口径：47.2亿/周×{MONTH_WEEKS:g}周÷1.5×1.25后取整；参考区间110~200亿。混合模型及非完全同窗样本，非纯Opus5实测硬上限；不取活动期189或裸基准126；round9 alldonesites纯Opus5满窗中位4.74亿（簇4.15~4.74亿三源）为窗容量读数——5h池口径存分歧：chudi检查点反推~7.1亿、官方20×Pro暗示11.34亿，Max周满窗数~5.5而非早记8.3，窗结构不作采用依据；round9时间线校正后Reddit审计转正：「本周」单号21亿cache读=周52%系9/17重置后下调后读数→周池≈40亿→161亿/月与采用值差3%，为纯Opus负载最优周池corroboration；「上周」237亿raw=230%系活动期大池口径不再矛盾；低端张力仅余其5窗假设95亿；未折算：Zenn 混合模型样本无 token 分项，保留 raw"),
    ("claude_max_5x", "Claude Max 5x (9/14+)", 100, "USD", "claude-opus-5", CLAUDE_MAX_20X_YI / CLAUDE_WEEKLY_20X_TO_5X, "medium", "已确认20x周池仅为5x的2倍；claude-adoption-round6-2026-09-06.json", "旧35.6亿→78.5亿，9/14起永久口径157÷2；low→medium按裁定周池关系推算，非独立实测；不采用36亿消息数候选或70亿/旧2.25倍率；5h窗口4倍关系不套周池"),
    # Fable 5.1 —— round3 首个同框样本（同日 token 日志 × /usage 周%），覆盖 round7"无实测不推"；
    #   档位按裁定挂 20x，但月额度绝对值与档位无关（19%直接定池）；若实为5x则隐含权重1.31×而非2.61×
    ("claude_max_20x", "Claude Max 20x (9/14+)", 200, "USD", "claude-fable-5.1", claude_fable51_max_monthly_yi(), "medium", "维护者提供样本：Max账号同日 /usage 周额度0%→19% 对应 2443 轮 285.6M raw tokens（cache读283M+输出2.6M）；claude-fable51-round3-2026-09-20.json；round9 时间线校正", f"30.06→{claude_fable51_max_monthly_yi():g}亿：样本实测于9/4~5促销期，19%分母是活动期池47.2亿/周非永久池39.25亿——旧算法把混合当量池错挂永久口径且未拆Opus份额；重分解：消耗0.19×47.2=8.97亿当量，Opus份额1.13亿raw权重1，Fable份额1.725亿raw→隐含权重≈{CLAUDE_FABLE51_W:.2f}×Opus（落进Fable5实测4.25~6.5区间自洽）；月额度=157×50%÷{CLAUDE_FABLE51_W:.2f}；美元计权法独立验证得17.0亿；次日3017轮→24%互验（同期口径一致）；单账号n=1定medium；未折算：样本只有 cache 读＋输出，缺写入/输入分项，且经活动期池分解"),
    # Opus 5.5 —— round1 社区窗池样本（维护者提供推文）：首个 Opus5.5 token×用量条证据；
    #   档位按裁定挂 20x（推文未标档，隐含加权窗池量级仅 20x 自洽）；月额=采用月池÷隐含权重
    ("claude_max_20x", "Claude Max 20x (9/14+)", 200, "USD", "claude-opus-5.5", CLAUDE_OPUS55_MAX20X_MONTHLY_YI, "medium", "X @MiaAI_lab 推文（维护者提供截图）：xHigh 1h2m 烧 10.305亿 raw = ~75% of 5h limit；claude-opus55-round1-2026-09-23.json；round10 条目#15 Max 20x ≈5.5 满窗/周（claude-adoption-round10-2026-09-25.json）；Claude Pro × Opus 5.5 采用样本（issue #52 + Reddit 段）×10；claude-opus55-max20x-round2-2026-09-30.json", f"{CLAUDE_OPUS55_MAX20X_RAW_MONTHLY_YI:g}→{CLAUDE_OPUS55_MAX20X_MONTHLY_YI:g}亿（2026-09-30 裁定，Anthropic 档）：两路各折成 Max 20x 周额度百分点后按百分点合并——① MiaAI 窗 worth ${claude_max20x_opus55_sources()['mia'][0]:.2f}（写按 5m，与推文 $482.63 闭合）= 75% 窗 ÷ {CLAUDE_MAX20X_WINDOWS_PER_WEEK:g} 窗/周 = 周 {claude_max20x_opus55_sources()['mia'][1]:.3f}pp，单独 {claude_max20x_opus55_yi(*claude_max20x_opus55_sources()['mia']):g}亿；② Pro × Opus 5.5 合并 worth ${claude_max20x_opus55_sources()['pro10'][0]:.2f} / 196.333 Pro pp ÷ Max 20x 周额度 = Pro×{CLAUDE_MAX20X_TO_PRO_WEEKLY:g} → 周 {claude_max20x_opus55_sources()['pro10'][1]:.3f}pp，单独 {claude_max20x_opus55_yi(*claude_max20x_opus55_sources()['pro10']):g}亿；两路差 8%。不采：Pro 5h/周 13.333%（7.5 窗）直接套 Max 20x 得 449.7 亿（Max 20x 窗 20×、周 10×，窗/周比与 Pro 不同）；官方倍率推 3.75 窗/周得 224.9 亿（MiaAI 窗仅为 Pro 窗 15.5× 而非 20×，与两倍率同时精确不自洽）；等权平均 317.58 亿；#65 混合样本暂不处理。以下为旧 301.7 决策原文——新增301.7亿：5h池 10.305亿÷~75%={CLAUDE_OPUS55_POOL5H_YI:.2f}亿 raw（9/22发布已上调 Pro/Max/Team 5h 上限，窗池系发布期口径）；隐含权重 {CLAUDE_OPUS55_5H_WEIGHTED_YI:.2f}/{CLAUDE_OPUS55_POOL5H_YI:.2f}={CLAUDE_OPUS55_W:.4f}×Opus5 → 月池157÷{CLAUDE_OPUS55_W:.4f}；标价混合比0.5143独立互证（备选305.28亿差1.2%）；样本按新价$471.1≈推文$482.63闭合(+2.4%)；n=1推文无面板、~75%取整读数（月额区间约283~322亿）、effort仅影响速率；若官方权重偏离价格比（Fable 6.5×前车之鉴）需重推；周池面板直测/reset后受控打满可升high"),
    # Opus 5.5 × Pro —— round10 Reddit 满窗样本（2026-09-25 裁定 worth 口径，替换借权重派生值36.09亿）
    ("claude_pro", "Claude Pro", 20, "USD", "claude-opus-5.5", claude_pro_opus55_monthly_yi(), "high", "issue #52（NTRYourWaifu）：两个 Pro 账号轮询 /api/oauth/usage seven_day %、按 message.id 去重，Opus 5.5 ≥95% 区段 1,396.81M raw = 周 +183pp；community-issues-round1-2026-09-29.json；另与 Reddit r/ClaudeCode 帖满窗段（grok_report 条目#1：151,193,723 raw = 周 13.333%）按百分点合并；claude-adoption-round10-2026-09-25.json", "28.99→30.54亿，2026-09-29 裁定：issue #52（两个 Pro 账号，每 5 分钟轮询 seven_day %，按 message.id 去重，只计 Opus 5.5 占 95% 以上区段）1,396.81M raw = 周 +183 个百分点，标价 worth $587.52（读 $0.2 / 1h 写 $8 / 5m 写 $5 / 入 $4 / 出 $20）；与原 Reddit 5h 段（worth $40.48 / 周 13.333%）按百分点合并：($40.48+$587.52)÷(13.333+183)＝$3.19865/pp → 月 $1,279.46 ÷ Anthropic 档 $0.419/MTok＝30.54亿。单看 #52 为 30.65、Reddit 段 28.98；raw total 口径 30.53，写全按 5m 价 27.39 不采。high/xhigh 每 1% 标价美元均约 $3.2，effort 只影响速率。互证（仅记录不入权，2026-09-30 裁定关闭 PR #77）：X @kanzakichiya ccusage 两周 478.15M raw＝周 22%+47%（口述），缓存写全为 1h，按实际写价 worth $208.25 → $3.018/pp → 28.81 亿，与 #52 $3.210/pp、Reddit 段 $3.036/pp 差 <7%；三源按百分点合并为 30.09 亿、写按 5m 为 24.52 亿，均不采（claude-adoption-round11-2026-09-30.json）。证据：community-issues-round1-2026-09-29.json。"),
    # xAI —— 面板周额度（维护者面板：Super $25 / Plus $100 / Heavy $250）是 Grok 自己的额度美元，不等于公开标价美元
    #   （linux.do 按标价记出 Super $90~110 / Heavy $900，比例相同、整体 3.6×）。所以不用标价换算，而用 Super 档实测 token 标定：
    #   V2EX+#56 合并标定 1.196 亿/周 ÷ $25 = 面板 $1 ≈ 478 万 token，再套到 Plus / Heavy。
    ("supergrok", "SuperGrok", 30, "USD", "grok-4.6", supergrok_monthly_yi(25, 2), "high", f"V2EX受控打满127,272,629 token=整周100%，与 issue #56（Grok Build _x.ai/billing 轮询）两平常周223.1M=+193pp 按百分点合并→周池{SUPERGROK_WEEKLY_TOKENS:,}；community-issues-round1-2026-09-29.json；workload-conversion-round1-2026-09-30.json", f"4.78→{supergrok_monthly_yi(25, 2):g}亿（2026-09-30 裁定带分项实测统一折算）：V2EX 段无分项按已是标准档计 worth（127,272,629×$0.565＝$71.909）＋#56 段 worth ${worth_usd(SUPERGROK46_ISSUE56_SEGMENT, GROK_LIST):.2f}（cache 206.4M×$0.5＋入15.3M×$2＋出1.29M×$6）÷293pp＝$0.7284/pp → 周$72.85×4周 ÷ 标准档混合价$0.565/MTok＝周池 {SUPERGROK_WEEKLY_TOKENS:,}；raw 口径 4.78 留作对照；疑似双倍活动周（236M、274M）与低命中周未计入。以下为 2026-09-29 原采用决策（raw 口径）——5.09→4.78亿，2026-09-29 裁定：issue #56（Grok Build _x.ai/billing 每 5 分钟周额度 %，对照 unified.jsonl）两个完整平常周 223.1M raw = +193 个百分点（+94%/120.9M、+99%/102.2M，单看 4.62），与 V2EX 受控打满 127,272,629 token（整周 100%）按百分点合并：(127.272629+223.1)÷(100+193)＝1.1958M/pp ×100×4周＝4.78亿。证据：community-issues-round1-2026-09-29.json。"),
    ("supergrok_plus", "SuperGrok Plus", 100, "USD", "grok-4.6", supergrok_monthly_yi(100, 1), "medium", f"面板周额度$100×Super精确标定×{MONTH_WEEKS:g}周", f"采用{supergrok_monthly_yi(100, 1):g}亿：{SUPERGROK_WEEKLY_TOKENS:,}×{MONTH_WEEKS:g}周×100/25，按一位小数取值；linux.do用户口述每用一刀涨1%与周$100吻合"),
    ("supergrok_heavy", "SuperGrok Heavy", 300, "USD", "grok-4.6", supergrok_monthly_yi(250, 1), "medium", f"面板周额度$250×Super精确标定×{MONTH_WEEKS:g}周", f"采用{supergrok_monthly_yi(250, 1):g}亿：{SUPERGROK_WEEKLY_TOKENS:,}×{MONTH_WEEKS:g}周×250/25，按一位小数取值；标价换算18亿作废（面板美元≠标价美元）；Zhang 208亿未采"),
    ("supergrok_lite", "SuperGrok Lite", 10, "USD", "grok-4.6", 1.5, "low", "aa_grok_build_2026_07", "面板周额度未知，三轮联网均无；未折算：AA 占位值，无实测样本"),
    # Grok 4.7 —— round2 维护者本机实测（2026-09-22，Grok Build CLI xhigh）：「这次」窗 56.6M tok = 周额度 +45.5%；
    #   分数由 scores-grok47-round1 补充档从 AA round4 未映射载荷提升（int 46.45 / coding 56.27）
    ("supergrok", "SuperGrok", 30, "USD", "grok-4.7", supergrok_monthly_yi(25, 2, SUPERGROK47_WEEKLY_TOKENS), "medium", "维护者本机实测 round2：Grok Build xhigh「这次」窗 56,629,383 tok = 周额度 +45.5475%；supergrok-grok47-round2-2026-09-22.json；workload-conversion-round1-2026-09-30.json", f"4.97→{supergrok_monthly_yi(25, 2, SUPERGROK47_WEEKLY_TOKENS):g}亿（2026-09-30 裁定带分项实测统一折算）：「这次」窗 worth ${worth_usd(SUPERGROK47_ROUND2_SEGMENT, GROK_LIST):.4f}（cache 51.73M×$0.5＋入4.62M×$2＋出0.28M×$6）÷45.5475%＝周$80.75 ÷ 标准档混合价$0.565/MTok＝周池 {SUPERGROK47_WEEKLY_TOKENS:,}；raw 口径 4.97 留作对照。以下为原采用决策——6.72→{supergrok_monthly_yi(25, 2, SUPERGROK47_WEEKLY_TOKENS):g}亿：周池 168,035,200→{SUPERGROK47_WEEKLY_TOKENS:,}——round2 大窗实测取代 round1 份额推断；三窗反推 176.1M/124.3M/132.1M，裁定「这次」（45.5% 最大消耗窗）最可信；「之前」窗已对上 round1 三会话，删除版实得 628,541 tok/0.36%；对 4.6 折算周池 {SUPERGROK_WEEKLY_TOKENS/1e8:.3f}亿为 {SUPERGROK47_WEEKLY_TOKENS/SUPERGROK_WEEKLY_TOKENS:.2f}× 同量级；两窗反推不重合，池口径或面值有未解变量，n=1 账号维持 medium"),
    ("supergrok_plus", "SuperGrok Plus", 100, "USD", "grok-4.7", supergrok_monthly_yi(100, 1, SUPERGROK47_WEEKLY_TOKENS), "medium", f"面板周额度$100×Super 4.7实测标定×{MONTH_WEEKS:g}周", f"26.9→{supergrok_monthly_yi(100, 1, SUPERGROK47_WEEKLY_TOKENS):g}亿：{SUPERGROK47_WEEKLY_TOKENS:,}×{MONTH_WEEKS:g}周×100/25，非独立实测"),
    ("supergrok_heavy", "SuperGrok Heavy", 300, "USD", "grok-4.7", supergrok_monthly_yi(250, 1, SUPERGROK47_WEEKLY_TOKENS), "medium", f"面板周额度$250×Super 4.7实测标定×{MONTH_WEEKS:g}周", f"67.2→{supergrok_monthly_yi(250, 1, SUPERGROK47_WEEKLY_TOKENS):g}亿：{SUPERGROK47_WEEKLY_TOKENS:,}×{MONTH_WEEKS:g}周×250/25，非独立实测；Lite 面板美元未知不派生"),
    # Cursor —— 两张个人Ultra截图均在2026-08-25永久扩池后；社区图可能因首周半价用量集中而使tokens/Usage%反推偏高。
    #   Fast取维护者当前平滑账号最大样本863.8M/28.1%=30.74亿；Standard取维护者67.78亿与社区86.95亿主行中间值77.37亿。
    #   Pro保留独立面板采用值；Pro+按$800/$3000池比，从round8标准77.37亿反推。
    ("cursor_ultra", "Cursor Ultra", 200, "USD", "grok-4.6", CURSOR_ULTRA_STANDARD_YI, "medium", "两张调整后个人Ultra标准主行中间值；cursor-adoption-round8-2026-09-06.json", "旧80亿→77.37亿：(维护者当前平滑账号61.0M/0.9%=67.78亿 + 社区8/26图1478.2M/17%=86.95亿)/2。社区图可能有大量首周半价用量，按费用百分比反推略高；中间值不是单行直接实测，token类型分布与面板取整差异保留；未折算：面板只给 token 合计与费用 %"),
    ("cursor_ultra_fast", "Cursor Ultra (Fast)", 200, "USD", "grok-4.6", CURSOR_ULTRA_FAST_YI, "high", "维护者当前平滑账号截图863.8M/28.1%直接反推；cursor-adoption-round8-2026-09-06.json", "旧40亿→30.74亿；取最大样本xhigh-fast行直接反推，百分比取整区间30.69~30.80亿；同图较小high-fast行24.43亿不采。Standard/Fast不强制raw token严格2×，因为面板按费用扣减且token类型构成不同；官方三段费率2×事实不变；与SuperGrok渠道分开；未折算：面板只给 token 合计与费用 %"),
    ("cursor_pro", "Cursor Pro", 20, "USD", "grok-4.6", 4.7, "medium", "Cursor 论坛面板：303.9M = 65% → 4.68 亿；另有维护者口述 4~5 亿打满", "保留独立面板采用4.7亿，不随Ultra中间值联动；池按compute cost计非raw token；未折算：面板只给 token 合计与费用 %"),
    ("cursor_pro_plus", "Cursor Pro+", 60, "USD", "grok-4.6", CURSOR_ULTRA_STANDARD_YI * 800 / 3000, "medium", "round3面板Pro+池约$800；按Ultra池$3000等比；cursor-adoption-round8-2026-09-06.json", "旧21.33亿→20.63亿：77.37×800/3000；继承跨档池规模假设，非独立实测；未采社区图反推$4500~4800作为官方池；促销与账号差异保留"),
    # Kimi —— 月池是周池的5倍（不是项目通用4周）；199档本机ccusage反推，其余按官网1x/4x/20x/60x
    #   同名档国内外并点：price_usd 统一按国际版标价（KIMI_INTL），¥价为国内实付；Andante ¥49 无海外同名档
    ("kimi_allegretto_cn", "Kimi 会员 199", 199, "CNY", "kimi-k3", kimi_199_monthly_yi(), "medium", f"本机ccusage {KIMI_199_USED_TOKENS}/{KIMI_199_USED_FRACTION:.0%}反推周额度×Kimi月池{KIMI_MONTHLY_TO_WEEKLY:g}倍；kimi-adoption-round6-2026-09-08.json", "旧11.61亿→14.51亿：确认Kimi月池=周池×5，旧值误套项目通用4周；样本以k3-256k为主且含kimi-for-coding，非纯K3 1M实测；SWE1.7短时面板的模型/统计窗口不同，未替换基准；ACP14.28为旧模型旁证，不直接采用；未折算：ccusage 只存周合计，无分项"),
    ("kimi_moderato_cn", "Kimi 会员 99", 99, "CNY", "kimi-k3", round(kimi_199_monthly_yi() * 4 / 20, 2), "medium", "199档×官方4/20；kimi-adoption-round6-2026-09-08.json", "旧2.32亿→2.90亿：随199档改用周池×5；继承K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    ("kimi_andante_cn", "Kimi 会员 49", 49, "CNY", "kimi-k3", round(kimi_199_monthly_yi() / 20, 2), "medium", "199档×官方1/20", ""),
    ("kimi_allegro_cn", "Kimi 会员 699", 699, "CNY", "kimi-k3", round(kimi_199_monthly_yi() * 60 / 20, 2), "medium", "199档×官方60/20；kimi-adoption-round6-2026-09-08.json", "旧34.83亿→43.53亿：随199档改用周池×5；继承K3-256K为主的混合负载估算，不是K3 1M纯模型实测"),
    # K2.7 Standard —— ¥199纯模型面板直接按月百分比反推；其余档按官方Code credits 1x/4x/20x/60x
    ("kimi_allegretto_cn", "Kimi 会员 199", 199, "CNY", "kimi-k2.7-code", kimi_k27_199_monthly_yi(), "medium", f"V2EX纯K2.7面板 {KIMI_K27_199_USED_TOKENS}/{KIMI_K27_199_MONTHLY_USED_FRACTION:.2%}=15.68亿；kimi-k27-round7-2026-09-08.json；kimi-k27-adoption-round8-2026-09-08.json", "新增K2.7 Standard独立点：采用直接月%反推15.68亿，不与较弱的699档混合样本取中点；可信范围约15.6~16.7亿。单一纯模型账号证据high，但跨账号/时期采用降为medium；未折算：只有 cache 读＋合计，缺 input/output 分项"),
    ("kimi_moderato_cn", "Kimi 会员 99", 99, "CNY", "kimi-k2.7-code", round(kimi_k27_199_monthly_yi() * 4 / 20, 2), "medium", "199档×官方4/20；kimi-k27-adoption-round8-2026-09-08.json", "新增3.14亿：继承199档15.68亿与官方Code credits倍率；非独立实测"),
    ("kimi_andante_cn", "Kimi 会员 49", 49, "CNY", "kimi-k2.7-code", round(kimi_k27_199_monthly_yi() / 20, 2), "medium", "199档×官方1/20；K2.7 Standard所有会员可用；kimi-k27-adoption-round8-2026-09-08.json", "新增0.78亿：继承199档15.68亿与官方Code credits倍率；非独立实测。该档仅排除K3，不排除K2.7 Standard"),
    ("kimi_allegro_cn", "Kimi 会员 699", 699, "CNY", "kimi-k2.7-code", round(kimi_k27_199_monthly_yi() * 60 / 20, 2), "medium", "199档×官方60/20；kimi-k27-adoption-round8-2026-09-08.json", "新增47.04亿：继承199档15.68亿与官方Code credits倍率；独立699档K2.7占主导混合大样本缩回199档约16.74亿，仅作范围旁证"),
    # Kimi 海外 —— 不单画：官方 Code credits 倍率 1×/5×/15×/30× 与国内 1/4/20/60× 体系不同，且无绝对 token 证据；
    #   同名档按 KIMI_INTL 并入国内点、按国际版美元标价展示，仅海外档（Vivace $199）仍不画
    # 智谱 —— 官方周积分与三段积分系数按项目统一标准负载换算；忙时与闲时分开按月展示。
    *glm_rows(),
    # MiniMax —— 官方绝对月 token：国内 M3 发布文 + 2026-08 迁移说明；海外 M3 发布文（当时 $20/$50/$120，现价 $22/$55/$132）
    ("minimax_token_plus_cn", "MiniMax Token Plan Plus", 49, "CNY", "minimax-m3", 6.0, "high", "minimaxi.com/blog/minimax-m3 官方", "未折算：官方绝对 token 表，不套负载"),
    ("minimax_token_max_cn", "MiniMax Token Plan Max", 119, "CNY", "minimax-m3", 18.0, "high", "minimaxi.com/blog/minimax-m3 官方", "未折算：官方绝对 token 表，不套负载"),
    ("minimax_token_ultra_cn", "MiniMax Token Plan Ultra", 469, "CNY", "minimax-m3", 71.0, "high", "platform.minimaxi.com 迁移说明 2026-08-19", "发布时 55 亿，迁移后 71 亿；未折算：官方绝对 token 表，不套负载"),
    ("minimax_token_plus_global", "MiniMax Token Plan Plus (Global)", 22, "USD", "minimax-m3", 17.0, "high", "minimax.io/blog/minimax-m3 官方", "发布时 $20，现价 $22，额度未见调整；未折算：官方绝对 token 表，不套负载"),
    ("minimax_token_max_global", "MiniMax Token Plan Max (Global)", 55, "USD", "minimax-m3", 51.0, "high", "minimax.io/blog/minimax-m3 官方", "发布时 $50；未折算：官方绝对 token 表，不套负载"),
    ("minimax_token_ultra_global", "MiniMax Token Plan Ultra (Global)", 132, "USD", "minimax-m3", 98.0, "high", "minimax.io/blog/minimax-m3 官方", "发布时 $120；未折算：官方绝对 token 表，不套负载"),
    # 阿里 —— 《财经》2026-08 用 OpenCode 跑满周额度实测：阿里云套餐旗舰模型 ¥101/亿 → ¥200 ÷ 101 ≈ 1.98 亿/月。SubPlan 的 30 亿无实测依据，作废
    ("aliyun_coding_pro_cn", "阿里云百炼 Coding Plan Pro", 200, "CNY", "qwen3.7-plus", 1.98, "medium", "《财经》2026-08 实测 ¥101/亿", "档位未写明，按 ¥200 Pro 折算；旧值 30 亿作废；未折算：《财经》¥101/亿 无分项"),
    ("aliyun_coding_pro_global", "Alibaba Cloud Coding Plan Pro", 50, "USD", "qwen3.7-plus", 1.98, "low", "同 CN 档额度", "未折算：CN 档同源（《财经》¥101/亿），无分项"),
    # OpenCode Go —— 官网全量模型；美元额度 × 项目统一标准负载，旧请求估算仅作旁证。
    *opencode_go_rows(),
    # Command Code GOAT —— 官网每模型 allowance + 三段价；effective=min($70, allowance)；不含 Muse Code（仅5h请求窗）。
    *command_code_goat_rows(),
    # Ollama Cloud Pro/Max —— 官方 credits × 官方价表；DeepSeek 用 off-peak。
    *ollama_rows("ollama_pro", "Ollama Pro", 20, OLLAMA_PRO_CREDITS_USD),
    *ollama_rows("ollama_max", "Ollama Max", 100, OLLAMA_MAX_CREDITS_USD),
    # 阶跃 Step Plan 国内站 —— 官方 Credit 月池 × 人民币三段价；国际站月费不同、不另画。
    *stepfun_rows(),
    # 小米 MiMo Token Plan —— Credits 月池 × 分模型 burn 率；日/夜两情景点。
    *mimo_rows(),
]

# ---- 不计额度（unmetered）订阅点：月费 ÷ 无界可用量 → $0/MTok。无 token 分母，图上用专用刻度位，不进对数换算。
#   元组：(id, name, price, cur, model, conf, src, note)。促销口径，促销结束必须复核；见 conventions.promotions。
SWE2_PROMO = CONVENTIONS["promotions"]["devin_swe2"]
UNMETERED = [
    ("devin_pro", f"Devin Pro (促销至 {SWE2_PROMO['endDate'][5:].replace('-', '/')})", 20, "USD", "swe-2", "medium",
     "官推2026-09-10：SWE-2 free for all Pro, Max & Teams subscribers for the next month；维护者面板同段swe-2 45.5M tokens不计额度；docs.devin.ai/admin/billing/usage 无并发上限；devin-swe2-round1-2026-09-12.json",
     f"新增≈$0/MTok（记0）：SWE-2 促销期对 Pro/Max/Teams 不占额度、不计费，无并发上限→分母无界；裁定按促销价进前沿并改变前沿，截止 {SWE2_PROMO['endDate']}（裁定；官推仅写 for the next month）；取最便宜可得档 Pro $20，Max 同 Y 更贵不重复画；促销结束后必须复核计费权重，定价页永久免费口径为 SWE 1.7 不是 SWE-2"),
]

# ---- 同一套餐内推更多模型：(基准 plan_id, 基准模型, 新模型, token 倍率, 置信度, 依据, 是否进精选图)
#   倍率 = 基准模型混合标价 / 新模型混合标价（订阅按 compute cost / credits 计量时成立）；Anthropic Fable 用 Reddit 实测订阅内权重
RATIO_COMPOSER = blended(0.5, 2, 6) / blended(0.2, 0.5, 2.5)   # Grok 4.6 → Composer 2.5 Standard ≈ 2.57110
RATIO_COMPOSER_FAST = blended(0.5, 2, 6) / blended(0.5, 3, 15)
RATIO_SONNET = round(blended(0.5, 5, 25) / blended(0.2, 2, 10), 2)       # Opus → Sonnet 5 = 2.5
# Factory Droid 官方模型倍率（docs.factory.ai/docs/models，2026-09-29）：Standard Usage 按 list-worth × 倍率计，
#   Opus 5.5 = 1.6×；同池其他模型 = Opus 5.5 采用值 × 1.6 / 倍率。† 为促销倍率，见 DROID_PROMO_MULTIPLIERS。
DROID_OPUS55_MULTIPLIER = 1.6
DROID_MULTIPLIERS = {
    "claude-fable-5.1": 4, "claude-fable-5": 4, "claude-opus-5": 2, "claude-opus-4.8": 2, "claude-sonnet-5.5": 0.8,
    "gpt-6-astra": 4, "gpt-6-sol": 0.8, "gpt-6-luna": 0.04,
    "gpt-5.6-sol": 1.6, "gpt-5.6-terra": 0.8, "gpt-5.6-luna": 0.08,
    "gemini-3.8-flash": 0.3, "gemini-3.7-flash": 0.3, "grok-4.7": 0.8, "grok-4.6": 0.8,
    "inkling": 0.4, "mistral-medium-3.5": 0.6, "glm-5.3-flash": 0.06, "glm-5.3": 0.56, "glm-5.2": 0.56,
    "glm-5.2-fast": 0.84, "kimi-k3": 1.2, "qwen3.8-max": 0.8, "nemotron-3-ultra": 0.24,
    "deepseek-v4.1-flash": 0.12, "minimax-m3": 0.12,
}
DROID_PROMO_MULTIPLIERS = {"gpt-5.6-sol": ("2026-11-22", 2), "gemini-3.8-flash": ("2027-01-01", 0.6),
                           "gemini-3.7-flash": ("2027-01-01", 0.6)}
DROID_CORE_MODELS = {"inkling", "mistral-medium-3.5", "glm-5.3-flash", "glm-5.3", "glm-5.2", "glm-5.2-fast", "kimi-k3",
                     "qwen3.8-max", "nemotron-3-ultra", "deepseek-v4.1-flash", "minimax-m3"}


def droid_derived_note(model: str) -> str:
    m = DROID_MULTIPLIERS[model]
    note = (f"Factory官方倍率 Opus 5.5 {DROID_OPUS55_MULTIPLIER:g}× / {model} {m:g}×：同一 Standard Usage 池按倍率折算，"
            f"非该模型实测；沿用 Opus 5.5 行 Anthropic 档负载，未按各模型自身价差重算；docs.factory.ai/docs/models；"
            "droid-model-multipliers-2026-09-29.json")
    promo = DROID_PROMO_MULTIPLIERS.get(model)
    if promo:
        note += f"；{m:g}×为促销倍率，{promo[0]}后恢复{promo[1]:g}×（届时约{DROID_OPUS55_MULTIPLIER / promo[1]:g}×Opus），到期须复核"
    if model in DROID_CORE_MODELS:
        note += "；Droid Core 模型先扣 Standard Usage，用尽后另有免费开源池（独立限额未实测），本值只计 Standard Usage 部分"
    return note


DERIVED = [
    # OpenAI：Terra/5.5仍按三段credits与项目统一标准负载从Sol换算；Luna已有独立实测，不再从Sol派生
    *[(pid, "gpt-5.6-sol", model, blended(10, 100, 500) / blended(*rates), "medium",
       f"https://learn.chatgpt.com/docs/pricing 三段credits（cache/input/output）Sol=10/100/500，对比{rates}；旧倍率{old_ratio}、旧月额度{sol_yi * old_ratio:g}亿作废；保留Sol基准，按项目统一标准负载重算；见audit-round4-2026-09-05.json",
       pid != "chatgpt_pro_5x" and model != "gpt-5.6-terra")
      for pid, sol_yi in (("chatgpt_plus", 6.16), ("chatgpt_pro_5x", 30.8), ("chatgpt_pro_20x", CHATGPT_PRO20X_SOL_MONTHLY_YI))
      for model, rates, old_ratio in (("gpt-5.6-terra", (5, 50, 300), 2),
                                      ("gpt-5.5", (12.5, 125, 750), 0.8))],
    # Anthropic：Sonnet 5 标价 = Opus 的 0.4 → ×2.5；Opus 4.8 与 Opus 5 同价 → ×1；Fable 订阅内权重统一 6.5×（Reddit x5 档 4.25 系 typed meter 软读数、与确认 2× 周池比矛盾，不采），且最多占周额度 50%
    ("claude_pro", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "medium", "69.05→64.725亿：基准随 Opus5 折算 27.62→25.89 ×标价比2.5，非Sonnet实测（更早链 39.7→46.95→69.05 为 raw 口径）；community-issues-round1-2026-09-29.json；workload-conversion-round1-2026-09-30.json", True),
    ("claude_pro", "claude-opus-5", "claude-opus-4.8", 1.0, "low", "与Opus5同价同池，27.62→25.89亿随 Opus5 折算基准派生（更早18.78为round8面板、27.62为#53 raw）；历史实测15.88亿留作round5前证据不覆盖；community-issues-round1-2026-09-29.json、claude-adoption-round8-2026-09-20.json；workload-conversion-round1-2026-09-30.json", False),
    ("claude_max_20x", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "medium", "旧200亿→392.5亿，low→medium；157×Opus/Sonnet标价比2.5，9/14永久口径派生，非Sonnet实测；claude-adoption-round6-2026-09-06.json", True),
    ("claude_max_20x", "claude-opus-5", "claude-opus-4.8", 1.0, "low", "旧80亿→157亿；与Opus5同价，9/14永久基准派生；claude-adoption-round6-2026-09-06.json", False),
    ("claude_max_20x", "claude-opus-5", "claude-fable-5", 0.5 / 6.5, "low", "旧6.152亿→12.077亿；157×0.5/6.5，不再预舍入倍率；订阅内6.5×权重且限周额度50%，9/14永久口径派生；claude-adoption-round6-2026-09-06.json", True),
    ("claude_max_5x", "claude-opus-5", "claude-sonnet-5", RATIO_SONNET, "low", "旧89亿→196.25亿；78.5×标价比2.5，9/14永久口径派生；claude-adoption-round6-2026-09-06.json", False),
    ("claude_max_5x", "claude-opus-5", "claude-fable-5", 0.5 / 4.25, "low", "维持9.235亿：x5档唯一实测权重4.25×（Reddit 1vx0k69，原帖自标typed meter偏软）；注意与确认2×池比矛盾——若20x=12.077亿成立则5x按池比应约6.04亿，但那需要无实测的统一权重假设，裁定按实测数据来；claude-adoption-round7-2026-09-14.json", False),
    # Fable 5.1：20x 已按 round3 同框样本挂 30.06亿（SUBS 直测行）；5x 借其隐含权重 2.61 派生，
    #   注意 Fable5 权重两档本就不同（6.5/4.25），跨档同权重只是假设 → low
    ("claude_max_5x", "claude-opus-5", "claude-fable-5.1", CLAUDE_FABLE_WEEKLY_CAP / CLAUDE_FABLE51_W, "low", f"15.03→{78.5*CLAUDE_FABLE_WEEKLY_CAP/CLAUDE_FABLE51_W:g}亿：78.5×0.5/{CLAUDE_FABLE51_W:.2f}——借20x同框样本隐含权重派生（round9 时间线校正后权重2.61→4.54），非独立实测；单权重跨档沿用仍属假设（Fable5 两档不同为前车之鉴）；claude-fable51-round3/round9", False),
    # Opus 5.5：20x 按 MiaAI 窗×5.5 窗/周与 Pro×10 加权 315.38亿、Pro 按 #52+Reddit 段 30.54亿（均 SUBS 行）；
    #   5x 按裁定的 20x=5x×2 周池关系由 20x 采用值 ÷2 派生（同 Opus 5 行 157÷2）——2026-09-27 裁定两档精确同价并为一点 → low（标价混合比法 152.64亿 差1.2% 留作备选口径）
    ("claude_max_5x", "claude-opus-5", "claude-opus-5.5", CLAUDE_OPUS55_MAX20X_MONTHLY_YI / CLAUDE_MAX_20X_YI, "low", f"由20x采用值{CLAUDE_OPUS55_MAX20X_MONTHLY_YI:g}亿÷{CLAUDE_WEEKLY_20X_TO_5X}派生（确认20x周池=5x的2倍，同Opus 5行157÷2；2026-09-30 起 20x 为 MiaAI 窗×5.5 窗/周与 Pro×10 加权，旧 20x 301.7 → 本行 150.85）；旧值78.5×1/W=150.852亿与20x/2的差仅来自301.7取整，2026-09-27裁定合为同一点；标价法152.64亿差1.2%；claude-opus55-round1-2026-09-23.json", False),
    # Astra Pro5x：沿用 Sol 档间 4× 关系由 20x 采用值派生；prolite 同框 2.31亿/周≈9.2亿/月量级接近（多代理高负载偏大，不直接采）
    ("chatgpt_pro_5x", "gpt-5.6-sol", "gpt-6-astra", CHATGPT_PRO20X_ASTRA_MONTHLY_YI / CHATGPT_PRO20X_SOL_MONTHLY_YI, "low", f"{CHATGPT_PRO20X_ASTRA_MONTHLY_YI/4:g}→{30.8*CHATGPT_PRO20X_ASTRA_MONTHLY_YI/CHATGPT_PRO20X_SOL_MONTHLY_YI:g}亿：{CHATGPT_PRO20X_ASTRA_MONTHLY_YI:g}×30.8/{CHATGPT_PRO20X_SOL_MONTHLY_YI:g}（沿用Sol 20x→5x档间比例，基准随Sol 20x加权值联动{CHATGPT_PRO20X_SOL_MONTHLY_YI/30.8:.2f}×）；round12 codex#45085 prolite同框2.31亿/周≈9.2亿/月量级接近但为多代理Astra High放大样本，不直接采；chatgpt-astra-sameframe-round13-2026-09-20.json", False),
    # Pro 档 Fable 5/5.1 套餐内不可用（走 usage credits，官方 high），不挂点
    # Cursor：池按 compute cost 计（官方），Composer 2.5 标价 $0.5/$0.2/$2.5；Grok 4.5 与 4.6 同价
    ("cursor_ultra", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "medium", f"旧80亿基准→77.37亿×统一标准负载倍率{RATIO_COMPOSER:.6f}；随round8标准中间值联动，非Composer实测；见cursor-adoption-round8-2026-09-06.json", True),
    ("cursor_ultra", "grok-4.6", "grok-4.5", 1.0, "medium", "旧80亿→77.37亿，继承round8标准基准；Cursor官方models-and-pricing两模型同价，非Grok4.5独立实测；不采用xAI公开API缓存价差；见cursor-adoption-round8-2026-09-06.json", False),
    ("cursor_pro", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "medium", "Standard：官方Cursor三段价混合比；旧12.079亿用舍入倍率2.57，现保留完整精度", True),
    ("cursor_pro_plus", "grok-4.6", "composer-2.5", RATIO_COMPOSER, "low", f"旧21.33亿基准→20.63亿×统一标准负载倍率{RATIO_COMPOSER:.6f}；随round8的Ultra77.37×800/3000联动，保留跨档假设；见cursor-adoption-round8-2026-09-06.json", False),
    # xAI：订阅面板额度与公开API标价不同；4.5暂按同订阅4.6额度，非API同价断言
    ("supergrok_heavy", "grok-4.6", "grok-4.5", 1.0, "medium", "维持同订阅额度假设51.6亿（4.6折算基准随动），尚无4.5独立面板实测；xAI API缓存价差不能直接映射订阅周池；与Cursor渠道分开", False),
    ("supergrok", "grok-4.6", "grok-4.5", 1.0, "medium", "维持同订阅额度假设5.16亿（4.6折算基准随动），尚无4.5独立面板实测；xAI API缓存价差不能直接映射订阅周池；与Cursor渠道分开", False),
    # Factory Droid：按官方模型倍率由 Opus 5.5 实测折算（2026-09-29 裁定，全部 medium）
    *[("droid_max", "claude-opus-5.5", model, DROID_OPUS55_MULTIPLIER / m, "medium", droid_derived_note(model), False)
      for model, m in DROID_MULTIPLIERS.items()],
    # MiniMax：M2.7 与 M3 同价，同一额度
    ("minimax_token_plus_cn", "minimax-m3", "minimax-m2.7", 1.0, "medium", "与 M3 同价；未折算：官方绝对 token 表，不套负载", False),
    ("minimax_token_plus_global", "minimax-m3", "minimax-m2.7", 1.0, "medium", "与 M3 同价；未折算：官方绝对 token 表，不套负载", False),
]

# ---- 按量 API 基线：(id, name, model, cached, input, output) USD/MTok；用项目统一标准负载折成混合价
METERED_NOTES = {
    "deepseek_v41_flash_offpeak": "旧0.00811（¥0.02/¥1/¥4÷6.7787）→0.00825；改用官方美元标价 cached/input/output=$0.003/$0.15/$0.60，套项目统一标准负载。不再用人民币÷项目汇率。api-docs.deepseek.com 2026-09-10；确认；list-prices-deepseek-v41-round2-2026-09-10.json。旧V4点按裁定不改。",
    "deepseek_v41_flash_peak": "旧0.01623（¥0.04/¥2/¥8÷6.7787）→0.01650；改用官方美元标价 cached/input/output=$0.006/$0.30/$1.20，套项目统一标准负载。高峰=闲时2倍。api-docs.deepseek.com 2026-09-10；确认；list-prices-deepseek-v41-round2-2026-09-10.json。旧V4点按裁定不改。",
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
    ("xai_grok47_api", "Grok 4.7 API (<200k)", "grok-4.7", 0.5, 2.0, 6.0, "docs.x.ai；2026-09-21发布与4.6同价；>200K档$1/$4/$12保留在research"),
    ("mimo_v26_pro_api", "MiMo V2.6 Pro API", "mimo-v2.6-pro", 0.0036, 0.435, 0.87, "OpenRouter/GOAT/OpenCode三渠道一致价；小米官方计价页未列V2.6档；mimo-v26-grok47-catalogs-round1-2026-09-22.json"),
    ("mimo_v26_flash_api", "MiMo V2.6 Flash API", "mimo-v2.6-flash", 0.0028, 0.14, 0.28, "同上；mimo-v26-grok47-catalogs-round1-2026-09-22.json"),
    ("mimo_v26_pro_ultraspeed_api", "MiMo V2.6 Pro UltraSpeed API", "mimo-v2.6-pro-ultraspeed", 0.036, 4.35, 8.70, "速度档按Pro价10×（GOAT文档官方明示）；同上"),
    # 2026-09-06 补齐 Claude 与 GPT-5.6 其余档的官方按量价，让 Claude / ChatGPT 订阅点在同榜有 API 基线可比
    ("anthropic_opus5_api", "Claude Opus 5 API", "claude-opus-5", 0.5, 5.0, 25.0, "platform.claude.com/docs/en/about-claude/pricing"),
    ("anthropic_sonnet5_api", "Claude Sonnet 5 API", "claude-sonnet-5", 0.2, 2.0, 10.0, "platform.claude.com/docs/en/about-claude/pricing"),
    ("anthropic_fable5_api", "Claude Fable 5 API", "claude-fable-5", 1.0, 10.0, 50.0, "platform.claude.com/docs/en/about-claude/pricing"),
    ("anthropic_fable51_api", "Claude Fable 5.1 API", "claude-fable-5.1", 0.25, 10.0, 50.0, "platform.claude.com/docs/en/about-claude/pricing；cache read $0.25=base input×0.025（其他模型0.1×），in/out 与 Fable 5 同价；claude-fable51-round1-2026-09-13.json"),
    ("anthropic_opus55_api", "Claude Opus 5.5 API", "claude-opus-5.5", 0.2, 4.0, 20.0, "platform.claude.com/docs/en/about-claude/pricing；cache read $0.20=base input×0.05（其他模型0.1×）、写 $5/5m $8/1h、Fast $8/$40；claude-opus55-round1-2026-09-23.json"),
    ("openai_terra_api", "GPT-5.6 Terra API", "gpt-5.6-terra", 0.2, 2.0, 12.0, "developers.openai.com"),
    ("openai_luna_api", "GPT-5.6 Luna API", "gpt-5.6-luna", 0.02, 0.2, 1.2, "developers.openai.com"),
]

# 精选图只画主流套餐 + 前沿相关点，避免 60 个点挤在一起；全量图画全部
MAIN_PLANS = {"chatgpt_plus", "chatgpt_pro_20x", "claude_pro", "claude_max_20x", "cursor_ultra", "cursor_ultra_fast", "cursor_pro",
              "google_ai_pro_us",
              "supergrok_heavy", "supergrok", "kimi_allegretto_cn", "glm_coding_pro_cn_new_peak", "glm_coding_pro_cn_new_mid", "glm_coding_pro_cn_new_offpeak", "glm_coding_pro_cn_old_peak", "glm_coding_pro_cn_old_mid", "glm_coding_pro_cn_old_offpeak",
              "minimax_token_plus_cn", "minimax_token_plus_global", "aliyun_coding_pro_cn", "devin_max", "devin_pro", "droid_max",
              "mimo_token_lite_day", "mimo_token_standard_day", "mimo_token_pro_day", "mimo_token_max_day",
              "mimo_token_lite_night", "mimo_token_standard_night", "mimo_token_pro_night", "mimo_token_max_night"}
MAIN_EXTRA = {
    ("opencode_go", "deepseek-v4.1-flash"),
    ("opencode_go", "glm-5.3-flash"),
    ("command_code_goat", "deepseek-v4.1-flash"),
}


def is_main(pid: str, model: str) -> bool:
    return (pid in MAIN_PLANS and model != "gpt-5.6-terra") or (pid, model) in MAIN_EXTRA


EXCLUDED_SUBSCRIPTIONS = {
    ("kimi_andante_cn", "kimi-k3"): "旧0.58亿为199档按4周×1/20推算；即使按Kimi周池×5修正为0.73亿，也因2026-09-05确认‘就是不能调用’而继续排除；官方https://www.kimi.com/code/docs/kimi-code/models限定Moderato及以上可调用K3；同档可用的K2.7 Standard已作为独立点纳入",
    ("command_code_goat", "jev"): "Jev 为 Command Code 决策模型（官网：Decision model · headless (cmd -p) and Provider API only, not in /model），32K 上下文，非编码 agent 可选模型；仅输入计费 $0.042、输出与缓存读免费，按标准负载会得 190.476 亿/月并扭曲额度总览，2026-10-01 裁定不收录"
}

# ---- 数据日期（网页详情面板显示）：该额度数据是哪一天的。格式 YYYY-MM-DD / YYYY-MM，区间用 "~"。
# sample=实测/社区样本的采样日期（多源加权取全部入权样本的起止）；
# official=官方页面/公告：有发布日的博文或公告取发布日，否则取项目核对该页的日期；
# derived=由锚点按倍率/档间比例派生，沿用锚点日期，data_date_from 记锚点。
DATA_DATES = {
    ("minimax_m_plan_go_cn", "minimax-m3.1-flash-preview"): ("2026-10-01", "sample"),
    ("chatgpt_plus", "gpt-5.6-sol"): ("2026-07-30", "sample"),
    ("chatgpt_pro_20x", "gpt-5.6-sol"): ("2026-06-10~2026-09-06", "sample"),
    ("chatgpt_plus", "gpt-5.6-luna"): ("2026-09-08", "sample"),
    ("chatgpt_plus", "gpt-6-astra"): ("2026-09-11", "sample"),
    ("chatgpt_plus", "gpt-6-sol"): ("2026-09-24", "sample"),
    ("chatgpt_plus", "gpt-6-luna"): ("2026-09-27~2026-09-28", "sample"),
    ("chatgpt_plus", "gpt-6.1-sol"): ("2026-09-30", "sample"),
    ("chatgpt_pro_20x", "gpt-6-astra"): ("2026-09-07~2026-09-21", "sample"),
    ("devin_max", "gpt-6-astra"): ("2026-09-14", "sample"),
    ("devin_max", "claude-opus-5.5"): ("2026-09-23", "sample"),
    ("droid_max", "claude-opus-5.5"): ("2026-09-29", "sample"),
    ("droid_pro", "claude-opus-5.5"): ("2026-09-28", "sample"),
    ("google_ai_pro_us", "gemini-3.8-flash"): ("2026-09-12~2026-09-27", "sample"),
    ("google_ai_pro_us", "gemini-3.6-flash"): ("2026-09-13~2026-09-27", "sample"),
    ("claude_pro", "claude-opus-5"): ("2026-09-14~2026-09-22", "sample"),
    ("claude_max_20x", "claude-opus-5"): ("2026-08", "sample"),
    ("claude_max_20x", "claude-fable-5.1"): ("2026-09-04~2026-09-05", "sample"),
    ("claude_max_20x", "claude-opus-5.5"): ("2026-09-22~2026-09-27", "sample"),
    ("claude_pro", "claude-opus-5.5"): ("2026-09-22~2026-09-27", "sample"),
    ("supergrok", "grok-4.6"): ("2026-08-23~2026-09-20", "sample"),
    ("supergrok_lite", "grok-4.6"): ("2026-07", "sample"),
    ("supergrok", "grok-4.7"): ("2026-09-22", "sample"),
    ("cursor_ultra", "grok-4.6"): ("2026-08-26~2026-09-05", "sample"),
    ("cursor_ultra_fast", "grok-4.6"): ("2026-09-05", "sample"),
    ("cursor_pro", "grok-4.6"): ("2026-08-27", "sample"),
    ("kimi_allegretto_cn", "kimi-k3"): ("2026-07-25~2026-07-26", "sample"),
    ("kimi_allegretto_cn", "kimi-k2.7-code"): ("2026-08-20", "sample"),
    ("aliyun_coding_pro_cn", "qwen3.7-plus"): ("2026-07~2026-08", "sample"),
    ("minimax_token_plus_cn", "minimax-m3"): ("2026-06-01", "official"),
    ("minimax_token_max_cn", "minimax-m3"): ("2026-06-01", "official"),
    ("minimax_token_ultra_cn", "minimax-m3"): ("2026-08-19", "official"),
    ("minimax_token_plus_global", "minimax-m3"): ("2026-06-01", "official"),
    ("minimax_token_max_global", "minimax-m3"): ("2026-06-01", "official"),
    ("minimax_token_ultra_global", "minimax-m3"): ("2026-06-01", "official"),
    ("devin_pro", "swe-2"): ("2026-09-10", "official"),
    # 按量 API 标价
    ("deepseek_v41_flash_offpeak", "deepseek-v4.1-flash"): ("2026-09-10", "official"),
    ("deepseek_v41_flash_peak", "deepseek-v4.1-flash"): ("2026-09-10", "official"),
    ("deepseek_v4_flash_offpeak", "deepseek-v4-flash"): ("2026-09-05", "official"),
    ("deepseek_v4_flash_peak", "deepseek-v4-flash"): ("2026-09-05", "official"),
    ("deepseek_v4_pro_offpeak", "deepseek-v4-pro"): ("2026-09-05", "official"),
    ("deepseek_v4_pro_peak", "deepseek-v4-pro"): ("2026-09-05", "official"),
    ("openai_sol_api", "gpt-5.6-sol"): ("2026-09-05", "official"),
    ("openai_terra_api", "gpt-5.6-terra"): ("2026-09-05", "official"),
    ("openai_luna_api", "gpt-5.6-luna"): ("2026-09-05", "official"),
    ("xai_grok46_api", "grok-4.6"): ("2026-09-05", "official"),
    ("xai_grok47_api", "grok-4.7"): ("2026-09-22", "official"),
    ("mimo_v26_pro_api", "mimo-v2.6-pro"): ("2026-09-22", "official"),
    ("mimo_v26_flash_api", "mimo-v2.6-flash"): ("2026-09-22", "official"),
    ("mimo_v26_pro_ultraspeed_api", "mimo-v2.6-pro-ultraspeed"): ("2026-09-22", "official"),
    ("anthropic_opus5_api", "claude-opus-5"): ("2026-09-05", "official"),
    ("anthropic_sonnet5_api", "claude-sonnet-5"): ("2026-09-05", "official"),
    ("anthropic_fable5_api", "claude-fable-5"): ("2026-09-05", "official"),
    ("anthropic_fable51_api", "claude-fable-5.1"): ("2026-09-13", "official"),
    ("anthropic_opus55_api", "claude-opus-5.5"): ("2026-09-23", "official"),
    # 派生行里锚点不止一个、不能简单沿用 DERIVED 基准行的，显式给日期与锚点
    ("chatgpt_pro_5x", "gpt-6-astra"): ("2026-07-30~2026-09-21", "derived",
                                        "ChatGPT Plus · gpt-5.6-sol；ChatGPT Pro 20x · gpt-6-astra、gpt-5.6-sol"),
    ("claude_max_5x", "claude-opus-5.5"): ("2026-09-22~2026-09-27", "derived", "Claude Max 20x (9/14+) · claude-opus-5.5"),
    ("claude_max_5x", "claude-fable-5.1"): ("2026-08~2026-09-05", "derived",
                                           "Claude Max 20x (9/14+) · claude-opus-5、claude-fable-5.1"),
}
# SUBS 里按官方倍率/档间比例派生的行：沿用锚点日期
DATA_DATE_INHERIT = {
    ("minimax_m_plan_go_cn_annual", "minimax-m3.1-flash-preview"): ("minimax_m_plan_go_cn", "minimax-m3.1-flash-preview"),
    ("minimax_m_plan_explore_cn", "minimax-m3.1-flash-preview"): ("minimax_m_plan_go_cn", "minimax-m3.1-flash-preview"),
    ("minimax_m_plan_explore_cn_annual", "minimax-m3.1-flash-preview"): ("minimax_m_plan_go_cn", "minimax-m3.1-flash-preview"),
    ("minimax_m_plan_build_cn", "minimax-m3.1-flash-preview"): ("minimax_m_plan_go_cn", "minimax-m3.1-flash-preview"),
    ("minimax_m_plan_build_cn_annual", "minimax-m3.1-flash-preview"): ("minimax_m_plan_go_cn", "minimax-m3.1-flash-preview"),
    ("chatgpt_pro_5x", "gpt-5.6-sol"): ("chatgpt_plus", "gpt-5.6-sol"),
    ("chatgpt_pro_5x", "gpt-5.6-luna"): ("chatgpt_plus", "gpt-5.6-luna"),
    ("chatgpt_pro_20x", "gpt-5.6-luna"): ("chatgpt_plus", "gpt-5.6-luna"),
    ("supergrok_plus", "grok-4.6"): ("supergrok", "grok-4.6"),
    ("supergrok_heavy", "grok-4.6"): ("supergrok", "grok-4.6"),
    ("supergrok_plus", "grok-4.7"): ("supergrok", "grok-4.7"),
    ("supergrok_heavy", "grok-4.7"): ("supergrok", "grok-4.7"),
    ("google_ai_ultra_5x_us", "gemini-3.8-flash"): ("google_ai_pro_us", "gemini-3.8-flash"),
    ("google_ai_ultra_20x_us", "gemini-3.8-flash"): ("google_ai_pro_us", "gemini-3.8-flash"),
    ("claude_max_5x", "claude-opus-5"): ("claude_max_20x", "claude-opus-5"),
    ("cursor_pro_plus", "grok-4.6"): ("cursor_ultra", "grok-4.6"),
    ("kimi_moderato_cn", "kimi-k3"): ("kimi_allegretto_cn", "kimi-k3"),
    ("kimi_allegro_cn", "kimi-k3"): ("kimi_allegretto_cn", "kimi-k3"),
    ("kimi_moderato_cn", "kimi-k2.7-code"): ("kimi_allegretto_cn", "kimi-k2.7-code"),
    ("kimi_andante_cn", "kimi-k2.7-code"): ("kimi_allegretto_cn", "kimi-k2.7-code"),
    ("kimi_allegro_cn", "kimi-k2.7-code"): ("kimi_allegretto_cn", "kimi-k2.7-code"),
    ("aliyun_coding_pro_global", "qwen3.7-plus"): ("aliyun_coding_pro_cn", "qwen3.7-plus"),
}


def family_data_date(pid: str, model: str) -> str | None:
    """官方价表族（每模型行共用一次核对）：返回核对日期；不属于这些族返回 None。"""
    if pid.startswith("glm_coding_"):
        return "2026-09-03"
    if pid.startswith("mimo_token_"):
        return "2026-09-22"
    if pid.startswith("stepfun_"):
        return "2026-09-21" if model == "step-5-preview" else "2026-09-10"
    if pid in ("ollama_pro", "ollama_max"):
        return "2026-09-11" if model == "deepseek-v4.1-flash" else "2026-09-06"
    if pid == "opencode_go":
        return "2026-09-30"
    if pid == "command_code_goat":
        return "2026-09-30"
    return None


FIELDS = ["plan_id", "plan_name", "plan_name_en", "billing", "price", "currency", "price_usd", "served_model",
          "monthly_tokens", "monthly_yi", "real_usd_per_mtok", "unmetered", "promo_until", "confidence", "chart_tier", "source", "decision_note",
          "plan_gen", "workload", "data_date", "data_date_kind", "data_date_from"]


def plan_gen_of(pid: str) -> str:
    # 套餐代际标注（2026-09-22 裁定）：GLM Coding 老客档=v2、新客档=v3（与 plot_quotas plan_name 映射一致）；
    # Kimi 音乐名会员档=v1（新套餐 Plus/Pro/Max 未入库，届时为当前代不标）。其余套餐为当前代不标。
    if pid.startswith("glm_coding_"):
        return "v2" if "_old_" in pid else "v3"
    if pid.startswith("kimi_"):
        return "v1"
    return ""


def workload_of(pid: str, billing: str, model: str = "") -> str:
    # 额度口径分类（详情面板用）：standard=美元/积分池÷standardTokenMix 混合价；
    # anthropic=÷anthropicTokenMix（Anthropic 按量 API、claude_pro 全部行，及经 2026-09-24/09-25 裁定
    # 按 Anthropic 档折算的 devin_max::claude-opus-5.5、由其按倍率折算的 droid_ 行）；
    # lowCache=÷lowCacheTokenMix（Step 全系、Google）；measured=缺 token 分项的 raw 直测样本、
    # 多源加权样本与官方绝对 token 表——2026-09-30 裁定带分项实测统一折算后，measured 仅余未折算行。
    if billing == "metered":
        return "anthropic" if model in ANTHROPIC_CACHE_WRITE_5M else "standard"
    if pid == "claude_pro" or (pid, model) == ("devin_max", "claude-opus-5.5") or pid.startswith("droid_") \
            or (pid in ("claude_max_20x", "claude_max_5x") and model == "claude-opus-5.5"):
        return "anthropic"
    if pid.startswith(("google_", "stepfun_")):
        return "lowCache"
    if pid in ("supergrok", "supergrok_plus", "supergrok_heavy"):
        return "standard"
    if (pid, model) == ("devin_max", "gpt-6-astra"):
        return "standard"
    if (pid == "chatgpt_plus" and model in ("gpt-6-sol", "gpt-6-luna", "gpt-6.1-sol", "gpt-5.6-luna")) \
            or (pid in ("chatgpt_pro_5x", "chatgpt_pro_20x") and model == "gpt-5.6-luna"):
        return "standard"
    if pid.startswith(("opencode_", "command_code_", "ollama_", "glm_coding_", "mimo_token_")):
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
                monthly_yi=monthly_yi, real_usd_per_mtok=sig(price_usd / tokens * 1e6), unmetered="", promo_until="",
                confidence=conf, chart_tier=tier or ("main" if is_main(pid, model) else "full"), source=src, decision_note=note,
                plan_gen=plan_gen_of(pid), workload=workload_of(pid, "subscription", model))


def sig(value: float, digits: int = 8) -> float:
    """真实单价存 8 位有效数字（原先固定 5 位小数，极低单价只剩 1~2 位有效数字，排序会并列或颠倒）。
    展示时各视图自行取短格式，详情显示完整值。"""
    return float(f"{value:.{digits}g}")


def unmetered_row(pid, name, price, cur, model, conf, src, note) -> dict:
    return dict(plan_id=pid, plan_name=name, plan_name_en="", billing="subscription", price=price, currency=cur,
                price_usd=round(price / USD_PER_CNY if cur == "CNY" else price, 2), served_model=model,
                monthly_tokens="", monthly_yi="", real_usd_per_mtok=0, unmetered="true", promo_until=SWE2_PROMO["endDate"],
                confidence=conf, chart_tier="main" if is_main(pid, model) else "full", source=src, decision_note=note)


def main() -> None:
    from minimax_m31_rows import subscription_specs as minimax_m31_specs
    rows = [sub_row(*s) for s in SUBS if (s[0], s[4]) not in EXCLUDED_SUBSCRIPTIONS]
    rows.extend(sub_row(*s) for s in minimax_m31_specs(CONVENTIONS))
    base = {(r["plan_id"], r["served_model"]): r for r in rows}
    derived_base = {}  # (派生行 plan_id, served_model) -> (锚点 plan_id, served_model)，数据日期沿用锚点
    for pid, bmodel, model, ratio, conf, how, main_ in DERIVED:
        b = base[(pid, bmodel)]
        rows.append(sub_row(pid, b["plan_name"], b["price"], b["currency"], model, b["monthly_yi"] * ratio, conf,
                            f"由同套餐 {bmodel} {b['monthly_yi']} 亿 × {ratio}", how, "main" if main_ and is_main(pid, bmodel) else "full"))
        derived_base[(pid, model)] = (pid, bmodel)
    for pid in ("cursor_ultra", "cursor_pro", "cursor_pro_plus"):
        b = base[(pid, "grok-4.6")]
        rows.append(sub_row(
            pid + "_composer_fast", b["plan_name"] + " (Composer Fast)", b["price"], b["currency"],
            "composer-2.5", b["monthly_yi"] * RATIO_COMPOSER_FAST,
            "low" if pid == "cursor_pro_plus" else "medium",
            "https://cursor.com/docs/models/cursor-composer-2-5；audit-round4-2026-09-05.json",
            f"新增Fast（产品默认）估算：缓存/输入/输出=0.5/3/15；扣费为Standard的{RATIO_COMPOSER / RATIO_COMPOSER_FAST:.4f}×；"
            f"沿用同套餐Grok标准基准{b['monthly_yi']}亿×{RATIO_COMPOSER_FAST:.8f}，不是实测；Grok Fast采用维护者当前账号独立反推30.74亿，不套到Composer"
            + (f"；round8随标准基准联动，旧Composer Fast额度{dict(cursor_ultra=72.937, cursor_pro_plus=19.45)[pid]}亿，促销/跨档混杂未剥离；见cursor-adoption-round8-2026-09-06.json"
               if pid in ("cursor_ultra", "cursor_pro_plus") else ""),
            b["chart_tier"],
        ))
        derived_base[(pid + "_composer_fast", "composer-2.5")] = (pid, "grok-4.6")
    rows += [unmetered_row(*u) for u in UNMETERED]
    for pid, name, model, cached, inp, out, src in METERED:
        write5m = ANTHROPIC_CACHE_WRITE_5M.get(model)
        if write5m is not None:
            mix_price = blended_anthropic(cached, write5m, out)
            default_note = (f"标价 cached {cached}/in {inp}/out {out}、缓存写(5m) ${write5m:g} × Anthropic 统一负载 "
                            f"{ANTHROPIC_MIX['cache']:.1%}/{ANTHROPIC_MIX['cacheWrite']:.2%}/{ANTHROPIC_MIX['output']:.2%}"
                            "（普通输入份额按5分钟缓存写入价计）")
        else:
            mix_price = blended(cached, inp, out)
            default_note = f"标价 cached {cached}/in {inp}/out {out} × 项目统一标准负载 {STANDARD_MIX['cache']:.1%}/{STANDARD_MIX['input']:.2%}/{STANDARD_MIX['output']:.2%}"
        rows.append(dict(plan_id=pid, plan_name=name, plan_name_en="", billing="metered", price="", currency="USD", price_usd="",
                         served_model=model, monthly_tokens="", monthly_yi="", real_usd_per_mtok=sig(mix_price),
                         unmetered="", promo_until="", confidence="high", chart_tier="main", source=src,
                         decision_note=METERED_NOTES.get(pid, default_note),
                         plan_gen=plan_gen_of(pid), workload=workload_of(pid, "metered", model)))

    # ---- 数据日期解析：DATA_DATES 直给 → family_data_date 官方族 → DATA_DATE_INHERIT → DERIVED/composer_fast 沿用锚点
    row_by_key = {(r["plan_id"], r["served_model"]): r for r in rows}
    for k in DATA_DATES:
        assert k in row_by_key, f"DATA_DATES 键无对应行: {k}"
    for k, b in DATA_DATE_INHERIT.items():
        assert k in row_by_key, f"DATA_DATE_INHERIT 键无对应行: {k}"
        assert b in row_by_key, f"DATA_DATE_INHERIT 锚点无对应行: {k} -> {b}"
    resolved = {}  # (plan_id, served_model) -> (data_date, kind, from)
    for r in rows:
        key = (r["plan_id"], r["served_model"])
        if key in DATA_DATES:
            entry = DATA_DATES[key]
            resolved[key] = (entry[0], entry[1], entry[2] if len(entry) > 2 else "")
        else:
            fam = family_data_date(*key)
            if fam is not None:
                resolved[key] = (fam, "official", "")

    def inherit_date(key: tuple, base_key: tuple) -> None:
        # 锚点本身也是派生行时，沿用其锚点记录而不是另起一层
        bdate, bkind, bfrom = resolved[base_key]
        resolved[key] = (bdate, "derived",
                         bfrom if bkind == "derived"
                         else f"{row_by_key[base_key]['plan_name']} · {row_by_key[base_key]['served_model']}")

    for key, bkey in DATA_DATE_INHERIT.items():
        if key not in resolved:
            inherit_date(key, bkey)
    for key, bkey in derived_base.items():
        if key not in resolved:
            inherit_date(key, bkey)
    date_re = re.compile(r"^\d{4}-\d{2}(-\d{2})?(~\d{4}-\d{2}(-\d{2})?)?$")
    for r in rows:
        key = (r["plan_id"], r["served_model"])
        if key not in resolved:
            raise ValueError(f"无数据日期: {key}")
        date, kind, frm = resolved[key]
        assert date_re.fullmatch(date), f"data_date 格式错误 {key}: {date!r}"
        assert kind in {"sample", "official", "derived"}, f"data_date_kind 非法 {key}: {kind!r}"
        assert bool(frm) == (kind == "derived"), f"data_date_from 仅 derived 可非空 {key}: {frm!r}"
        r["data_date"], r["data_date_kind"], r["data_date_from"] = date, kind, frm

    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows -> {OUT}")
    for r in sorted((r for r in rows if r["billing"] == "subscription"), key=lambda r: r["real_usd_per_mtok"]):
        print(f"  {r['real_usd_per_mtok']:>8.4f}  {r['plan_name']:<32} {r['served_model']:<18} {r['confidence']}")


if __name__ == "__main__":
    main()
