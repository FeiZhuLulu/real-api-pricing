# -*- coding: utf-8 -*-
"""快照日期守卫：data/adopted.csv 相对 --base 变化时，data/conventions.json 的
updatedAt 必须是严格更晚的有效 ISO 日期（CONVENTIONS.md 「数据快照日期」）。"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADOPTED = "data/adopted.csv"
CONVENTIONS = "data/conventions.json"


def show(ref: str, path: str) -> str | None:
    r = subprocess.run(
        ["git", "-C", str(ROOT), "show", f"{ref}:{path}"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return r.stdout if r.returncode == 0 else None


def updated_at(text: str) -> date | None:
    try:
        return date.fromisoformat(json.loads(text)["updatedAt"])
    except (KeyError, TypeError, ValueError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main", help="git ref to diff against")
    args = parser.parse_args()
    base_adopted = show(args.base, ADOPTED)
    base_conventions = show(args.base, CONVENTIONS)
    if base_adopted is None or base_conventions is None:
        sys.exit(f"cannot resolve {args.base}; run `git fetch` first")
    work_adopted = (ROOT / ADOPTED).read_text(encoding="utf-8")
    if base_adopted.replace("\r\n", "\n") == work_adopted.replace("\r\n", "\n"):
        print(f"OK: {ADOPTED} unchanged vs {args.base}")
        return
    work_updated = updated_at((ROOT / CONVENTIONS).read_text(encoding="utf-8"))
    base_updated = updated_at(base_conventions)
    if work_updated is None or base_updated is None or work_updated <= base_updated:
        sys.exit(
            f"{ADOPTED} changed vs {args.base} but conventions.json updatedAt "
            f"({work_updated or 'invalid'}) did not advance past {args.base} "
            f"({base_updated or 'invalid'}); set it to today — "
            "see CONVENTIONS.md 「数据快照日期」"
        )
    print(f"OK: {ADOPTED} changed and updatedAt advanced {base_updated} → {work_updated}")


if __name__ == "__main__":
    main()
