# 额度与单价总览图：订阅月额度、订阅与按量 API 真实单价
# 数据源：data/adopted.csv（生成物，勿手改）
# 用法：python scripts/plot_quotas.py
#   →  _build/{额度,单价}总览{,_英文}.png / .svg          中英文两栏横向条形图
#   →  _build/额度总览{_英文,}_混合比例.png / .svg         其余条保持对数，01/02 按对 03 的真实倍数，放不下折下
#   →  _build/{额度,单价}总览表{,_英文}.txt               中英文纯文字对齐表格
#   →  _build/前沿{额度,单价}_{CodeArena榜,AgentArena榜,AA智力榜,AA编程Agent榜}{,_英文}.*
#   →  _build/前沿筛选结果.json；publish_charts.py 再导出到 charts/
import csv
import json
import math
import os
import unicodedata

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

from compute import DISPLAY

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADOPTED = os.path.join(ROOT, "data", "adopted.csv")
OUT_DIR = os.path.join(ROOT, "_build")
with open(os.path.join(ROOT, "data", "conventions.json"), encoding="utf-8") as f:
    CONVENTIONS = json.load(f)

if os.path.isfile("C:/Windows/Fonts/msyh.ttc"):
    font_manager.fontManager.addfont("C:/Windows/Fonts/msyh.ttc")
