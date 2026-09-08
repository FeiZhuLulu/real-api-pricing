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
from_fetch("xai.svg", "xai.svg", "#111111")
from_fetch("cursor.svg", "cursor.svg", "#111111")
from_fetch("kimi.svg", "kimi.svg", "#111111")
kimi = (HERE / "kimi.svg").read_text(encoding="utf-8")
write("kimi.svg", kimi.replace('<path d="M21.846', '<path fill="#1783FF" d="M21.846'))
from_fetch("minimax.svg", "minimax.svg", "#E2167E")
from_fetch("qwen.svg", "alibaba.svg", "#615CED")
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

# zhipu.svg / opencode.svg: traced in _trace.py.
# command-code.svg: official cmdsymbol from commandcode.ai.
# stepfun.svg: official 5-square mark + current X-avatar gradient.
# Muse Spark uses meta.svg. Do not overwrite those files here.

# Keep fetch only as a cache; do not publish it.
print("wrote", sorted(p.name for p in HERE.glob("*.svg")))
