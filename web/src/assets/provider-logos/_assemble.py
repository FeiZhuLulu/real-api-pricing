# Assemble website provider SVGs. Sources: Lobe Icons (MIT) + a few drawn marks.
from pathlib import Path
import re
import shutil

HERE = Path(__file__).resolve().parent
FETCH = HERE / "_fetch"
SRC_LOCAL = HERE / "_src"


def clean(svg: str, fill: str | None = None) -> str:
    svg = re.sub(r"\s(height|width)=\"1em\"", "", svg)
    svg = re.sub(r"\sstyle=\"[^\"]*\"", "", svg)
    svg = re.sub(r"<title>[^<]*</title>", "", svg)
    svg = re.sub(r"\srole=\"img\"", "", svg)
    if fill:
        svg = svg.replace('fill="currentColor"', f'fill="{fill}"')
    if "xmlns=" not in svg:
        svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    svg = re.sub(r"\s{2,}", " ", svg)
    return svg.strip() + "\n"


def write(name: str, svg: str) -> None:
    (HERE / name).write_text(svg if svg.endswith("\n") else svg + "\n", encoding="utf-8")


def from_fetch(src_name: str, dest_name: str, fill: str | None = None) -> None:
    for folder in (FETCH, SRC_LOCAL):
        path = folder / src_name
        if path.exists():
            write(dest_name, clean(path.read_text(encoding="utf-8"), fill))
            return
    raise FileNotFoundError(src_name)


# Lobe Icons / Simple Icons copies
from_fetch("openai.svg", "openai.svg", "#111111")
from_fetch("anthropic.svg", "anthropic.svg", "#191919")
from_fetch("deepseek.svg", "deepseek.svg", "#4D6BFE")
from_fetch("google-color.svg", "google.svg")
from_fetch("ollama.svg", "ollama.svg", "#111111")
from_fetch("xiaomi-si.svg", "xiaomi.svg", "#FF6900")
from_fetch("hunyuan-color.svg", "tencent.svg")
from_fetch("meta.svg", "meta.svg", "#0081FB")
from_fetch("microsoft-color.svg", "microsoft.svg")
from_fetch("longcat-color.svg", "meituan.svg")
from_fetch("claude.svg", "claude.svg", "#D97757")

# Eyes on LongCat should stay dark on the green body.
meituan = (HERE / "meituan.svg").read_text(encoding="utf-8")
meituan = meituan.replace(
    '<path d="M9.213 16.843h1.52v-3.546h-1.29l-.23 3.546zm5.573 0h-1.52v-3.546h1.29l.23 3.546z"></path>',
    '<path d="M9.213 16.843h1.52v-3.546h-1.29l-.23 3.546zm5.573 0h-1.52v-3.546h1.29l.23 3.546z" fill="#111111"></path>',
)
(HERE / "meituan.svg").write_text(meituan, encoding="utf-8")

# alibaba.svg: official Qwen blue mark (qwen-icon.svg) copied from the brand library.
# minimax.svg: official MiniMax gradient mark (minimax-icon.svg) copied from the brand library.
# opencode.svg / opencode-dark.svg: official OpenCode mark, light/dark variants
#   (opencode-icon.svg / opencode-icon-dark.svg) copied from the brand library.
# command-code.svg: official Command Code symbol (commandcode-icon.svg) copied
#   from the brand library, minus the thin outer ring (it blurs at 20 px).
#   command-code-dark.svg: same symbol with tile and glyph colours swapped
#   (white tile, black ⌘).
# zhipu.svg: official z.ai mark (zai-icon.svg) copied from the brand library.
# xai.svg / xai-dark.svg: official SpaceXAI (formerly xAI) squared tiles,
#   black tile ("spacexai - symbol - white - squared.svg") / white tile
#   ("spacexai - symbol - black - squared.svg"), copied from the brand library.
# stepfun.svg: official 5-square mark + current X-avatar gradient.
# kimi.svg / kimi-dark.svg: official Kimi Logomark tile, light/dark brand-kit variants.
# devin.svg / devin-dark.svg: official Devin mark, dark-ink and white variants.
# factory.svg: official factory.ai favicon (realfavicongenerator wrapper
#   unwrapped to the inner SVG; #020202 tile with #FAFAFA mark, light theme).
#   factory-dark.svg: same favicon with tile and mark colours swapped
#   (#FAFAFA tile, #020202 mark).
# cursor.webp / cursor-dark.webp: official Cursor square avatars
#   (AVATAR_SQUARE_2D_DARK.png / AVATAR_SQUARE_2D_LIGHT.png), resized to 128px.
# ollama-dark.webp: official ollama.com apple-touch-icon (180px), dark theme only.
# Muse Spark uses meta.svg. Do not overwrite those files here.

# Keep fetch only as a cache; do not publish it.
print("wrote", sorted(p.name for p in HERE.glob("*.svg")))
