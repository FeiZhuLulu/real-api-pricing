# -*- coding: utf-8 -*-
"""渠道配色的唯一来源：config/channel-colors.json（网站与所有 Python 图共用）。"""
from __future__ import annotations

import json
from pathlib import Path

_CONFIG = json.loads(
    (Path(__file__).resolve().parent.parent / "config" / "channel-colors.json").read_text(encoding="utf-8")
)
COLORS: dict[str, str] = _CONFIG["colors"]
ALIASES: dict[str, str] = _CONFIG["aliases"]
BRAND_PAIRS: dict[str, float] = {k: v for k, v in _CONFIG.get("brandPairs", {}).items() if not k.startswith("_")}
FALLBACK: str = _CONFIG["fallback"]
FRONTIER: str = _CONFIG["frontier"]


def color(name: str) -> str:
    """渠道名（含旧脚本别名 Claude/GLM/Gemini）→ 色值；未知渠道用 fallback。"""
    return COLORS.get(ALIASES.get(name, name), FALLBACK)


def palette(names: list[str]) -> dict[str, str]:
    """按给定顺序（决定图例顺序）生成 {脚本内渠道名: 色值}。"""
    return {name: color(name) for name in names}


def luminance(hex_color: str) -> float:
    r, g, b = (int(hex_color.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def shade(hex_color: str, amount: float) -> str:
    """向黑色混合 amount（0–1），给浅色点描一圈同色相深边，白底上才看得清。"""
    h = hex_color.lstrip("#")
    return "#" + "".join(f"{round(int(h[i:i + 2], 16) * (1 - amount)):02X}" for i in (0, 2, 4))
