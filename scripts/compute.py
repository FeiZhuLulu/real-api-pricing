# -*- coding: utf-8 -*-
"""adopted.csv × 榜单分数 × 官方标价 → derived/points.csv + points.json。

每个点 = (套餐, 实际服务模型)。x = 真实单价 $/MTok；y = 该模型在各榜单的分数（同模型多个 effort 变体取最高分）。
d = 真实单价 / 标价混合单价（标价按项目统一标准负载折算），只作注释，不进图。
"""
from __future__ import annotations

import csv
import json
from pathlib import Path
from benchmark_configs import configuration, candidates, score_fields

ROOT = Path(__file__).resolve().parent.parent
DATA, RESEARCH, OUT = ROOT / "data", ROOT / "data" / "research", ROOT / "derived"
CONVENTIONS = json.loads((DATA / "conventions.json").read_text(encoding="utf-8"))
STANDARD_MIX = CONVENTIONS["standardTokenMix"]
# terminal_bench_4 只收 tbench.ai 官方 harness 行（含厂商自报附录行）；
# AA 自家 harness 的 TB4 运行拆到 aa_terminal_bench_4（benchmark_configs.configuration 路由）。
BOARDS = ("aa_intelligence_index", "terminal_bench_4", "aa_terminal_bench_4", "arena_code", "arena_agent_mode", "aa_coding_agent_index", "open_design_arena", "deepswe_1_1")
SCORE_FILES = (
    "scores-2026-09.json",
    "scores-code-arena-round1-2026-09-06.json",
    "scores-aa-coding-agent-round1-2026-09-06.json",
    "scores-aa-round3-2026-09-09.json",
    "scores-aa-intelligence-2026-09-12.json",
    "scores-aa-round4-2026-09-22.json",
    "scores-open-design-round1-2026-09-09.json",
    "scores-terminal-bench4-round1-2026-09-10.json",
    "scores-terminal-bench4-round2-selfreport-2026-09-12.json",
    "scores-deepswe-1.1-2026-09-12.json",
    "scores-deepswe-selfreport-2026-09-12.json",
    "scores-stepfun-step5-round1-2026-09-21.json",
    "scores-grok47-round1-2026-09-22.json",
    "scores-mimo-v26-grok47-round1-2026-09-22.json",
    "scores-deepswe-mimo-v26-grok47-selfreport-2026-09-22.json",
    "scores-opus55-selfreport-2026-09-23.json",
    "scores-new-models-round1-2026-09-23.json",
    "scores-gpt6sol-round1-2026-09-24.json",
    "scores-gpt6luna-round1-2026-09-25.json",
)
LIST_PRICE_FILES = (
    "list-prices-2026-09.json",
    "list-prices-deepseek-v41-round1-2026-09-09.json",
    "list-prices-deepseek-v41-round2-2026-09-10.json",
    "list-prices-stepfun-round1-2026-09-10.json",
    "list-prices-stepfun-round2-2026-09-21.json",
    "list-prices-mimo-v26-grok47-round1-2026-09-22.json",
)


def score_archives():
    return [json.loads((RESEARCH / name).read_text(encoding="utf-8"))
            for name in SCORE_FILES if (RESEARCH / name).exists()]

