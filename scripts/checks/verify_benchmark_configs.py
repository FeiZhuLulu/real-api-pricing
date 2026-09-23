"""Check lossless records, exact modes, explicit mappings and unchanged price inputs."""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from compute import SCORE_FILES, BOARDS, current_score_records
from benchmark_configs import candidates, configuration

def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

configs = read("derived/benchmark-configurations.json")
links = read("derived/benchmark-points.json")
points = read("derived/points.json")["points"]
expected = current_score_records([(file, read("data/research/" + file)) for file in SCORE_FILES])
# Updating a benchmark replaces the full snapshot, even when a removed model had
# a higher old score. Other boards and all efforts of the new snapshot survive.
old = {"boards": [{"boardId": "aa_intelligence_index"}, {"boardId": "arena_code"}],
       "scores": [{"boardId": "aa_intelligence_index", "model": "removed", "score": 99},
                  {"boardId": "arena_code", "model": "keep", "score": 1000}]}
new = {"boards": [{"boardId": "aa_intelligence_index"}],
       "scores": [{"boardId": "aa_intelligence_index", "model": "new", "score": 40},
                  {"boardId": "aa_intelligence_index", "model": "new", "score": 30}]}
assert current_score_records([("old", old), ("new", new)]) == [
    ("old", old["scores"][1]), *(('new', r) for r in new["scores"])]
assert current_score_records([("old", old), ("empty", {"boards": new["boards"], "scores": []})]) == [
    ("old", old["scores"][1])]
assert len(configs) == len(expected)
supplement = {"boards": new["boards"], "supplement": True, "baseSnapshot": "old",
              "scores": [{"boardId": "aa_intelligence_index", "model": "new", "score": 90}]}
assert ("extra", supplement["scores"][0]) in current_score_records([("old", old), ("extra", supplement)])
assert current_score_records([("old", old), ("extra", supplement), ("new", new)]) == current_score_records([
    ("old", old), ("new", new)])
assert current_score_records([("old", old), ("extra", supplement),
                              ("empty", {"boards": new["boards"], "scores": []})]) == [("old", old["scores"][1])]
assert len({c["configuration_id"] for c in configs}) == len(configs)
for c, (file, record) in zip(configs, expected):
    assert c["archive"] == file and c["raw_record"] == record
    sec = record.get("secondary", {})
    assert c["score_is_estimated"] == sec.get("intelligenceIndexIsEstimated", record.get("scoreIsEstimated"))
    assert c["mean_cost_usd_per_task"] == sec.get("meanCostUsdPerTask", sec.get("cost"))
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
# Synthetic fixtures: AA Coding Agent Index v1.5 dropped Cursor CLI, so no live
# configuration carries a service mode any more. The rule still governs the six
# Composer rows in adopted.csv, which keep their price and allowance but score
# nowhere until a board covers Composer again.
composer = [configuration(dict(boardId="aa_coding_agent_index", model="composer-2.5",
                               variantLabel=label, score=38.3008), "test")
            for label in ("Cursor CLI - Composer 2.5", "Cursor CLI - Composer 2.5 Fast")]
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
open_design = [c for c in configs if c["board"] == "open_design_arena"]
assert len(open_design) == 13 and all(c["agent_harness"] == "OpenDesign" for c in open_design)
assert {c["model"] for c in open_design} >= {"gpt-5.6-sol", "deepseek-v4-flash", "claude-fable-5.1"}
assert not candidates(dict(served_model="claude-fable-5", plan_id="claude_max"), open_design, "open_design_arena")
assert all(c["mean_cost_usd_per_task"] is not None for c in open_design)
assert indexed["deepseek_v41_flash_offpeak::deepseek-v4.1-flash"]["real_usd_per_mtok"] == 0.00966
assert indexed["deepseek_v41_flash_peak::deepseek-v4.1-flash"]["real_usd_per_mtok"] == 0.01932
assert indexed["deepseek_v41_flash_offpeak::deepseek-v4.1-flash"]["open_design_arena__score"] == 81.2
# AA round4 (2026-09-22) superseded round3, so the round3-pinned intelligence
# supplement retired and these two scores now come from round4 itself.
assert indexed["opencode_go::deepseek-v4.1-flash"]["aa_intelligence_index__score"] == 39.4562
assert indexed["opencode_go::deepseek-v4.1-flash"]["terminal_bench_4__score"] == 31.2
assert indexed["opencode_go::deepseek-v4.1-flash"]["terminal_bench_4__score_is_self_reported"] is True
assert indexed["chatgpt_plus::gpt-6-astra"]["aa_intelligence_index__score"] == 52.6737
assert indexed["chatgpt_plus::gpt-6-astra"]["aa_intelligence_index__configuration_count"] == 5
print(f"PASS: {len(configs)} configurations preserved, {len(links)} explicit mappings, exact modes, source CIs/costs and price inputs verified")
