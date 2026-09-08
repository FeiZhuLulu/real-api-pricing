"""Verify selected AA records against the separately preserved public raw payload."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from compute import SCORE_FILES, current_score_records

archives = [(name, json.loads((ROOT / "data/research" / name).read_text(encoding="utf-8")))
            for name in SCORE_FILES]
raw_archives = {name: archive for name, archive in archives if "rawRecords" in archive}
count = 0
for name, row in current_score_records(archives):
    if name not in raw_archives:
        continue
    raw = raw_archives[name]["rawRecords"][row["boardId"]]
    secondary = row["secondary"]
    if row["boardId"] == "aa_intelligence_index":
        source = next(r for r in raw if r["slug"] == secondary["slug"])
        expected = source["intelligenceIndex"]
        assert secondary["intelligenceIndexIsEstimated"] == source["intelligenceIndexIsEstimated"]
        assert row["variantLabel"] == (source.get("shortName") or source["name"])
    else:
        source = next(r for r in raw if r["id"] == secondary["hostConfigId"])
        expected = source["indexScore"] * 100
        assert secondary["agentHarness"] == source["agentName"]
        assert row["variantLabel"] == source["displayLabel"]
    assert abs(row["score"] - expected) <= 0.000051, (row, expected)
    assert row["checkedAt"] == raw_archives[name]["collectedAt"]
    assert row["source"].startswith("https://artificialanalysis.ai/")
    count += 1
assert count, "No current AA raw snapshot checked"
print(f"PASS: {count} AA configurations match raw scores, variants, harnesses and estimate flags")
