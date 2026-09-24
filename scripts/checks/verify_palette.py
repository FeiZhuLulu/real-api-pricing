# -*- coding: utf-8 -*-
"""校验共享渠道配色（config/channel-colors.json）：
0. 数据里每个 point id 都命中 channels 里的一个前缀；
1. 数据里出现的每个渠道都有色值；2. StepFun 保持 CONVENTIONS 指定的 #00F4E5；
3. 数据中实际出现的渠道两两之间 CIEDE2000 色差 ≥ MIN_DELTA_E（避免肉眼难分的一对）；
   config 里 brandPairs 列出的品牌色对（两家都用本家品牌色）改用各自登记的下限；
4. 旧的硬编码色板没有回流到出图脚本。"""
from __future__ import annotations

import itertools
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from palette import ALIASES, BRAND_PAIRS, COLORS, channel_of  # noqa: E402

MIN_DELTA_E = 15.0


def lab(hex_color: str) -> tuple[float, float, float]:
    rgb = [int(hex_color.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    r, g, b = (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116  # noqa: E731
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def delta_e(c1: str, c2: str) -> float:
    (L1, a1, b1), (L2, a2, b2) = lab(c1), lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    G = 0.5 * (1 - math.sqrt(((C1 + C2) / 2) ** 7 / (((C1 + C2) / 2) ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1 = math.degrees(math.atan2(b1, a1p)) % 360
    h2 = math.degrees(math.atan2(b2, a2p)) % 360
    dh = 0 if C1p * C2p == 0 else (h2 - h1 if abs(h2 - h1) <= 180 else h2 - h1 - 360 if h2 > h1 else h2 - h1 + 360)
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lb, Cb = (L1 + L2) / 2, (C1p + C2p) / 2
    hb = h1 + h2 if C1p * C2p == 0 else (h1 + h2) / 2 if abs(h1 - h2) <= 180 else (h1 + h2 + 360) / 2 if h1 + h2 < 360 else (h1 + h2 - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb))
         + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.20 * math.cos(math.radians(4 * hb - 63)))
    RC = 2 * math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))
    SL = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2)
    SC, SH = 1 + 0.045 * Cb, 1 + 0.015 * Cb * T
    RT = -math.sin(math.radians(60 * math.exp(-(((hb - 275) / 25) ** 2)))) * RC
    return math.sqrt(((L2 - L1) / SL) ** 2 + ((C2p - C1p) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2p - C1p) / SC) * (dH / SH))


def main() -> None:
    points = json.loads((ROOT / "derived" / "points.json").read_text(encoding="utf-8"))["points"]
    errors = []
    channels = set()
    for p in points:
        try:
            channels.add(channel_of(p["id"]))
        except ValueError:
            errors.append(f"point {p['id']!r} matches no id prefix in config/channel-colors.json channels")
    channels = sorted(channels)
    errors += [f"channel {c!r} has no colour in config/channel-colors.json" for c in channels if c not in COLORS]
    if COLORS.get("StepFun") != "#00F4E5":
        errors.append("StepFun must stay #00F4E5 (CONVENTIONS.md §5)")
    for alias, target in ALIASES.items():
        if target not in COLORS:
            errors.append(f"alias {alias!r} points to unknown channel {target!r}")
    present = [c for c in channels if c in COLORS]
    pairs = sorted((delta_e(COLORS[a], COLORS[b]), a, b) for a, b in itertools.combinations(present, 2))
    for d, a, b in pairs:
        floor = BRAND_PAIRS.get(f"{a}|{b}", BRAND_PAIRS.get(f"{b}|{a}", MIN_DELTA_E))
        if d < floor:
            errors.append(f"{a} {COLORS[a]} vs {b} {COLORS[b]}: ΔE2000 {d:.1f} < {floor}")
    legacy = re.compile(r'"(?:#00A86B|#F07826|#B65CFF|#FFB81C|#2FA8FF|#708090|#A0785C|#FFA000)"', re.I)
    for script in ("plot_svg.py", "plot_quotas.py", "build_html.py"):
        if legacy.search((ROOT / "scripts" / script).read_text(encoding="utf-8")):
            errors.append(f"scripts/{script} still hard-codes the old palette; read config/channel-colors.json")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    regular = [x for x in pairs if f"{x[1]}|{x[2]}" not in BRAND_PAIRS and f"{x[2]}|{x[1]}" not in BRAND_PAIRS]
    d, a, b = regular[0]
    brand = ", ".join(f"{x[1]}/{x[2]} {x[0]:.1f}" for x in pairs if x not in regular)
    print(f"Palette OK: {len(present)} channels, closest pair {a}/{b} ΔE2000 {d:.1f} (≥ {MIN_DELTA_E})"
          + (f"; brand pairs {brand}." if brand else "."))


if __name__ == "__main__":
    main()
