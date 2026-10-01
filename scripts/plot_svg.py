# -*- coding: utf-8 -*-
"""手写 SVG 版式。坐标由 points.json 计算，文字和图形均为原生矢量元素。"""
from __future__ import annotations

import json
import math
import unicodedata
from html import escape
from pathlib import Path

from palette import FALLBACK, channel_of, luminance, palette, shade

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_build"
STD_MIX = json.loads((ROOT / "data/conventions.json").read_text(encoding="utf-8"))["standardTokenMix"]
BOARDS = {
    "arena_code": ("CodeArena榜", "Code Arena"),
    "arena_agent_mode": ("AgentArena榜", "Agent Arena"),
    "aa_intelligence_index": ("AA智力榜", "Artificial Analysis"),
    "aa_coding_agent_index": ("AA编程Agent榜", "AA Coding Agent"),
    "open_design_arena": ("OpenDesign设计榜", "OpenDesign Arena"),
    "terminal_bench_4": ("TB4终端榜", "Terminal-Bench 4.0"),
    "aa_terminal_bench_4": ("TB4·AA榜", "TB4 (AA)"),
    "deepswe_1_1": ("DeepSWE榜", "DeepSWE v1.1"),
}
# 色值与 id 前缀统一来自 config/channel-colors.json；此处只定图例顺序。
COLORS = palette(["OpenAI", "Anthropic", "SpaceXAI", "Cursor", "Kimi", "Zhipu", "MiniMax", "Alibaba",
                  "OpenCode", "Command Code", "Ollama", "DeepSeek", "Google", "Xiaomi",
                  "Tencent", "StepFun", "Devin", "Factory"])
# 图例沿用旧显示名（Claude/GLM），内部键均为 canonical 渠道名。
LABEL = {"Anthropic": "Claude", "Zhipu": "GLM"}
LEFT, RIGHT, TOP, BOTTOM = 120, 1338, 233, 705


def channel(p):
    return channel_of(p["id"], p["vendor"])


def pareto(points, key):
    best, result = -math.inf, []
    for p in sorted(points, key=lambda p: (p["real_usd_per_mtok"], -p[key])):
        if p[key] > best:
            best = p[key]
            result.append(p)
    return result


def merge(points, key):
    groups = {}
    for p in points:
        xy = (p["real_usd_per_mtok"], p[key])
        if xy not in groups:
            groups[xy] = {**p, "members": []}
        groups[xy]["members"].append(p)
    return list(groups.values())


def fmt_price(x):
    return "≈$0" if x == 0 else "$" + f"{x:.5f}".rstrip("0").rstrip(".")


def promo_text(p, language):
    """不计额度点的价格行：$0 + 促销截止；无促销日期时只写 unmetered。"""
    until = p.get("promo_until")
    if until:
        mm, dd = until[5:7].lstrip("0"), until[8:10].lstrip("0")
        return f"≈$0 · promo until {mm}/{dd}, unmetered" if language == "en" else f"≈$0 · 促销至{mm}/{dd}，不计额度"
    return "≈$0 · unmetered" if language == "en" else "≈$0 · 不计额度"


def text_width(content, size):
    # 图例排宽估算：全角字符按 size、其余按 0.58·size 计。
    return sum(size if unicodedata.east_asian_width(ch) in "WF" else .58 * size
               for ch in content)


def text(x, y, content, size=14, fill="#222522", anchor="start", weight=400, extra=""):
    return (f'<text x="{x:.3f}" y="{y:.3f}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" {extra}>{escape(str(content))}</text>')


