from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, DERIVED = ROOT / "data", ROOT / "derived"
READMES = (ROOT / "README.md", ROOT / "README.zh.md")
MARKER = re.compile(r"<!--\s*stat:([A-Za-z0-9_]+)\s*-->(.*?)<!--\s*/stat\s*-->")


def compute_stats() -> dict[str, str]:
    with open(DATA / "adopted.csv", encoding="utf-8-sig", newline="") as f:
        adopted = list(csv.DictReader(f))
    points = json.loads((DERIVED / "points.json").read_text(encoding="utf-8"))
    configurations = json.loads((DERIVED / "benchmark-configurations.json").read_text(encoding="utf-8"))
    references = json.loads((DERIVED / "benchmark-points.json").read_text(encoding="utf-8"))

    stats: dict[str, int | str] = {
        "snapshot": points["generatedAt"],
        "points_total": len(adopted),
        "points_allowance": sum(1 for r in adopted if r["billing"] == "subscription" and r["monthly_tokens"] != ""),
        "points_unmetered": sum(1 for r in adopted if r.get("unmetered") == "true"),
        "points_metered": sum(1 for r in adopted if r["billing"] == "metered"),
        "points_priced": sum(1 for r in adopted if float(r["real_usd_per_mtok"]) > 0),
        "plans_opencode_go": sum(1 for r in adopted if r["plan_id"].startswith("opencode_go")),
        "plans_command_code_goat": sum(1 for r in adopted if r["plan_id"].startswith("command_code_goat")),
        "plans_ollama": sum(1 for r in adopted if r["plan_id"].startswith("ollama_")),
        "plans_step_plan": sum(1 for r in adopted if r["plan_id"].startswith("stepfun_")),
        "configs_total": len(configurations),
        "refs_total": len(references),
    }
    for board in points["boards"]:
        stats[f"scored_{board}"] = sum(1 for p in points["points"] if p[f"{board}__score"] is not None)
    mapped_ids = {r["configuration_id"] for r in references}
    for board in points["boards"]:
        configs = [c for c in configurations if c["board"] == board]
        stats[f"configs_{board}"] = len(configs)
        stats[f"configs_mapped_{board}"] = sum(1 for c in configs if c["configuration_id"] in mapped_ids)
        stats[f"models_{board}"] = len({c["model"] for c in configs})
    return {name: str(value) for name, value in stats.items()}


def rewrite(path: Path, stats: dict[str, str], check: bool, stale: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    unknown = []

    def replace(m: re.Match) -> str:
        name = m.group(1)
        if name not in stats:
            unknown.append(f"{path.name}: unknown stat marker {name!r}")
            return m.group(0)
        if m.group(2) != stats[name]:
            stale.append(f"{path.name}: {name} is {m.group(2)!r}, should be {stats[name]!r}")
        return m.group(0)[: m.start(2) - m.start(0)] + stats[name] + m.group(0)[m.end(2) - m.start(0):]

    updated = MARKER.sub(replace, text)
    if unknown:
        sys.exit("\n".join(unknown))
    if not check and updated != text:
        path.write_text(updated, encoding="utf-8", newline="\n")


def main() -> None:
    check = "--check" in sys.argv[1:]
    stats = compute_stats()
    stale: list[str] = []
    for path in READMES:
        rewrite(path, stats, check, stale)
    if check:
        if stale:
            print("stale README stat markers:")
            print("\n".join(stale))
            sys.exit(1)
        print("PASS: all README stat markers are up to date")
    else:
        print(f"readme_stats: {len(stale)} marker(s) updated across {len(READMES)} files")


if __name__ == "__main__":
    main()