DISPLAY = {
    "gpt-5.6-sol": "GPT 5.6 Sol", "gpt-5.6-terra": "GPT 5.6 Terra", "gpt-5.6-luna": "GPT 5.6 Luna", "gpt-5.5": "GPT 5.5", "gpt-6-astra": "GPT-6 Astra", "gpt-6-sol": "GPT-6 Sol", "gpt-6-luna": "GPT-6 Luna",
    "claude-opus-5": "Claude Opus 5", "claude-opus-5.5": "Claude Opus 5.5", "claude-fable-5": "Claude Fable 5", "claude-fable-5.1": "Claude Fable 5.1", "claude-sonnet-5": "Claude Sonnet 5", "claude-opus-4.8": "Claude Opus 4.8",
    "grok-4.6": "Grok 4.6", "grok-4.7": "Grok 4.7", "grok-4.5": "Grok 4.5", "kimi-k3": "Kimi K3", "kimi-k2.7-code": "Kimi K2.7 Code", "kimi-k2.6": "Kimi K2.6",
    "glm-5.3": "GLM 5.3", "glm-5.3-flash": "GLM 5.3 Flash", "glm-5.2": "GLM 5.2", "glm-5.1": "GLM 5.1",
    "minimax-m3": "MiniMax M3", "minimax-m2.7": "MiniMax M2.7", "minimax-m2.5": "MiniMax M2.5",
    "qwen3.8-max": "Qwen3.8 Max", "qwen3.8-flash": "Qwen3.8 Flash", "qwen3.7-max": "Qwen3.7 Max",
    "qwen3.7-plus": "Qwen3.7 Plus", "qwen3.6-plus": "Qwen3.6 Plus",
    "deepseek-v4.1-flash": "DeepSeek V4.1 Flash", "deepseek-v4-flash": "DeepSeek V4 Flash", "deepseek-v4-flash-fast": "DeepSeek V4 Flash Fast", "deepseek-v4-pro": "DeepSeek V4 Pro",
    "deepseek-v4-flash-vision-exp": "DeepSeek V4 Flash Vision Exp",
    "gemini-3.1-pro": "Gemini 3.1 Pro", "gemini-3.7-flash": "Gemini 3.7 Flash", "gemini-3.8-flash": "Gemini 3.8 Flash",
    "mimo-v2.5": "MiMo V2.5", "mimo-v2.5-pro": "MiMo V2.5 Pro", "mimo-v2.6-pro": "MiMo V2.6 Pro", "mimo-v2.6-flash": "MiMo V2.6 Flash",
    "mimo-v2.6-pro-ultraspeed": "MiMo V2.6 Pro UltraSpeed", "longcat-2.0": "LongCat 2.0",
    "muse-spark-1.3": "Muse Spark 1.3", "muse-spark-1.3-contributor": "Muse Spark 1.3 Contributor",
    "muse-spark-1.2": "Muse Spark 1.2", "muse-spark-1.2-contributor": "Muse Spark 1.2 Contributor",
    "glm-5.2-fast": "GLM 5.2 Fast", "inkling": "Inkling", "inkling-small": "Inkling Small",
    "kimi-k2.7-code-highspeed": "Kimi K2.7 Code HighSpeed", "nemotron-3-ultra": "Nemotron 3 Ultra",
    "qwen3.8-27b": "Qwen3.8 27B", "qwen3.8-max-0902": "Qwen3.8 Max 0902",
    "step-3.5-flash": "Step 3.5 Flash", "step-3.7-flash": "Step 3.7 Flash", "step-5-preview": "Step 5 Preview",
    "hy3": "Hy3", "hy4-preview": "Hy4 Preview", "omen-alpha": "Omen Alpha", "composer-2.5": "Composer 2.5",
    "swe-2": "SWE-2",
}
VENDOR = {
    "gpt": "OpenAI", "claude": "Anthropic", "grok": "xAI", "kimi": "Kimi", "glm": "Zhipu", "minimax": "MiniMax",
    "qwen": "Alibaba", "deepseek": "DeepSeek", "gemini": "Google", "mimo": "Xiaomi", "hy": "Tencent", "composer": "Cursor",
    "longcat": "Meituan", "muse": "Muse", "omen": "OpenCode", "step": "StepFun", "swe": "Cognition",
}


def vendor_of(model: str) -> str:
    return next((v for k, v in VENDOR.items() if model.startswith(k)), "other")


def load_scores() -> list[dict]:
    """Keep all configurations in each board's selected snapshot, never mix versions."""
    archives = [(name, json.loads((RESEARCH / name).read_text(encoding="utf-8")))
                for name in SCORE_FILES]
    return [configuration(record, name) for name, record in current_score_records(archives)]


def current_score_records(archives):
    # Files are explicitly ordered oldest to newest. A complete new board snapshot
    # replaces that board as a whole, including models removed from its coverage.
    # Archives flagged "supplement" only append rows (e.g. vendor self-reports) to the
    # current snapshot and never replace it.
    latest = {b["boardId"]: name for name, archive in archives for b in archive["boards"]
              if b["boardId"] in BOARDS and not archive.get("supplement")}
    return [(name, record) for name, archive in archives for record in archive["scores"]
            if latest.get(record["boardId"]) == name or (
                archive.get("supplement") and (
                    "baseSnapshot" not in archive
                    or archive["baseSnapshot"] == latest.get(record["boardId"])
                )
            )]


def load_list_prices() -> dict[str, dict]:
    out = {}
    for name in LIST_PRICE_FILES:
        for m in json.loads((RESEARCH / name).read_text(encoding="utf-8"))["models"]:
            cached = m["cachedInput"] if m["cachedInput"] is not None else m["input"] * 0.1
            rate = CONVENTIONS["usdPerCny"] if m["currency"] == "CNY" else 1
            out[m["model"]] = dict(
                cached=cached, input=m["input"], output=m["output"], currency=m["currency"],
                blended_usd=(STANDARD_MIX["cache"] * cached + STANDARD_MIX["input"] * m["input"] + STANDARD_MIX["output"] * m["output"]) / rate,
            )
    return out