DEVIN_MARK_D = ("M0 38.6518V14.8349C7.06768e-06 13.7882 0.545676 12.821 1.43146 12.2977L21.5811 0.392519C22.4669 -0.13084 23.5583 -0.13084 24.444 0.392519L44.5937 12.2977C45.4795 12.821 46.0252 13.7882 46.0252 14.835V26.9983C46.1136 31.0401 48.201 34.9385 51.8723 37.1076C55.5435 39.2767 59.8863 39.1775 63.3509 37.2349L73.6442 31.1533C74.53 30.6299 75.6213 30.6299 76.5071 31.1533L96.6568 43.0584C97.5426 43.5818 98.0882 44.549 98.0882 45.5957V69.406C98.0882 70.4527 97.5426 71.4199 96.6568 71.9433L76.5071 83.8485C75.6213 84.3718 74.53 84.3718 73.6442 83.8485L63.4342 77.816C59.9562 75.8284 55.5738 75.7095 51.8732 77.8959C48.202 80.065 46.1146 83.9633 46.0262 88.005V100.165C46.0262 101.212 45.4805 102.179 44.5947 102.702L24.445 114.607C23.5592 115.131 22.4679 115.131 21.5821 114.607L1.43243 102.702C0.546645 102.179 0.000975341 101.212 0.000975341 100.165V76.3547C0.000982408 75.308 0.546652 74.3408 1.43244 73.8175L21.5821 61.9123C22.4679 61.3889 23.5592 61.3889 24.445 61.9123L34.7616 68.0077C38.2221 69.9367 42.5526 70.0305 46.215 67.8666C49.9155 65.6802 52.0061 61.7367 52.063 57.6605C51.9747 53.6187 49.8872 49.3025 46.216 47.1334C42.5447 44.9643 38.202 45.0635 34.7374 47.0061L24.3967 53.1502C23.5071 53.6788 22.4087 53.6783 21.5196 53.1489L1.42323 41.1841C0.542079 40.6595 -7.06754e-06 39.695 0 38.6518Z")


def devin_logo(r, fill, opacity=1.0, cx=0.0, cy=0.0):
    """官方 Devin mark（viewBox 0 0 99 115 的完整轮廓）。r 沿用旧六边形标志的尺寸口径：总高 4.36·r，居中于 (cx, cy)。"""
    s = 4.36 * r / 115
    return (f'<path transform="translate({cx - 49.04 * s:.2f} {cy - 57.5 * s:.2f}) scale({s:.4f})" '
            f'd="{DEVIN_MARK_D}" fill="{fill}" opacity="{opacity}"/>')


def plan_name(plan, language):
    if plan.startswith("GLM "):
        plan = plan.replace("老客", "v2").replace("新客", "v3")
    plan = plan.replace("Claude ", "").replace("ChatGPT ", "").replace("GLM Coding ", "GLM ")
    if language == "en":
        return (plan.replace(" (9/14+)", " · from Sep 14")
                .replace(" (促销至 10/31)", " · promo until Oct 31")
                .replace(" (老客 ¥149)", " · existing ¥149")
                .replace(" (老客 ¥49)", " · existing ¥49")
                .replace(" (老客 ¥469)", " · existing ¥469")
                .replace(" (新客 ¥118)", " · new ¥118")
                .replace(" (新客 ¥538)", " · new ¥538")
                .replace(" (新客 ¥1078)", " · new ¥1078")
                .replace("阿里云百炼", "Alibaba Cloud")
                .replace("Kimi 会员", "Kimi Membership")
                .replace("闲时", "off-peak")
                .replace("中间值", "midpoint")
                .replace("忙时", "peak"))
    return plan.replace(" (9/14+)", " · 9/14+").replace(" (老客 ¥149)", " · 老客 ¥149").replace(" (促销至 10/31)", " · 促销至 10/31")


def plan_label(q, language):
    """会员点套餐名：国内外并点档英文用国际版名、中文用国内档名，并注明两边标价。"""
    if not q.get("plan_en"):
        return plan_name(q["plan"], language)
    usd = f"${q['price_usd']:g}"
    if language == "en":
        return q["plan_en"] + (f" · {usd} / CN {q['local_price']}" if q.get("local_price") else "")
    return plan_name(q["plan"], language) + (f" · {q['local_price']} / 国际 {usd}" if q.get("local_price") else "")


