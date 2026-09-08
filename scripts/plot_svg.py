# -*- coding: utf-8 -*-
"""手写 SVG 版式。坐标由 points.json 计算，文字和图形均为原生矢量元素。"""
from __future__ import annotations

import json
import math
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_build"
BOARDS = {
    "arena_code": ("CodeArena榜", "Code Arena"),
    "arena_agent_mode": ("AgentArena榜", "Agent Arena"),
    "aa_intelligence_index": ("AA智力榜", "Artificial Analysis"),
    "aa_coding_agent_index": ("AA编程Agent榜", "AA Coding Agent"),
}
COLORS = {"OpenAI": "#00A86B", "Claude": "#F07826", "xAI": "#B65CFF",
          "Cursor": "#FFB81C", "Kimi": "#2FA8FF", "GLM": "#1E1E1E",
          "MiniMax": "#D23A7D", "Alibaba": "#FF6F61", "OpenCode": "#00C0A8",
          "Command Code": "#708090", "Ollama": "#A0785C", "DeepSeek": "#1F75FE",
          "Google": "#7CC12A", "Xiaomi": "#FFA000", "Tencent": "#26C6DA"}
PREFIXES = [("chatgpt", "OpenAI"), ("openai", "OpenAI"), ("claude", "Claude"),
            ("anthropic", "Claude"),
            ("supergrok", "xAI"), ("xai", "xAI"), ("cursor", "Cursor"), ("kimi", "Kimi"),
            ("glm", "GLM"), ("minimax", "MiniMax"), ("aliyun", "Alibaba"),
            ("opencode", "OpenCode"), ("command_code", "Command Code"), ("ollama", "Ollama"),
            ("deepseek", "DeepSeek")]
WIDTH, HEIGHT = 1440, 940
LEFT, RIGHT, TOP, BOTTOM = 120, 1338, 233, 705


def channel(p):
    return next((name for prefix, name in PREFIXES if p["id"].startswith(prefix)), p["vendor"])


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
    return "$" + f"{x:.5f}".rstrip("0").rstrip(".")


def text(x, y, content, size=14, fill="#222522", anchor="start", weight=400, extra=""):
    return (f'<text x="{x:.3f}" y="{y:.3f}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" {extra}>{escape(str(content))}</text>')


