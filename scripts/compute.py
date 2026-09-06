# -*- coding: utf-8 -*-
"""adopted.csv × 榜单分数 × 官方标价 → derived/points.csv + points.json。

每个点 = (套餐, 实际服务模型)。x = 真实单价 $/MTok；y = 该模型在各榜单的分数（同模型多个 effort 变体取最高分）。
d = 真实单价 / 标价混合单价（标价按实测 agent 负载分布折算），只作注释，不进图。
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, RESEARCH, OUT = ROOT / "data", ROOT / "data" / "research", ROOT / "derived"

MIX = dict(cache=406_477_401 / 416_989_306, input=9_040_062 / 416_989_306, output=1_471_843 / 416_989_306)
BOARDS = ("arena_code", "arena_agent_mode", "aa_intelligence_index", "aa_coding_agent_index")
SCORE_FILES = (
    "scores-2026-09.json",
    "scores-code-arena-round1-2026-09-06.json",
    "scores-aa-coding-agent-round1-2026-09-06.json",
)


def score_archives():
    return [json.loads((RESEARCH / name).read_text(encoding="utf-8"))
            for name in SCORE_FILES if (RESEARCH / name).exists()]

DISPLAY = {
    "gpt-5.6-sol": "GPT 5.6 Sol", "gpt-5.6-terra": "GPT 5.6 Terra", "gpt-5.6-luna": "GPT 5.6 Luna", "gpt-5.5": "GPT 5.5",
    "claude-opus-5": "Claude Opus 5", "claude-fable-5": "Claude Fable 5", "claude-sonnet-5": "Claude Sonnet 5", "claude-opus-4.8": "Claude Opus 4.8",
    "grok-4.6": "Grok 4.6", "grok-4.5": "Grok 4.5", "kimi-k3": "Kimi K3", "kimi-k2.7-code": "Kimi K2.7 Code",
    "glm-5.3": "GLM 5.3", "glm-5.3-flash": "GLM 5.3 Flash", "minimax-m3": "MiniMax M3", "minimax-m2.7": "MiniMax M2.7",
    "qwen3.7-plus": "Qwen3.7 Plus", "deepseek-v4-flash": "DeepSeek V4 Flash", "deepseek-v4-pro": "DeepSeek V4 Pro",
    "gemini-3.1-pro": "Gemini 3.1 Pro", "gemini-3.7-flash": "Gemini 3.7 Flash", "mimo-v2.5-pro": "MiMo V2.5 Pro",
    "hy3": "Hy3", "hy4-preview": "Hy4 preview", "composer-2.5": "Composer 2.5",
}
VENDOR = {
    "gpt": "OpenAI", "claude": "Anthropic", "grok": "xAI", "kimi": "Kimi", "glm": "Zhipu", "minimax": "MiniMax",
    "qwen": "Alibaba", "deepseek": "DeepSeek", "gemini": "Google", "mimo": "Xiaomi", "hy": "Tencent", "composer": "Cursor",
}


def vendor_of(model: str) -> str:
    return next((v for k, v in VENDOR.items() if model.startswith(k)), "other")


def load_scores() -> dict[str, dict[str, dict]]:
    """board -> model -> best {score, variantLabel, secondary}"""
    best: dict[str, dict[str, dict]] = {b: {} for b in BOARDS}
    for s in (s for archive in score_archives() for s in archive["scores"]):
        b, m = s["boardId"], s["model"]
        if b in best and (m not in best[b] or s["score"] > best[b][m]["score"]):
            best[b][m] = s
    return best


def load_list_blended() -> dict[str, float]:
    out = {}
    for m in json.loads((RESEARCH / "list-prices-2026-09.json").read_text(encoding="utf-8"))["models"]:
        cached = m["cachedInput"] if m["cachedInput"] is not None else m["input"] * 0.1
        out[m["model"]] = MIX["cache"] * cached + MIX["input"] * m["input"] + MIX["output"] * m["output"]
    return out


def main() -> None:
    scores, list_blended = load_scores(), load_list_blended()
    boards_meta = {b["boardId"]: b for archive in score_archives() for b in archive["boards"]}

    points = []
    with (DATA / "adopted.csv").open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            model = r["served_model"]
            real = float(r["real_usd_per_mtok"])
            lb = list_blended.get(model)
            p = dict(
                id=f"{r['plan_id']}::{model}", plan=r["plan_name"], billing=r["billing"], model=model,
                model_display=DISPLAY.get(model, model), vendor=vendor_of(model),
                label=r["plan_name"] if r["billing"] == "metered" else f"{DISPLAY.get(model, model)} · {r['plan_name']}",
                price_usd=float(r["price_usd"]) if r["price_usd"] else None,
                monthly_yi=float(r["monthly_yi"]) if r["monthly_yi"] else None,
                real_usd_per_mtok=real, list_blended_usd_per_mtok=round(lb, 4) if lb else None,
                d=round(real / lb, 4) if lb else None, confidence=r["confidence"], tier=r["chart_tier"], source=r["source"], note=r["decision_note"],
            )
            for b in BOARDS:
                s = scores[b].get(model)
                p[f"{b}__score"] = s["score"] if s else None
                p[f"{b}__variant"] = s["variantLabel"] if s else None
            points.append(p)

    OUT.mkdir(exist_ok=True)
    with (OUT / "points.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(points[0].keys()))
        w.writeheader()
        w.writerows(points)
    (OUT / "points.json").write_text(json.dumps(dict(
        generatedAt="2026-09-06", mix={k: round(v, 4) for k, v in MIX.items()},
        boards={b: dict(name=boards_meta[b]["name"].replace("🏆 ", ""), metric=boards_meta[b]["metric"], url=boards_meta[b]["url"], snapshot=boards_meta[b]["snapshotDate"]) for b in BOARDS},
        points=points,
    ), ensure_ascii=False, indent=1), encoding="utf-8")

    unscored = {b: sorted({p["label"] for p in points if p[f"{b}__score"] is None}) for b in BOARDS}
    print(f"{len(points)} points -> {OUT}")
    for b in BOARDS:
        print(f"  {b}: {sum(p[f'{b}__score'] is not None for p in points)} scored, unscored: {unscored[b]}")


if __name__ == "__main__":
    main()