def label_lines(p, language, board=None):
    plans = []
    for q in p["members"]:
        plan = plan_label(q, language)
        if plan not in plans:
            plans.append(plan)
    if len(plans) == 2 and all(x.startswith("Max ") for x in plans):
        plans = ["Max 5x / 20x · " + ("from Sep 14" if language == "en" else "9/14+")]
    models = list(dict.fromkeys(q["model_display"] for q in p["members"]))
    name = " / ".join(models)
    if board and any(q.get(board + "__score_is_estimated") for q in p["members"]):
        name += " [AA estimate]" if language == "en" else " [AA估计]"
    if board and any(q.get(board + "__score_is_self_reported") for q in p["members"]):
        name += " [self-reported]" if language == "en" else " [厂商自报]"
    if board:
        effort = p.get(board + "__reasoning_effort")
        harness = p.get(board + "__agent_harness")
        if effort:
            name += " · " + effort
        if harness:
            name = harness + " · " + name
    price = promo_text(p, language) if p.get("unmetered") else fmt_price(p["real_usd_per_mtok"])
    return name, " / ".join(plans), price


def label_position(p, board, x, y, tier="main"):
    # 仅调标签；绝不移动数据点。按这组已核对前沿的邻近关系安排引线和对齐。
    model = p["model"]
    if model == "claude-opus-5":
        if board == "aa_coding_agent_index":
            return x + 24, y - 72, "start"
        return x - 24, y - 49, "end"
    if model == "gpt-6-astra":
        if board == "aa_intelligence_index":
            return x - 24, y + 30, "end"
        if board == "aa_coding_agent_index":
            return x + 24, y - 108, "start"
    if model == "claude-opus-4.8":
        if board == "aa_intelligence_index":
            return x + 24, y + 43, "start"
        if board == "aa_coding_agent_index":
            return x - 24, y + 47, "end"
        return x - 24, y + 13, "end"
    if model == "claude-sonnet-5":
        if board == "arena_agent_mode" and tier == "full":
            return x - 40, y - 11, "end"
        return x + 22, y - 54, "start"
    if model == "claude-sonnet-5.5":
        if tier == "full":
            if board == "aa_terminal_bench_4":
                return x - 28, y + 49, "end"
            if board == "aa_coding_agent_index":
                return x - 4, y + 22, "end"
    if model == "claude-opus-5.5":
        if tier == "full":
            if board == "aa_terminal_bench_4":
                return x + 12, y - 20, "start"
            if board == "aa_coding_agent_index":
                return x + 12, y - 34, "start"
    if model == "gpt-6.1-sol":
        if board == "open_design_arena" and tier == "full":
            return x - 8, y + 19, "end"
    if model == "gpt-6-sol":
        if board == "open_design_arena" and tier == "full":
            return x - 20, y + 80, "end"
    if model == "mimo-v2.6-pro":
        if board == "aa_intelligence_index":
            return x - 30, y + 20, "end"
        if board == "arena_code":
            return x + 28, y - 47, "start"
    if model == "mimo-v2.6-flash":
        if board == "deepswe_1_1":
            return x + 112, y + 159, "end"
        if board == "aa_intelligence_index" and tier == "full":
            return x - 8, y + 25, "end"
        if board == "aa_terminal_bench_4" and tier == "full":
            return x - 200, y - 47, "end"
        if board == "open_design_arena" and tier == "full":
            return x - 40, y + 52, "end"
    if model == "mimo-v2.5":
        if board == "aa_intelligence_index":
            return x + 22, y - 25, "start"
    if model == "step-5-preview":
        if board == "aa_intelligence_index":
            return x + 45, y - 140, "start"
        if board == "aa_terminal_bench_4":
            if tier == "full":
                return x - 48, y - 86, "end"
            return x - 1, y + 41, "end"
    if model == "gemini-3.8-flash":
        if board == "aa_coding_agent_index":
            return x - 20, y + 64, "end"
    if model == "glm-5.3":
        if board == "aa_intelligence_index":
            return x + 24, y - 108, "start"
        if board == "arena_code":
            if tier == "full":
                return x - 5, y + 201, "middle"
            return x + 10, y - 65, "start"
        return x + 24, y - 31, "start"
    if model == "glm-5.3-flash":
        if board == "aa_intelligence_index":
            return x + 23, y - 95, "start"
        if board == "open_design_arena":
            return x - 24, y + 45, "end"
        if board == "arena_agent_mode":
            return x + 14, y - 68, "start"
        if board == "arena_code":
            if tier == "full":
                return x - 120, y - 23, "end"
            return x + 16, y + 15, "start"
        if board == "aa_terminal_bench_4" and tier == "full":
            return x - 20, y - 95, "middle"
        return x + 23, y - 40, "start"
    if model in {"deepseek-v4-flash", "deepseek-v4.1-flash"}:
        if model == "deepseek-v4.1-flash" and board == "aa_intelligence_index":
            return x + 10, y - 50, "start"
        if model == "deepseek-v4.1-flash" and board == "deepswe_1_1":
            return x - 24, y - 52, "end"
        if model == "deepseek-v4.1-flash" and board == "terminal_bench_4":
            return x - 141, y + 21, "end"
        if model == "deepseek-v4.1-flash" and board == "arena_agent_mode" and tier == "full":
            return x - 44, y + 91, "start"
        if model == "deepseek-v4.1-flash" and board == "arena_code" and tier == "full":
            return x - 44, y + 94, "start"
        return x - 24, y + 49, "end"
    if model == "gpt-6-luna":
        if board == "aa_terminal_bench_4":
            if tier == "full":
                return x - 8, y + 28, "end"
            return x - 150, y - 30, "end"
        if board == "aa_intelligence_index":
            return x + 20, y - 40, "start"
        if board == "aa_coding_agent_index":
            if tier == "full":
                return x + 0, y - 110, "middle"
            return x + 10, y - 78, "end"
        if board == "arena_agent_mode" and tier == "full":
            return x + 0, y - 140, "middle"
        if board == "arena_code" and tier == "full":
            return x + 0, y - 140, "middle"
        if board == "open_design_arena" and tier == "full":
            return x - 10, y + 118, "end"
        return x - 20, y - 52, "end"
    if model == "gpt-5.6-luna":
        # TB4 全量里 Luna 分数最低（官方 17.27% / AA 0%），标签整体下移会压过图框下缘。
        if board in ("terminal_bench_4", "aa_terminal_bench_4"):
            return x + 5, y + 25, "end"
        if board == "aa_intelligence_index":
            return x - 24, y + 58, "end"
        if board == "aa_coding_agent_index" and tier == "full":
            return x - 32, y - 23, "end"
        return x + 5, y + 57, "end"
    if model == "gpt-5.6-terra":
        if board == "aa_intelligence_index":
            return x - 24, y + 65, "end"
        return x + 24, y - 55, "start"
    if model == "step-3.7-flash":
        if board == "aa_intelligence_index":
            return x - 53, y - 116, "end"
    if model == "step-3.5-flash":
        if board == "aa_intelligence_index":
            return x - 35, y - 51, "end"
    if model == "swe-2":
        # 不计额度点贴右边界，标签只能往左上放，且要避开 TB4 里 Luna 的下方标签。
        if board == "terminal_bench_4":
            return x + 74, y + 27, "end"
        return x - 30, y + 34, "end"
    return x - 20, y - 52, "end"