def main() -> None:
    scores, list_prices = load_scores(), load_list_prices()
    boards_meta = {b["boardId"]: b for archive in score_archives() if not archive.get("supplement") for b in archive["boards"]}
    # supplement 档案可以声明新榜（如 aa_terminal_bench_4）的元数据；已存在榜仍以快照档为准。
    for archive in score_archives():
        if archive.get("supplement"):
            for b in archive["boards"]:
                boards_meta.setdefault(b["boardId"], b)

    points, configuration_points = [], []
    with (DATA / "adopted.csv").open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            model = r["served_model"]
            real = float(r["real_usd_per_mtok"])
            lp = list_prices.get(model)
            lb = lp["blended_usd"] if lp else None
            plan_en = r.get("plan_name_en") or None
            gen = r.get("plan_gen") or ""
            gen_tag = f" ({gen})" if gen else ""
            p = dict(
                id=f"{r['plan_id']}::{model}", plan=r["plan_name"], plan_en=plan_en, billing=r["billing"], model=model,
                model_display=DISPLAY.get(model, model) + gen_tag, plan_gen=gen, vendor=vendor_of(model),
                local_price=f"¥{r['price']}" if plan_en and r["currency"] == "CNY" else None,
                label=r["plan_name"] if r["billing"] == "metered" else f"{DISPLAY.get(model, model)}{gen_tag} · {r['plan_name']}",
                workload=r.get("workload") or "",
                list_price={k: lp[k] for k in ("cached", "input", "output", "currency")} if lp else None,
                price_usd=float(r["price_usd"]) if r["price_usd"] else None,
                monthly_yi=float(r["monthly_yi"]) if r["monthly_yi"] else None,
                real_usd_per_mtok=real, list_blended_usd_per_mtok=round(lb, 4) if lb else None,
                d=round(real / lb, 4) if lb else None, confidence=r["confidence"], tier=r["chart_tier"], source=r["source"], note=r["decision_note"],
                unmetered=r.get("unmetered") == "true", promo_until=r.get("promo_until") or None,
            )
            for b in BOARDS:
                options = candidates(r, scores, b)
                # Explicit optional summary projection; full configuration rows are also published.
                selected = max(options, key=lambda s: s["score"], default=None)
                p[f"{b}__selection"] = "highest_archived_reference" if selected else None
                p[f"{b}__configuration_count"] = len(options)
                for field, value in score_fields(selected).items():
                    p[f"{b}__{field}"] = value
                for option in options:
                    configuration_points.append(dict(point_id=p["id"], board=b, **score_fields(option)))
            points.append(p)

    OUT.mkdir(exist_ok=True)
    (OUT / "benchmark-configurations.json").write_text(json.dumps(scores, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "benchmark-points.json").write_text(json.dumps(configuration_points, ensure_ascii=False, indent=2), encoding="utf-8")
    for name, records in (("benchmark-configurations", scores), ("benchmark-points", configuration_points)):
        with (OUT / (name + ".csv")).open("w", encoding="utf-8-sig", newline="") as f:
            fields = [k for k in records[0] if k != "raw_record"]
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(records)
    with (OUT / "points.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(points[0].keys()))
        w.writeheader()
        w.writerows(points)
    (OUT / "points.json").write_text(json.dumps(dict(
        generatedAt=CONVENTIONS["updatedAt"], mix={k: round(v, 4) for k, v in STANDARD_MIX.items() if isinstance(v, (int, float))},
        boards={b: dict(name=boards_meta[b]["name"].replace("🏆 ", ""), metric=boards_meta[b]["metric"], url=boards_meta[b]["url"], snapshot=boards_meta[b]["snapshotDate"]) for b in BOARDS},
        points=points,
    ), ensure_ascii=False, indent=1), encoding="utf-8")

    unscored = {b: sorted({p["label"] for p in points if p[f"{b}__score"] is None}) for b in BOARDS}
    print(f"{len(points)} points -> {OUT}")
    for b in BOARDS:
        print(f"  {b}: {sum(p[f'{b}__score'] is not None for p in points)} scored, unscored: {unscored[b]}")


if __name__ == "__main__":
    main()