plt.rcParams["font.family"] = ["Microsoft YaHei", "Noto Sans CJK SC", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

VENDOR_OF = {
    "chatgpt": "OpenAI",
    "openai": "OpenAI",
    "claude": "Anthropic",
    "anthropic": "Anthropic",
    "supergrok": "xAI",
    "xai": "xAI",
    "cursor": "Cursor",
    "kimi": "Kimi",
    "glm": "GLM",
    "minimax": "MiniMax",
    "aliyun": "Alibaba",
    "opencode": "OpenCode",
    "command_code": "Command Code",
    "ollama": "Ollama",
    "deepseek": "DeepSeek",
}
VENDOR_COLORS = {
    "OpenAI": "#19B37A",
    "Anthropic": "#FF8A3D",
    "xAI": "#8E6CF7",
    "Cursor": "#FFC233",
    "Kimi": "#2FA8FF",
    "GLM": "#1E1E1E",
    "MiniMax": "#FF5FA2",
    "Alibaba": "#FF4D4F",
    "OpenCode": "#00BCD4",
    "Command Code": "#D81BCC",
    "Ollama": "#00A86B",
    "DeepSeek": "#2F5BFF",
    "Gemini": "#7CC12A",
}
VIEW_CN = {"quotas": "额度", "prices": "单价"}
BOARD_CN = {
    "arena_code": "CodeArena榜",
    "arena_agent_mode": "AgentArena榜",
    "aa_intelligence_index": "AA智力榜",
    "aa_coding_agent_index": "AA编程Agent榜",
}


def output_stem(view: str, board: dict | None, language: str, table: bool = False) -> str:
    """中文文件名：单价总览 / 前沿单价_Arena榜，英文版加 _英文，文字表加 表。"""
    base = f"前沿{VIEW_CN[view]}" if board else f"{VIEW_CN[view]}总览"
    if table:
        base += "表"
    if board:
        base += f"_{BOARD_CN[board['id']]}"
    return base + ("_英文" if language == "en" else "")


VENDOR_CODES = {
    "OpenAI": "OA", "Anthropic": "AN", "xAI": "XA", "Cursor": "CU",
    "Kimi": "KI", "GLM": "GL", "MiniMax": "MM", "Alibaba": "AL",
    "OpenCode": "OC", "Command Code": "CC", "Ollama": "OL",
    "DeepSeek": "DS", "Gemini": "GE",
}
TEXT = {
    "zh": {
        "quotas_title": "订阅额度总览 · 套餐 × 实际服务模型",
        "prices_title": "真实单价总览 · 订阅与 API 统一对比",
        "quotas_subtitle": "月 = 4 周，饱和使用；全口径 token；按量 API 无月额度，不参与额度排序",
        "prices_subtitle": "美元/credits与API三段价统一按97.5%缓存 / 2.15%输入 / 0.35%输出折算；直接total-token实测不重算",
        "quotas_axis": "月可用 token（亿，对数轴）",
        "prices_axis": "真实单价（美元 / 百万 token，对数轴）",
        "quotas_order": "额度从高到低",
        "prices_order": "单价从低到高",
        "mixed_note": "除前两条外，其余条形仍按对数轴。01、02 按对 03 的真实倍数重画（01≈6.1×03，02≈1.5×03）；01 横放不下则在右缘折下，穿越右栏处半透明。",
        "footer": "颜色 = 套餐/API 提供方；置信度 [H] 高 / [M] 中 / [L] 低；编号为排序序号，同值依次列出，不代表模型能力排名。",
        "shared": "同套餐各模型额度不可相加。Claude Max (9/14+)：2026-09-14起永久额度估算，非当前活动期上限。数据：adopted.csv。",
        "headers": ["序号", "套餐", "价格/月", "服务模型", "月额度(亿)", "$/MTok", "置信度"],
        "metered": "按量计费",
    },
    "en": {
        "quotas_title": "Monthly token allowance | Subscription plan x served model",
        "prices_title": "Effective token price | Subscriptions and APIs compared",
        "quotas_subtitle": "4 weeks per month, full utilization, all token types; pay-as-you-go APIs have no monthly allowance",
        "prices_subtitle": "Dollar/credit and API rates use 97.5% cache / 2.15% input / 0.35% output; direct total-token measurements are not normalized",
        "quotas_axis": "Monthly tokens (billions, log scale)",
        "prices_axis": "Effective price (USD per million tokens, log scale)",
        "quotas_order": "Highest allowance first",
        "prices_order": "Lowest price first",
        "mixed_note": "All bars except 01–02 stay on the log scale. Bars 01–02 are redrawn as true multiples of 03 (~6.1× and ~1.5×); 01 folds down the right edge if needed and turns translucent where it crosses the right column.",
        "footer": "Color = plan/API provider; confidence [H] high / [M] medium / [L] low; numbers indicate row order, not model capability. Ties listed sequentially.",
        "shared": "Allowances within a plan are not additive. Claude Max (9/14+): estimated permanent allowances from 2026-09-14, not current boosted limits. Source: adopted.csv.",
        "headers": ["No.", "Plan", "Monthly fee", "Served model", "Monthly tokens (B)", "USD/MTok", "Confidence"],
        "metered": "Pay-as-you-go",
    },
}


def vendor_of(plan_id: str) -> str:
    return next(name for prefix, name in VENDOR_OF.items() if plan_id.startswith(prefix))


def plan_name(row: dict, language: str) -> str:
    name = row["plan_name"]
    if row["plan_id"].startswith("kimi_"):
        name += " †"
    if language == "en":
        for original, translated in {
            "Kimi 会员 ": "Kimi CN ",
            "新客": "New",
            "老客": "Existing",
            "阿里云百炼": "Alibaba Cloud CN",
            "闲时": "Off-peak",
            "中间值": "Midpoint",
            "忙时": "Peak",
        }.items():
            name = name.replace(original, translated)
        if row["plan_id"].startswith("kimi_"):
            name = name.replace("Kimi CN ", "Kimi CN CNY ")
    return name


def text_width(s: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def pad(s: str, width: int) -> str:
    return s + " " * max(0, width - text_width(s))


def monthly_value(row: dict, language: str) -> float:
    return float(row["monthly_yi"]) / (10 if language == "en" else 1)


def sorted_rows(rows: list[dict], view: str) -> list[dict]:
    if view == "quotas":
        return sorted(
            (r for r in rows if r["billing"] == "subscription" and r["monthly_tokens"]),
            key=lambda r: -float(r["monthly_yi"]),
        )
    return sorted(rows, key=lambda r: float(r["real_usd_per_mtok"]))


def frontier_rows(rows: list[dict], points: list[dict], board: str) -> list[dict]:
    index = {p["id"]: p for p in points}
    candidates = []
    for row in rows:
        point = index.get(f"{row['plan_id']}::{row['served_model']}")
        if point is None or point.get(f"{board}__score") is None or float(row["real_usd_per_mtok"]) <= 0:
            continue
        if float(row["real_usd_per_mtok"]) != point["real_usd_per_mtok"]:
            raise ValueError("derived/points.json is stale; run scripts/compute.py first")
        candidates.append({**row, "board_score": point[f"{board}__score"],
                           "board_variant": point[f"{board}__variant"],
                           "board_mapping": point[f"{board}__mapping_kind"]})
    return [row for row in candidates if not any(
        float(other["real_usd_per_mtok"]) <= float(row["real_usd_per_mtok"])
        and other["board_score"] >= row["board_score"]
        and (float(other["real_usd_per_mtok"]) < float(row["real_usd_per_mtok"])
             or other["board_score"] > row["board_score"])
        for other in candidates
    )]


def frontier_caption(board: dict) -> str:
    return f"{board['name']} | {board['metric']} | {board['snapshot']}"


def frontier_rule(language: str) -> str:
    if language == "zh":
        return "前沿按全量订阅/API的单价与得分筛选，非额度排名；同价同分套餐均保留；缺分模型不参与，估算不确定性未纳入筛选。"
    return "Selected by price and score across all subscriptions/APIs, not by allowance. Equivalent plans retained; unscored models excluded; uncertainty not modeled."


def evidence_note(language: str) -> str:
    if language == "zh":
        return "† Kimi：¥199样本以K3-256K为主，约84%反推11.61亿，非纯1M实测；其余档位按比例推算。OpenCode Go按官方美元池和三段价套统一标准负载换算；Composer Fast为产品默认模式。"
    return "† Kimi: CNY199 uses a K3-256K-dominant sample / ~84%; other tiers are scaled. OpenCode Go uses official dollar pools and rates under the standard workload. Composer Fast is the product default."


def exchange_note(language: str) -> str:
    fx = CONVENTIONS["exchangeRate"]
    rate = CONVENTIONS["usdPerCny"]
    if language == "zh":
        return f"汇率：1 USD = {rate:g} CNY（{fx['date']}，{fx['labelZh']}）；人民币月费 ÷ 汇率换算美元。"
    return f"FX: 1 USD = {rate:g} CNY ({fx['date']}, {fx['labelEn']}); CNY monthly fees divided by this rate."


def write_text_table(rows: list[dict], view: str, language: str, board: dict | None = None) -> None:
    text = TEXT[language]
    head = text["headers"] + ([board["metric"], "得分版本" if language == "zh" else "Score variant", "映射" if language == "zh" else "Mapping"] if board else [])
    body = [
        [
            str(i), plan_name(r, language),
            f"{r['currency']} {r['price']}" if r["price"] else text["metered"],
            DISPLAY.get(r["served_model"], r["served_model"]),
            f"{monthly_value(r, language):g}" if r["monthly_tokens"] else "-",
            r["real_usd_per_mtok"], r["confidence"],
        ] + ([f"{r['board_score']:g}", r["board_variant"], r["board_mapping"]] if board else [])
        for i, r in enumerate(rows, 1)
    ]
    widths = [max(text_width(c) for c in [h] + [b[i] for b in body])
              for i, h in enumerate(head)]
    line = "  ".join(pad(h, w) for h, w in zip(head, widths)).rstrip()
    sep = "  ".join("-" * w for w in widths)
    out = [text[f"{view}_title"], text[f"{view}_subtitle"], text["shared"],
           text["footer"], evidence_note(language), exchange_note(language),
           ("汇率来源：" if language == "zh" else "FX source: ") + CONVENTIONS["exchangeRate"]["source"], line, sep] + [
        "  ".join(pad(c, w) for c, w in zip(b, widths)).rstrip() for b in body
    ]
    if board:
        out = [frontier_caption(board), frontier_rule(language)] + out
    path = os.path.join(OUT_DIR, output_stem(view, board, language, table=True) + ".txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {len(rows)} rows -> {path}")


def annotation_of(row: dict, value: float, view: str, language: str,
                  board: dict | None) -> str:
    value_label = f"{value:g}" if view == "quotas" else f"${value:g}"
    confidence = row["confidence"][0].upper()
    channel = VENDOR_CODES[vendor_of(row["plan_id"])]
    annotation = f"{value_label}  {channel} [{confidence}]"
    if board:
        score = f"{row['board_score']:+g}%" if "%" in board["metric"] else f"{row['board_score']:g}"
        annotation += f"\n{'得分' if language == 'zh' else 'Score'}: {score}"
    return annotation


def _fig_y(ax, y, fig) -> float:
    return ax.transData.transform((0, y))[1] / fig.bbox.height


def _fig_box(y0, h, ax, fig):
    y_a = _fig_y(ax, y0, fig)
    y_b = _fig_y(ax, y0 + h, fig)
    return (min(y_a, y_b), abs(y_b - y_a))


def draw_mixed_vs_third(fig, axes, mixed, baseline, view, language) -> None:
    """其余条保持对数。01、02 条长 = (额度/03) × 03 的像素长；放不下就在右缘折下。"""
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    tax, rax = axes[0], axes[-1]
    fw, fh = fig.bbox.width, fig.bbox.height
    bars, values, rows = mixed["bars"], mixed["values"], mixed["rows"]
    ref = values[2]
    x0_fig = tax.transData.transform((baseline, 0))[0] / fw
    ref_len = tax.transData.transform((ref, 0))[0] / fw - x0_fig
    right_labels = rax.yaxis.get_ticklabels()
    plot_l = rax.bbox.x0 / fw
    fold_x = 0.968
    x_cap = fold_x

    def add_rect(x, y, w, h, color, alpha=1.0, z=6):
        if w <= 1e-4 or h <= 1e-4:
            return
        fig.add_artist(plt.Rectangle(
            (x, y), w, h, transform=fig.transFigure,
            facecolor=color, alpha=alpha, lw=0, clip_on=False, zorder=z))

    for j in (0, 1):
        def zone_alpha(x_mid, row=j):
            if x_mid < plot_l - 0.002:
                if row < len(right_labels) and right_labels[row].get_window_extent(renderer).width:
                    lab_x0 = right_labels[row].get_window_extent(renderer).x0 / fw
                    if x_mid >= lab_x0 - 0.004:
                        return 0.16
                return 1.0
            return 0.22

        color = VENDOR_COLORS[vendor_of(rows[j]["plan_id"])]
        ratio = values[j] / ref
        target_px = ref_len * ratio * fw
        y_fig, h_fig = _fig_box(bars[j].get_y(), bars[j].get_height(), tax, fig)
        if j < len(right_labels) and right_labels[j].get_window_extent(renderer).width:
            lab_x = right_labels[j].get_window_extent(renderer).x0 / fw - 0.003
        else:
            lab_x = plot_l
        horiz = min(target_px / fw, x_cap - x0_fig)
        drop = max(0.0, (target_px - horiz * fw) / fh)
        cuts = sorted({x0_fig, lab_x, plot_l, x0_fig + horiz})
        cuts = [c for c in cuts if x0_fig - 1e-6 <= c <= x0_fig + horiz + 1e-6]
        for a, b in zip(cuts, cuts[1:]):
            add_rect(a, y_fig, b - a, h_fig, color, zone_alpha((a + b) / 2))
        if drop > 0:
            vx = x0_fig + horiz - h_fig
            add_rect(vx, y_fig - drop, h_fig, drop, color, 1.0, z=7)
            add_rect(vx, y_fig, h_fig, h_fig, color, 1.0, z=7)
        # 只有横条真压到右栏行名时才重描；02 的数字绝不写进槽里
        if drop > 0 and j < len(right_labels):
            lab = right_labels[j]
            bb = lab.get_window_extent(renderer)
            lab.set_alpha(0)
            fig.text(bb.x0 / fw, (bb.y0 + bb.y1) / 2 / fh, lab.get_text(),
                     transform=fig.transFigure, ha="left", va="center",
                     fontsize=10, color="#20252B", zorder=24,
                     fontfamily="Microsoft YaHei")
        ann = annotation_of(rows[j], values[j], view, language, None)
        ann += f"  = {ratio:.1f}×03"
        left_end = tax.bbox.x1 / fw
        if drop > 0:
            fig.text(fold_x + 0.003, max(y_fig - drop, 0.16), ann,
                     transform=fig.transFigure, ha="left", va="top", fontsize=10,
                     fontweight="bold", color="#20252B", zorder=23,
                     bbox=dict(facecolor="white", alpha=0.9, edgecolor="none", pad=1.1))
        else:
            fig.text(left_end - 0.008, y_fig + h_fig / 2, ann,
                     transform=fig.transFigure, ha="right", va="center", fontsize=10,
                     fontweight="bold", color="#20252B", zorder=23,
                     bbox=dict(facecolor="white", alpha=0.88, edgecolor="none", pad=0.8))


def plot(rows: list[dict], view: str, language: str, board: dict | None = None,
         mixed_scale: bool = False) -> None:
    text = TEXT[language]
    values = [monthly_value(r, language) if view == "quotas"
              else float(r["real_usd_per_mtok"]) for r in rows]
    ncols = 1 if board else 2
    half = (len(rows) + ncols - 1) // ncols
    mixed_scale = bool(mixed_scale and view == "quotas" and board is None and ncols == 2)
    mixed = None
    fig, axes = plt.subplots(1, ncols, figsize=(16, 9) if board else (24, 13.5),
                             sharex=True, squeeze=False)
    axes = axes[0]
    if board:
        fig.subplots_adjust(left=0.38, right=0.98, top=0.80, bottom=0.21)
    else:
        fig.subplots_adjust(left=0.205, right=0.928 if mixed_scale else 0.99,
                           top=0.86, bottom=0.148 if mixed_scale else 0.135, wspace=1.04)
    baseline = min(values) * 0.60
    xhi = max(values) * (1.40 if view == "quotas" else (8 if board else 12))

    for col, ax in enumerate(axes):
        start = col * half
        chunk = rows[start:start + half]
        chunk_values = values[start:start + half]
        colors = [VENDOR_COLORS[vendor_of(r["plan_id"])] for r in chunk]
        bars = ax.barh(range(len(chunk)), [v - baseline for v in chunk_values],
                       left=baseline, color=colors, height=0.67)
        if mixed_scale and col == 0:
            for j in (0, 1):
                bars[j].set_visible(False)
            mixed = {"bars": list(bars), "values": chunk_values, "rows": chunk}
        separator = "\n" if board else " · "
        labels = [
            f"{start + i:02d}. " + (plan_name(r, language) if r["billing"] == "metered"
                                   else f"{plan_name(r, language)}{separator}{r['board_variant'] if board else DISPLAY.get(r['served_model'], r['served_model'])}")
            for i, r in enumerate(chunk, 1)
        ]
        ax.set_yticks(range(len(chunk)), labels, fontsize=12 if board else 10)
        ax.tick_params(axis="y", length=0, pad=8)
        ax.set_ylim(half - 0.3, -0.8)
        ax.set_xscale("log")
        ax.set_xlim(baseline, xhi)
        ax.set_xlabel(text[f"{view}_axis"], fontsize=10, labelpad=10)
        ax.set_axisbelow(True)
        ax.grid(axis="x", which="major", color="#E3E6E8", linewidth=0.7)
        ax.tick_params(axis="x", which="minor", length=0)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color("#C3C9CE")
        ax.set_title(f"{start + 1:02d}–{start + len(chunk):02d}  |  {text[f'{view}_order']}",
                     fontsize=11, loc="left", pad=14)
        for j, (bar, value, row) in enumerate(zip(bars, chunk_values, chunk)):
            if mixed_scale and col == 0 and j < 2:
                continue
            ax.text(value * 1.03, bar.get_y() + bar.get_height() / 2,
                    annotation_of(row, value, view, language, board),
                    va="center", fontsize=11 if board else 9.5, color="#20252B",
                    zorder=15 if mixed_scale else 3,
                    bbox=dict(facecolor="white", alpha=0.72, edgecolor="none", pad=1.0))

    title = text[f"{view}_title"]
    if mixed_scale:
        title += " · 混合比例" if language == "zh" else " | mixed scale"
    if board:
        title = ("最高配置参考前沿 · " if language == "zh" else "Top-configuration reference frontier | ") + title
    fig.suptitle(title, fontsize=18 if board else 21, y=0.975, fontweight="bold")
    fig.text(0.5, 0.925 if board else 0.94,
             frontier_caption(board) if board else text[f"{view}_subtitle"],
             ha="center", fontsize=10 if board else 11, color="#505A64")
    providers = {vendor_of(r["plan_id"]) for r in rows}
    legend = [(name, color) for name, color in VENDOR_COLORS.items() if name in providers]
    handles = [plt.Rectangle((0, 0), 1, 1, color=color) for _, color in legend]
    fig.legend(handles, [f"{VENDOR_CODES[name]}  {name}" for name, _ in legend], loc="lower center",
               bbox_to_anchor=(0.5, 0.86 if board else 0.900), ncol=len(legend),
               fontsize=11, frameon=False, handlelength=1.6, columnspacing=1.8)
    if board:
        footnotes = [frontier_rule(language), text["shared"], text["footer"], exchange_note(language)]
        for y, note in zip((0.115, 0.085, 0.055, 0.025), footnotes):
            fig.text(0.5, y, note, ha="center", fontsize=8, color="#505A64")
    else:
        y0 = 0.082 if mixed_scale else 0.068
        if mixed_scale:
            fig.text(0.5, 0.096, text["mixed_note"], ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0, text["footer"], ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0 - 0.018, text["shared"], ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0 - 0.036, evidence_note(language), ha="center", fontsize=9, color="#505A64")
        fig.text(0.5, y0 - 0.054, exchange_note(language), ha="center", fontsize=9, color="#505A64")
    if mixed:
        draw_mixed_vs_third(fig, axes, mixed, baseline, view, language)
    stem = output_stem(view, board, language) + ("_混合比例" if mixed_scale else "")
    for ext in ("png", "svg"):
        fig.savefig(os.path.join(OUT_DIR, f"{stem}.{ext}"), dpi=160)
    plt.close(fig)
    print(f"wrote {len(rows)} rows -> {stem}.png/.svg")


def main() -> None:
    with open(ADOPTED, encoding="utf-8-sig") as f:
        rows = [r for r in csv.DictReader(f) if r["real_usd_per_mtok"]]
    os.makedirs(OUT_DIR, exist_ok=True)
    for view in ("quotas", "prices"):
        ordered = sorted_rows(rows, view)
        for language in ("zh", "en"):
            write_text_table(ordered, view, language)
            plot(ordered, view, language)
            if view == "quotas":
                plot(ordered, view, language, mixed_scale=True)
    with open(os.path.join(ROOT, "derived", "points.json"), encoding="utf-8") as f:
        data = json.load(f)
    selections = {}
    for board_id, meta in data["boards"].items():
        board = {**meta, "id": board_id}
        selected = frontier_rows(rows, data["points"], board_id)
        selections[board_id] = {
            **meta,
            "frontier": [{"id": f"{r['plan_id']}::{r['served_model']}", "model": r["served_model"],
                          "price_usd_per_mtok": float(r["real_usd_per_mtok"]),
                          "score": r["board_score"], "variant": r["board_variant"],
                          "confidence": r["confidence"]} for r in sorted_rows(selected, "prices")],
            "unscored": [p["id"] for p in data["points"] if p.get(f"{board_id}__score") is None],
        }
        for view in ("quotas", "prices"):
            ordered = sorted_rows(selected, view)
            if not ordered:
                continue
            for language in ("zh", "en"):
                write_text_table(ordered, view, language, board)
                plot(ordered, view, language, board)
    with open(os.path.join(OUT_DIR, "前沿筛选结果.json"), "w", encoding="utf-8") as f:
        json.dump({"criterion": frontier_rule("en"), "boards": selections}, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