def draw(board, meta, points, tier, language="zh"):
    key = board + "__score"
    valid = [p for p in points if p.get(key) is not None
             and ((p.get("real_usd_per_mtok") or 0) > 0 or p.get("unmetered"))
             and (tier == "full" or p["tier"] == "main")]
    subs = merge([p for p in valid if p["billing"] == "subscription"], key)
    api = merge([p for p in valid if p["billing"] == "metered"], key)
    frontier = pareto(subs + api, key)
    ids = {p["id"] for p in frontier}
    priced = [p["real_usd_per_mtok"] for p in valid if p["real_usd_per_mtok"] > 0]
    has_zero = any(p["real_usd_per_mtok"] == 0 for p in valid)
    xmin = min(priced, default=.001) / 1.48
    xmax = max(priced, default=1) * 1.6
    # 不计额度（$0）点不进对数换算：在最右侧留一个专用刻度位，对数轴到 xmin 为止。
    zero_slot = 0.055 if has_zero else 0
    log_right = RIGHT - (RIGHT - LEFT) * zero_slot
    ystep = 50 if board == "arena_code" else 5
    ymin = math.floor(min((p[key] for p in valid), default=0) / ystep) * ystep - ystep * .2
    ymax = math.ceil(max((p[key] for p in valid), default=10) / ystep) * ystep + ystep * .4
    def sx(v):
        if v == 0:
            return RIGHT - 22
        return LEFT + math.log(xmax / v) / math.log(xmax / xmin) * (log_right - LEFT)
    def sy(v):
        return BOTTOM - (v - ymin) / (ymax - ymin) * (BOTTOM - TOP)
    suffix = "_全量" if tier == "full" else ""
    lang_suffix = "_英文" if language == "en" else ""
    stem = f"帕累托_{BOARDS[board][0]}{suffix}{lang_suffix}"
    scope = ("Full" if tier == "full" else "Selected") if language == "en" else ("全量" if tier == "full" else "精选")
    headline = "Real price × benchmark reference" if language == "en" else "真实单价 × 评测配置参考"
    frontier_caption = f"Pareto frontier · {scope}" if language == "en" else f"帕累托前沿 · {scope}"
    snapshot_caption = "Leaderboard snapshot  " if language == "en" else "榜单快照  "
    present = [(name, c) for name, c in COLORS.items() if any(channel(p) == name for p in valid)]
    frontier_label = "Pareto frontier" if language == "en" else "帕累托前沿"
    api_label = "Metered API" if language == "en" else "按量 API"
    legend = [(17 + text_width(LABEL.get(name, name), 12), "mark", (name, c)) for name, c in present]
    legend += [(39 + text_width(frontier_label, 12), "line", frontier_label),
               (19 + text_width(api_label, 12), "diamond", api_label)]
    rows, xx = 1, 57
    for w, *_ in legend:
        if xx > 57 and xx + w > 1384:
            xx, rows = 57, rows + 1
        xx += w + 26
    legend_base = 834 + 24 * (rows - 1)
    height = legend_base + 106 + (21 if has_zero else 0)
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="{height}" viewBox="0 0 1440 {height}" role="img" aria-labelledby="title desc">',
         f'<title id="title">{escape(meta["name"])} · {"Pareto frontier" if language == "en" else "帕累托前沿"} · {scope}</title>',
         '<desc id="desc">Real unit price uses a logarithmic scale and gets cheaper to the right. Higher scores are better. Subscriptions and metered APIs both participate in the Pareto frontier.</desc>' if language == "en" else '<desc id="desc">价格为对数轴，越右越便宜；分数越高越好。订阅和按量API共同参与帕累托前沿。</desc>',
         '<style>text{font-family:"Microsoft YaHei","Segoe UI",sans-serif} .serif{font-family:"Times New Roman",serif} .number{font-family:"Segoe UI",sans-serif;font-variant-numeric:tabular-nums} .label-name{paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round} .point:hover{opacity:1}</style>',
         f'<rect width="1440" height="{height}" fill="#FAF9F6"/>',
         text(56, 32, "REAL API PRICING", 10, "#90968D", extra='letter-spacing="2.1"'),
         text(54, 85, headline, 36, "#343A33", weight=300, extra='letter-spacing=".8"'),
         '<path d="M61 147 Q197 141 343 147" stroke="#9FDDD0" stroke-width="17" stroke-linecap="round" opacity=".55" fill="none"/>',
         text(56, 146, "Pareto frontier", 44, "#35483E", extra='class="serif" font-style="italic"'),
         text(384, 143, frontier_caption, 16, "#858B81", weight=300),
         text(1388, 76, BOARDS[board][1], 31, "#343A33", "end", extra='class="serif"'),
         text(1388, 107, snapshot_caption + meta["snapshot"], 12, "#737771", "end"),
         text(1388, 136, meta["metric"] + (" " + meta["name"].rsplit(" ", 1)[1] if " v" in meta["name"] else ""), 12, "#737771", "end"),
         '<rect x="40" y="184" width="1360" height="612" rx="20" fill="#FFFFFF"/>']

    ticks = [.001, .002, .005, .01, .02, .05, .1, .2, .5, 1, 2, 5, 10]
    for tick in ticks:
        if xmin <= tick <= xmax:
            x = sx(tick)
            s += [f'<path d="M{x:.3f} {TOP}V{BOTTOM}" stroke="#E8EBE7" stroke-dasharray="2 7" opacity=".8"/>',
                  text(x, 735, "$" + f"{tick:g}", 12, "#747B74", "middle", extra='class="number"')]
    if has_zero:
        bx = (log_right + sx(0)) / 2 - 8
        s += [f'<path d="M{log_right:.3f} {TOP}V{BOTTOM}" stroke="#D6DBD5" stroke-dasharray="4 4"/>',
              f'<path d="M{bx:.3f} {BOTTOM - 6}l5 -7 5 7M{bx + 6:.3f} {BOTTOM + 6}l5 -7 5 7" stroke="#8B958D" stroke-width="1.2" fill="none"/>',
              text(sx(0), 735, "≈$0", 12, "#747B74", "middle", extra='class="number"'),
              text(sx(0), 750, "unmetered" if language == "en" else "不计额度", 9.5, "#8B958D", "middle")]
    for tick in range(math.ceil(ymin / ystep) * ystep, math.floor(ymax / ystep) * ystep + 1, ystep):
        y = sy(tick)
        s += [f'<path d="M{LEFT} {y:.3f}H{RIGHT}" stroke="#E8EBE7" stroke-dasharray="2 7" opacity=".8"/>',
              text(LEFT - 20, y + 4, f"{tick}" + ("%" if "%" in meta["metric"] else ""), 12, "#747B74", "end", extra='class="number"')]
    s += [f'<path d="M{LEFT} {TOP}V{BOTTOM}H{RIGHT}" fill="none" stroke="#E3E7E2"/>',
          text(66, (TOP + BOTTOM) / 2, meta["metric"], 12, "#697169", "middle",
               extra=f'transform="rotate(-90 66 {(TOP + BOTTOM) / 2})"'),
          text(720, 775, "Real price · USD per million tokens" if language == "en" else "真实单价 · 美元 / 百万 token", 13, "#5D655E", "middle"),
          text(1338, 775, "Cheaper →" if language == "en" else "越右越便宜 →", 12, "#737B74", "end")]

    if frontier:
        xy = [(LEFT, sy(frontier[-1][key]))] + [(sx(p["real_usd_per_mtok"]), sy(p[key])) for p in reversed(frontier)] + [(RIGHT, sy(frontier[0][key]))]
        path = "M" + " L".join(f"{x:.3f},{y:.3f}" for x, y in xy)
        s.append(f'<path id="frontier" d="{path}" fill="none" stroke="#303630" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>')
    for p in subs + api:
        x, y = sx(p["real_usd_per_mtok"]), sy(p[key])
        c = COLORS.get(channel(p), FALLBACK)
        is_front = p["id"] in ids
        tooltip_labels = [f'{q["model_display"]} · {plan_label(q, language)}' for q in p["members"]]
        tooltip = " / ".join(tooltip_labels) + f" · {fmt_price(p['real_usd_per_mtok'])}/MTok · {p[key]} · {p['confidence']}"
        tooltip += " / ".join(str(q.get(board + "__variant")) + " · " + str(q.get(board + "__mapping_note")) for q in p["members"])
        s.append(f'<g class="point" data-billing="{p["billing"]}" data-frontier="{str(is_front).lower()}" data-price="{p["real_usd_per_mtok"]}" data-score="{p[key]}" data-x="{x:.3f}" data-y="{y:.3f}" transform="translate({x:.3f} {y:.3f})"><title>{escape(tooltip)}</title>')
        if is_front and p["billing"] == "metered":
            s += [f'<path d="M0 -12L12 0 0 12 -12 0Z" fill="#FFF" stroke="{c}" stroke-width="1.35"/>',
                  f'<path d="M0 -4L4 0 0 4 -4 0Z" fill="{c}"/>']
        elif channel(p) == "Devin":
            # Devin 渠道用官方标志形状代替方块；前沿点外框保留，内部放标志。
            if is_front:
                s += [f'<rect x="-11" y="-11" width="22" height="22" rx="6" fill="#FFF" stroke="{c}" stroke-width="1.35"/>',
                      devin_logo(3.5, c)]
            else:
                s.append(devin_logo(2.4, c, .68))
        elif is_front:
            s += [f'<rect x="-11" y="-11" width="22" height="22" rx="6" fill="#FFF" stroke="{c}" stroke-width="1.35"/>',
                  f'<circle r="4" fill="{c}"/>']
        elif p["billing"] == "metered":
            s.append(f'<path d="M0 -5.5L5.5 0 0 5.5 -5.5 0Z" fill="white" stroke="{c}" stroke-width="1.5" opacity=".68"/>')
        else:
            # 浅色渠道（淡紫/粉/薄荷等）加同色相深边，白底上保持可辨。
            edge = f' stroke="{shade(c, .32)}" stroke-width=".9"' if luminance(c) > .45 else ""
            s.append(f'<rect x="-3.5" y="-3.5" width="7" height="7" rx="1.8" fill="{c}" opacity=".68"{edge}/>')
        s.append('</g>')
    for p in reversed(frontier):
        x, y = sx(p["real_usd_per_mtok"]), sy(p[key])
        lx, ly, anchor = label_position(p, board, x, y, tier)
        name, plan, price = label_lines(p, language, board)
        # 三行标签直接排字，无卡片；短引线从留白侧连接，最高点靠近自身无需长线。
        end_y = ly + 19 if ly < y else ly - 13
        end_x = lx + (6 if anchor == "end" else -6)
        vx, vy = end_x - x, end_y - y
        length = math.hypot(vx, vy)
        start_x, start_y = x + vx / length * 15, y + vy / length * 15
        s += [f'<g class="front-label" data-model="{p["model"]}">',
              f'<path d="M{start_x:.3f},{start_y:.3f}Q{start_x:.3f},{end_y:.3f} {end_x:.3f},{end_y:.3f}" stroke="#C4CDC3" stroke-width=".8" fill="none"/>',
              text(lx, ly, name, 16, "#343C34", anchor, 400, 'class="label-name"'),
              text(lx, ly + 20, plan, 11.5, "#8B9487", anchor),
              text(lx, ly + 40, price, 14, "#566150", anchor, 400, 'class="number"'), '</g>']

    xx, row = 57, 0
    for w, kind, payload in legend:
        if xx > 57 and xx + w > 1384:
            xx, row = 57, row + 1
        ty = 834 + 24 * row
        if kind == "mark":
            name, c = payload
            s += [devin_logo(2.4, c, cx=xx + 4, cy=ty - 4) if name == "Devin" else f'<rect x="{xx}" y="{ty - 8}" width="8" height="8" fill="{c}"/>',
                  text(xx + 17, ty, LABEL.get(name, name), 12, "#687168")]
        elif kind == "line":
            s += [f'<path d="M{xx + 9} {ty - 4}h22" stroke="#303630" stroke-width="1.65"/>',
                  text(xx + 39, ty, payload, 12, "#687168")]
        else:
            s += [f'<path d="M{xx + 5} {ty - 9}l5 5-5 5-5-5Z" fill="none" stroke="#8B958D" stroke-width="1.2"/>',
                  text(xx + 19, ty, payload, 12, "#687168")]
        xx += w + 26
    note = ((
        "OpenDesign Harness reference; product/quota alignment unverified, not channel measurements."
        if board == "open_design_arena" else
        "Highest archived configuration reference; harness and effort shown. Product/quota alignment unverified, not channel measurements."
        if board in ("aa_coding_agent_index", "terminal_bench_4", "aa_terminal_bench_4", "deepswe_1_1") else
        "Claude Max: permanent allowance estimate from Sep 14; Pro: historical Opus 4.8 measurement. Y uses the top archived variant per model."
    ) if language == "en" else (
        "OpenDesign Harness 配置参考；产品/额度实测配置未对齐，不代表各渠道的实测成绩。"
        if board == "open_design_arena" else
        "最高存档配置参考；标注harness与effort。产品/额度实测配置未对齐，不代表各渠道的实测成绩。"
        if board in ("aa_coding_agent_index", "terminal_bench_4", "aa_terminal_bench_4", "deepswe_1_1") else
        "Claude Max：9/14 起永久额度估算；Pro：Opus 5 周池面板反推。Y 取同模型存档最高分变体。"
    ))
    promo = ("≈$0 = SWE-2 promo: unmetered on Devin Pro/Max/Teams until 2026-10-31, not permanent" +
             ("; TB4 score self-reported by Cognition" if board == "terminal_bench_4" else "") + "." if language == "en" else
             "≈$0 为 SWE-2 促销价：Devin Pro/Max/Teams 至 2026-10-31 不计额度，非永久口径" +
             ("；TB4 分数为 Cognition 自报" if board == "terminal_bench_4" else "") + "。")
    y = legend_base + 40
    s += [text(56, y, f"Default month = 4 weeks; Kimi pool = 5× weekly · Dollar/credit: {STD_MIX['cache']:.0%} cache / {STD_MIX['input']:.1%} input / {STD_MIX['output']:.1%} output · Direct totals unchanged" if language == "en" else f"默认月=4周；Kimi月池=周池×5 · 美元/credits换算：缓存{STD_MIX['cache']:.0%} / 输入{STD_MIX['input']:.1%} / 输出{STD_MIX['output']:.1%} · 直接total实测不重算", 12, "#727B72"),
          text(1384, y, (f"{len(subs)} subscription positions / {len(api)} API positions / {len(frontier)} frontier positions" if language == "en" else f"{len(subs)} 个订阅位置 / {len(api)} 个 API 位置 / {len(frontier)} 个前沿位置"), 12, "#727B72", "end"),
          text(56, y + 24, note, 11, "#929A90")]
    y += 45
    if has_zero:
        s.append(text(56, y, promo, 11, "#929A90"))
        y += 21
    s += [text(56, y, "Subscriptions and metered APIs share one frontier; line segments are visual guides, not purchasable plans." if language == "en" else "订阅与按量API共同参与前沿；连线中间不代表可购套餐。完整出处与假设见项目核对报告。", 11, "#929A90"),
          text(1384, y, meta["url"].replace("https://", ""), 11, "#929A90", "end"), '</svg>']
    OUT.mkdir(exist_ok=True)
    (OUT / f"{stem}.svg").write_text("\n".join(s), encoding="utf-8")
    return dict(stem=stem, board=board, tier=tier, language=language, bounds=[xmin, xmax, ymin, ymax],
                coordinates=[dict(price=p["real_usd_per_mtok"], score=p[key], billing=p["billing"],
                                  x=round(sx(p["real_usd_per_mtok"]), 3), y=round(sy(p[key]), 3)) for p in subs + api],
                frontier=[dict(price=p["real_usd_per_mtok"], score=p[key]) for p in frontier])


def main():
    data = json.loads((ROOT / "derived/points.json").read_text(encoding="utf-8"))
    charts = [draw(board, meta, data["points"], tier, language)
              for board, meta in data["boards"].items()
              for tier in ("main", "full") for language in ("zh", "en")]
    (OUT / "SVG坐标核对.json").write_text(json.dumps(charts, ensure_ascii=False, indent=2), encoding="utf-8")
    for chart in charts:
        print(chart["stem"] + f': {len(chart["coordinates"])} positions, {len(chart["frontier"])} frontier')


if __name__ == "__main__":
    main()
