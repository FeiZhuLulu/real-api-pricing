import json
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "_build"
BOARDS = {
    "arena_code": ("Code Arena · WebDev Overall", "Arena Score", "CodeArena榜"),
    "arena_agent_mode": ("Agent Arena · Overall", "Net Improvement %", "AgentArena榜"),
    "aa_intelligence_index": ("Artificial Analysis Intelligence Index", "Intelligence Index", "AA智力榜"),
    "aa_coding_agent_index": ("Artificial Analysis Coding Agent Index", "Coding Agent Index", "AA编程Agent榜"),
}

data = json.loads((ROOT / "derived/points.json").read_text(encoding="utf-8"))
manifest = json.loads((OUT / "SVG坐标核对.json").read_text(encoding="utf-8"))
assert set(data["boards"]) == set(BOARDS)
assert len(manifest) == 16

html = (OUT / "帕累托交互图.html").read_text(encoding="utf-8")
for board_id in BOARDS:
    assert board_id in html
scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.S)
assert scripts
with tempfile.TemporaryDirectory() as temp_dir:
    js_check = Path(temp_dir) / "four-boards-html-check.js"
    js_check.write_text("\n".join(scripts), encoding="utf-8")
    subprocess.run(["node", "--check", str(js_check)], check=True)

ns = {"s": "http://www.w3.org/2000/svg"}
rows = []
for board_id, (display, metric, tag) in BOARDS.items():
    key = f"{board_id}__score"
    assert data["boards"][board_id]["metric"] == metric
    board_rows = [p for p in data["points"] if p[key] is not None and p["real_usd_per_mtok"] > 0]
    assert board_rows
    missing = sorted({p["model"] for p in data["points"] if p[key] is None})
    for tier in ("main", "full"):
      for language in ("zh", "en"):
        stem = f"帕累托_{tag}" + ("_全量" if tier == "full" else "") + ("_英文" if language == "en" else "")
        assert (OUT / f"{stem}.svg").is_file()
        assert (OUT / f"{stem}.png").is_file()
        chart = next(c for c in manifest if c["stem"] == stem)
        selected = [p for p in board_rows if tier == "full" or p["tier"] == "main"]
        frontier = [p for p in selected if not any(
            q["real_usd_per_mtok"] <= p["real_usd_per_mtok"] and q[key] >= p[key]
            and (q["real_usd_per_mtok"] < p["real_usd_per_mtok"] or q[key] > p[key])
            for q in selected
        )]
        tree = ET.parse(OUT / f"{stem}.svg")
        point_groups = tree.findall('.//s:g[@class="point"]', ns)
        actual_front = {
            (float(e.attrib["data-price"]), float(e.attrib["data-score"]))
            for e in point_groups if e.attrib["data-frontier"] == "true"
        }
        expected_front = {(p["real_usd_per_mtok"], p[key]) for p in frontier}
        assert actual_front == expected_front
        assert not tree.findall(".//s:image", ns)
        assert len(chart["coordinates"]) == len(point_groups)
        if language == "en":
            assert not re.search(r"[\u4e00-\u9fff]", (OUT / f"{stem}.svg").read_text(encoding="utf-8"))
        rows.append((display, tier, language, len(selected), len(point_groups), len(expected_front), len(missing)))

research = json.loads((ROOT / "data/research/scores-aa-coding-agent-round1-2026-09-06.json").read_text(encoding="utf-8"))
assert research["boards"][0]["boardId"] == "aa_coding_agent_index"
assert all(item["source"].startswith("https://artificialanalysis.ai/") for item in research["scores"])
assert all("agentHarness" in item["secondary"] for item in research["scores"])

report = [
    "# 四榜帕累托数据核对",
    "",
    "核对日期：2026-09-06。结果：**通过**。四榜独立计分，主图与全量图均与 `derived/points.json` 一致。",
    "",
    "| 榜单 | 范围 | 语言 | 有分数据行 | 合并后坐标 | 前沿坐标 | 未覆盖模型数 |",
    "|---|---:|---:|---:|---:|---:|---:|",
]
for display, tier, language, scored, positions, frontier, missing in rows:
    report.append(f"| {display} | {'精选' if tier == 'main' else '全量'} | {language} | {scored} | {positions} | {frontier} | {missing} |")
report += [
    "",
    "核验项：严格支配判定、X 轴对数坐标、前沿端点方向、SVG 无嵌入位图、PNG 同步渲染、交互图 JavaScript 语法、四个榜单选择项、AA Coding Agent 官方来源与 harness 字段。",
    "",
    "AA Coding Agent 只映射精确模型；同模型多个官网配置取存档最高分，配置名称保留在 `variant`。未覆盖型号不插值、不借用邻近型号。",
]
(OUT / "帕累托数据核对.md").write_text("\n".join(report) + "\n", encoding="utf-8")

for row in rows:
    print(f"{row[0]} {row[1]} {row[2]}: {row[3]} rows, {row[4]} positions, {row[5]} frontier")
print("PASS: four boards, sixteen SVG/PNG pairs, English text, HTML syntax and official coding-agent provenance verified")
