"""Trace official raster marks into 24x24 SVG from local source files."""
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent


def bbox_pred(im, pred):
    xs, ys = [], []
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            if pred(px[x, y]):
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def to_box(im, pred, scale=24):
    w, h = im.size
    x0, y0, x1, y1 = bbox_pred(im, pred)
    return (
        x0 / w * scale,
        y0 / h * scale,
        (x1 + 1) / w * scale,
        (y1 + 1) / h * scale,
    )


def rect(x0, y0, x1, y1, fill):
    return (
        f'  <rect x="{x0:.3f}" y="{y0:.3f}" width="{x1 - x0:.3f}" '
        f'height="{y1 - y0:.3f}" fill="{fill}"/>'
    )


# --- OpenCode official 1024 PNG ---
oc = Image.open(
    OUT / "_src" / "opencode-official.png"
).convert("RGB")
white = to_box(oc, lambda p: p[0] > 200)
gray = to_box(oc, lambda p: 50 < p[0] < 120 and abs(p[0] - p[1]) < 20)
black_inner = to_box(
    oc, lambda p: p[0] < 30 and p[1] < 30 and p[2] < 30
)
print("opencode white", white)
print("opencode gray", gray)
print("opencode blackish", black_inner)
# black inner is the top pane only if we restrict Y to the white frame
px = oc.load()
w, h = oc.size
ys = [
    y
    for y in range(int(white[1] / 24 * h), int(white[3] / 24 * h))
    for x in range(int(white[0] / 24 * w), int(white[2] / 24 * w))
    if px[x, y][0] < 30
]
xs = [
    x
    for y in range(int(white[1] / 24 * h), int(white[3] / 24 * h))
    for x in range(int(white[0] / 24 * w), int(white[2] / 24 * w))
    if px[x, y][0] < 30
]
top = (
    min(xs) / w * 24,
    min(ys) / h * 24,
    (max(xs) + 1) / w * 24,
    (max(ys) + 1) / h * 24,
)
print("opencode top black", top)

oc_svg = "\n".join(
    [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
        '  <rect width="24" height="24" fill="#0E0E0E"/>',
        rect(*white, "#FFFFFF"),
        rect(*top, "#0E0E0E"),
        rect(*gray, "#4B4646"),
        "</svg>",
        "",
    ]
)
(OUT / "opencode.svg").write_text(oc_svg, encoding="utf-8")

# --- GLM Z from 180x172 PNG ---
glm = Image.open(OUT / "_src" / "glm-logo.png").convert("L")
gw, gh = glm.size
gpx = glm.load()
THR = 240
white = [(x, y) for y in range(gh) for x in range(gw) if gpx[x, y] > THR]
seen = set()
comps = []
for sx, sy in white:
    if (sx, sy) in seen:
        continue
    stack = [(sx, sy)]
    seen.add((sx, sy))
    pts = []
    while stack:
        x, y = stack.pop()
        pts.append((x, y))
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < gw and 0 <= ny < gh and (nx, ny) not in seen and gpx[nx, ny] > THR:
                seen.add((nx, ny))
                stack.append((nx, ny))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    comps.append((len(pts), min(xs), min(ys), max(xs), max(ys)))
comps.sort(reverse=True)
print("glm components", comps[:6])
for n, x0, y0, x1, y1 in comps[:5]:
    print(
        "  box",
        n,
        (x0 / gw * 24, y0 / gh * 24, (x1 + 1) / gw * 24, (y1 + 1) / gh * 24),
    )
# sample left/right edges of the largest 3
for i, (n, x0, y0, x1, y1) in enumerate(comps[:3]):
    print(f"component {i} edges")
    for y in range(y0, y1 + 1, max(1, (y1 - y0) // 8)):
        xs = [x for x in range(x0, x1 + 1) if gpx[x, y] > THR]
        if xs:
            print(
                f"  y={y/gh*24:.2f} L={xs[0]/gw*24:.2f} R={(xs[-1]+1)/gw*24:.2f}"
            )