def plan_name(plan, language):
    if plan.startswith("GLM "):
        plan = plan.replace("老客", "v2").replace("新客", "v3")
    plan = plan.replace("Claude ", "").replace("ChatGPT ", "").replace("GLM Coding ", "GLM ")
    if language == "en":
        return (plan.replace(" (9/14+)", " · from Sep 14")
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
    return plan.replace(" (9/14+)", " · 9/14+").replace(" (老客 ¥149)", " · 老客 ¥149")


def label_lines(p, language, board=None):
    plans = []
    for q in p["members"]:
        plan = plan_name(q["plan"], language)
        if plan not in plans:
            plans.append(plan)
    if len(plans) == 2 and all(x.startswith("Max ") for x in plans):
        plans = ["Max 5x / 20x · " + ("from Sep 14" if language == "en" else "9/14+")]
    models = list(dict.fromkeys(q["model_display"] for q in p["members"]))
    name = " / ".join(models)
    if board and any(q.get(board + "__score_is_estimated") for q in p["members"]):
        name += " [AA estimate]" if language == "en" else " [AA估计]"
    if board:
        effort = p.get(board + "__reasoning_effort")
        harness = p.get(board + "__agent_harness")
        if effort:
            name += " · " + effort
        if harness:
            name = harness + " · " + name
    return name, " / ".join(plans), fmt_price(p["real_usd_per_mtok"])


def label_position(p, board, x, y):
    # 仅调标签；绝不移动数据点。按这组已核对前沿的邻近关系安排引线和对齐。
    model = p["model"]
    if model == "claude-opus-5":
        return x - 24, y - 49, "end"
    if model == "claude-opus-4.8":
        if board == "aa_intelligence_index":
            return x + 24, y + 43, "start"
        if board == "aa_coding_agent_index":
            return x - 24, y + 47, "end"
        return x - 24, y + 13, "end"
    if model == "claude-sonnet-5":
        return x + 22, y - 54, "start"
    if model == "glm-5.3":
        if board == "aa_intelligence_index":
            return x + 24, y - 72, "start"
        return x + 24, y - (58 if board == "arena_code" else 31), "start"
    if model == "glm-5.3-flash":
        return x + 23, y - 40, "start"
    if model == "deepseek-v4-flash":
        return x - 24, y + 49, "end"
    if model == "gpt-5.6-luna":
        return x + 5, y + 57, "end"
    if model == "gpt-5.6-terra":
        if board == "aa_intelligence_index":
            return x - 24, y + 65, "end"
        return x + 24, y - 55, "start"
    return x - 20, y - 52, "end"


def draw(board, meta, points, tier, language="zh"):
    key = board + "__score"
    valid = [p for p in points if p.get(key) is not None and (p.get("real_usd_per_mtok") or 0) > 0
             and (tier == "full" or p["tier"] == "main")]
    subs = merge([p for p in valid if p["billing"] == "subscription"], key)
    api = merge([p for p in valid if p["billing"] == "metered"], key)
    frontier = pareto(subs + api, key)
    ids = {p["id"] for p in frontier}
    xmin = min((p["real_usd_per_mtok"] for p in valid), default=.001) / 1.48
    xmax = max((p["real_usd_per_mtok"] for p in valid), default=1) * 1.6
    ystep = 50 if board == "arena_code" else 5
    ymin = math.floor(min((p[key] for p in valid), default=0) / ystep) * ystep - ystep * .2
    ymax = math.ceil(max((p[key] for p in valid), default=10) / ystep) * ystep + ystep * .4
    def sx(v):
        return LEFT + math.log(xmax / v) / math.log(xmax / xmin) * (RIGHT - LEFT)
    def sy(v):
        return BOTTOM - (v - ymin) / (ymax - ymin) * (BOTTOM - TOP)
    suffix = "_全量" if tier == "full" else ""
    lang_suffix = "_英文" if language == "en" else ""
    stem = f"帕累托_{BOARDS[board][0]}{suffix}{lang_suffix}"
    scope = ("Full" if tier == "full" else "Selected") if language == "en" else ("全量" if tier == "full" else "精选")
    headline = "Real price × benchmark reference" if language == "en" else "真实单价 × 评测配置参考"
    frontier_caption = f"Pareto frontier · {scope}" if language == "en" else f"帕累托前沿 · {scope}"
    snapshot_caption = "Leaderboard snapshot  " if language == "en" else "榜单快照  "
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="940" viewBox="0 0 1440 940" role="img" aria-labelledby="title desc">',
         f'<title id="title">{escape(meta["name"])} · {"Pareto frontier" if language == "en" else "帕累托前沿"} · {scope}</title>',
         '<desc id="desc">Real unit price uses a logarithmic scale and gets cheaper to the right. Higher scores are better. Subscriptions and metered APIs both participate in the Pareto frontier.</desc>' if language == "en" else '<desc id="desc">价格为对数轴，越右越便宜；分数越高越好。订阅和按量API共同参与帕累托前沿。</desc>',
         '<style>text{font-family:"Microsoft YaHei","Segoe UI",sans-serif} .serif{font-family:"Times New Roman",serif} .number{font-family:"Segoe UI",sans-serif;font-variant-numeric:tabular-nums} .label-name{paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round} .point:hover{opacity:1}</style>',
         '<rect width="1440" height="940" fill="#FAF9F6"/>',
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
        c = COLORS.get(channel(p), "#58655E")
        is_front = p["id"] in ids
        tooltip_labels = [f'{q["model_display"]} · {plan_name(q["plan"], language)}' for q in p["members"]]
        tooltip = " / ".join(tooltip_labels) + f" · {fmt_price(p['real_usd_per_mtok'])}/MTok · {p[key]} · {p['confidence']}"
        tooltip += " / ".join(str(q.get(board + "__variant")) + " · " + str(q.get(board + "__mapping_note")) for q in p["members"])
        s.append(f'<g class="point" data-billing="{p["billing"]}" data-frontier="{str(is_front).lower()}" data-price="{p["real_usd_per_mtok"]}" data-score="{p[key]}" data-x="{x:.3f}" data-y="{y:.3f}" transform="translate({x:.3f} {y:.3f})"><title>{escape(tooltip)}</title>')
        if is_front and p["billing"] == "metered":
            s += [f'<path d="M0 -12L12 0 0 12 -12 0Z" fill="#FFF" stroke="{c}" stroke-width="1.35"/>',
                  f'<path d="M0 -4L4 0 0 4 -4 0Z" fill="{c}"/>']
        elif is_front:
            s += [f'<rect x="-11" y="-11" width="22" height="22" rx="6" fill="#FFF" stroke="{c}" stroke-width="1.35"/>',
                  f'<circle r="4" fill="{c}"/>']
        elif p["billing"] == "metered":
            s.append(f'<path d="M0 -5.5L5.5 0 0 5.5 -5.5 0Z" fill="white" stroke="{c}" stroke-width="1.5" opacity=".68"/>')
        else:
            s.append(f'<rect x="-3.5" y="-3.5" width="7" height="7" rx="1.8" fill="{c}" opacity=".68"/>')
        s.append('</g>')
    for p in reversed(frontier):
        x, y = sx(p["real_usd_per_mtok"]), sy(p[key])
        lx, ly, anchor = label_position(p, board, x, y)
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

    present = [(name, c) for name, c in COLORS.items() if any(channel(p) == name for p in valid)]
    xx = 57
    for name, c in present:
        s += [f'<rect x="{xx}" y="826" width="8" height="8" fill="{c}"/>', text(xx + 17, 834, name, 12, "#687168")]
        xx += max(83, len(name) * 7 + 38)
    api_mark_x = xx + (190 if language == "en" else 129)
    s += [f'<path d="M{xx + 9} 830h22" stroke="#303630" stroke-width="1.65"/>', text(xx + 39, 834, "Pareto frontier" if language == "en" else "帕累托前沿", 12, "#687168"),
          f'<path d="M{api_mark_x} 825l5 5-5 5-5-5Z" fill="none" stroke="#8B958D" stroke-width="1.2"/>',
          text(api_mark_x + 14, 834, "Metered API" if language == "en" else "按量 API", 12, "#687168"),
          text(56, 874, "Default month = 4 weeks; Kimi pool = 5× weekly · Dollar/credit: 97.5% cache / 2.15% input / 0.35% output · Direct totals unchanged" if language == "en" else "默认月=4周；Kimi月池=周池×5 · 美元/credits换算：缓存97.5% / 输入2.15% / 输出0.35% · 直接total实测不重算", 12, "#727B72"),
          text(1384, 874, (f"{len(subs)} subscription positions / {len(api)} API positions / {len(frontier)} frontier positions" if language == "en" else f"{len(subs)} 个订阅位置 / {len(api)} 个 API 位置 / {len(frontier)} 个前沿位置"), 12, "#727B72", "end"),
          text(56, 898, ((
              "Highest archived configuration reference; harness and effort shown. Product/quota alignment unverified, not channel measurements."
              if board == "aa_coding_agent_index" else
              "Claude Max: permanent allowance estimate from Sep 14; Pro: historical Opus 4.8 measurement. Y uses the top archived variant per model."
          ) if language == "en" else (
              "最高存档配置参考；标注harness与effort。产品/额度实测配置未对齐，不代表各渠道的实测成绩。"
              if board == "aa_coding_agent_index" else
              "Claude Max：9/14 起永久额度估算；Pro：Opus 4.8 历史实测。Y 取同模型存档最高分变体。"
          )), 11, "#929A90"),
          text(56, 919, "Subscriptions and metered APIs share one frontier; line segments are visual guides, not purchasable plans." if language == "en" else "订阅与按量API共同参与前沿；连线中间不代表可购套餐。完整出处与假设见项目核对报告。", 11, "#929A90"),
          text(1384, 919, meta["url"].replace("https://", ""), 11, "#929A90", "end"), '</svg>']
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
