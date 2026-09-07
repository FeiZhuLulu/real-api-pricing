"""Check lossless records, exact modes, explicit mappings and unchanged price inputs."""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from compute import SCORE_FILES, BOARDS
from benchmark_configs import candidates, configuration

def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

configs = read("derived/benchmark-configurations.json")
links = read("derived/benchmark-points.json")
points = read("derived/points.json")["points"]
expected = [(file, record) for file in SCORE_FILES
            for record in read("data/research/" + file)["scores"] if record["boardId"] in BOARDS]
assert len(configs) == len(expected)
assert len({c["configuration_id"] for c in configs}) == len(configs)
for c, (file, record) in zip(configs, expected):
    assert c["archive"] == file and c["raw_record"] == record
    sec = record.get("secondary", {})
    assert c["mean_cost_usd_per_task"] == sec.get("meanCostUsdPerTask")
    assert c["median_cost_usd_per_task"] == sec.get("medianCostPerTaskUsd")
    assert c["score_low"] == (record["score"] - sec["ciMinus"] if "ciMinus" in sec else None)
    assert c["score_high"] == (record["score"] + sec["ciPlus"] if "ciPlus" in sec else None)

adopted = list(csv.DictReader((ROOT / "data/adopted.csv").open(encoding="utf-8-sig")))
indexed = {p["id"]: p for p in points}
by_id = {c["configuration_id"]: c for c in configs}
expected_links = set()
for row in adopted:
    pid = row["plan_id"] + "::" + row["served_model"]
    p = indexed[pid]
    assert p["real_usd_per_mtok"] == float(row["real_usd_per_mtok"])
    for board in BOARDS:
        matches = candidates(row, configs, board)
        expected_links.update((pid, board, c["configuration_id"]) for c in matches)
        assert p[board + "__configuration_count"] == len(matches)
        assert p[board + "__score"] == max((c["score"] for c in matches), default=None)
        if matches:
            selected = by_id[p[board + "__configuration_id"]]
            assert selected in matches
            assert p[board + "__variant"] == selected["variant"]
assert expected_links == {(p["point_id"], p["board"], p["configuration_id"]) for p in links}
assert len(expected_links) == len(links)
assert all(p["mapping_note"] and p["mapping_confidence"] and p["quota_effort_matched"] is None for p in links)

# Removing a mode must leave that mode unscored, never borrow the other mode.
composer = [c for c in configs if c["model"] == "composer-2.5"]
for mode in ("standard", "fast"):
    row = dict(served_model="composer-2.5", plan_id="cursor_ultra" + ("_composer_fast" if mode == "fast" else ""))
    assert candidates(row, composer, "aa_coding_agent_index")
    assert not candidates(row, [c for c in composer if c["service_mode"] != mode], "aa_coding_agent_index")
unknown = configuration(dict(boardId="arena_code", model="unknown", variantLabel="unknown-preview", score=1), "test")
assert unknown["reasoning_effort"] is None and unknown["agent_harness"] is None
assert unknown["score_low"] is None and unknown["mean_cost_usd_per_task"] is None
unknown_mode = configuration(dict(boardId="aa_coding_agent_index", model="composer-2.5", variantLabel="Cursor CLI - Composer 2.5 Turbo", score=99), "test")
assert unknown_mode["service_mode"] is None
assert not candidates(dict(served_model="composer-2.5", plan_id="cursor_ultra"), [unknown_mode], "aa_coding_agent_index")
assert configuration(dict(boardId="arena_code", model="a", variantLabel="a-xHigh (codex-harness)", score=1), "test")["reasoning_effort"] == "xhigh"
print(f"PASS: {len(configs)} configurations preserved, {len(links)} explicit mappings, exact modes, source CIs/costs and price inputs verified")
