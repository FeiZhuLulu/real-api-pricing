"""Check DeepSWE configuration identity, attempt rates and task costs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
archive = json.loads((ROOT / "data/research/scores-deepswe-1.1-2026-09-12.json").read_text())
assert archive["taskCount"] == 113
assert len(archive["scores"]) == 70
assert len({s["secondary"]["config"] for s in archive["scores"]}) == 70
for row in archive["scores"]:
    sec = row["secondary"]
    assert abs(row["score"] - 100 * sec["passed"] / sec["attempted"]) < 1e-9
    assert sec["ciMinus"] >= 0 and sec["ciPlus"] >= 0
    assert sec["meanCostUsdPerTask"] >= 0
    assert sec["medianCostPerTaskUsd"] >= 0
    assert sec["agentHarness"] == "mini-swe-agent"
configs = json.loads((ROOT / "derived/benchmark-configurations.json").read_text())
deep = [c for c in configs if c["board"] == "deepswe_1_1"]
assert len(deep) == 71
astra = [c for c in deep if c["model"] == "gpt-6-astra"]
assert {c["reasoning_effort"] for c in astra} == {"low", "medium", "high", "xhigh", "max"}
assert max(astra, key=lambda c: c["score"])["reasoning_effort"] == "xhigh"
vendor = next(c for c in deep if c["model"] == "deepseek-v4.1-flash")
assert vendor["score"] == 74.2 and vendor["score_is_self_reported"]
assert vendor["agent_harness"] == "mini-SWE"
assert vendor["score_low"] is None and vendor["mean_cost_usd_per_task"] is None
print("PASS: DeepSWE attempt rates, intervals, effort levels, costs and vendor provenance")
