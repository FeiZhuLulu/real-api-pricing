"""Keep long benchmark labels readable without changing their source records."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from plot_quotas import chart_variant

for harness in ("DeepSeek Harness Minimal", "mini-SWE"):
    variant = f"{harness} - DeepSeek V4.1 Flash (max) [vendor self-report]"
    row = {"board_variant": variant, "board_harness": harness}
    expected = (f"DeepSeek V4.1 Flash (max)\n{harness} · vendor self-report"
                if len(variant) > 60 else variant)
    assert chart_variant(row) == expected
    assert row["board_variant"] == variant

short = "Codex - GPT-6 Astra (max)"
assert chart_variant({"board_variant": short}) == short
long = "A long benchmark configuration with enough words to exceed the chart label width"
wrapped = chart_variant({"board_variant": long})
assert "\n" in wrapped and wrapped.replace("\n", " ") == long
assert all(len(line) <= 60 for line in wrapped.splitlines())
print("PASS: short labels unchanged; long labels wrapped; source records preserved")
