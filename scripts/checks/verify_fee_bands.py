"""Check shared monthly-fee boundaries and complete, disjoint chart membership."""
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from plot_quotas import FEE_BANDS, fee_band_rows

for fee, expected in [(0, "0-30"), (30, "0-30"), (30.01, "30-100"),
                      (99.99, "30-100"), (100, "30-100"), (300, "100-300"),
                      (300.01, None)]:
    row = {"billing": "subscription", "monthly_tokens": "100", "price_usd": str(fee)}
    actual = [b["id"] for b in FEE_BANDS if fee_band_rows([row], b)]
    assert actual == ([expected] if expected else []), (fee, actual)

with (ROOT / "data/adopted.csv").open(encoding="utf-8-sig") as source:
    rows = list(csv.DictReader(source))
key = lambda r: (r["plan_id"], r["served_model"])
members = [r for band in FEE_BANDS for r in fee_band_rows(rows, band)]
expected = [r for r in rows if r["billing"] == "subscription" and r["monthly_tokens"]
            and r["price_usd"] and 0 <= float(r["price_usd"]) <= 300]
assert len(members) == len({key(r) for r in members}), "Overlapping fee bands"
assert {key(r) for r in members} == {key(r) for r in expected}, "Missing allowances"
print("PASS:", {b["id"]: len(fee_band_rows(rows, b)) for b in FEE_BANDS}, "disjoint, complete")

