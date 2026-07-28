#!/usr/bin/env python3
"""Generate unique Warheads / Accessories case & key artwork (512×512 PNG)."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "assets" / "cases"
KEYS = ROOT / "assets" / "keys"


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, int(v)))


def noise_hash(i: float) -> float:
    x = math.sin(i * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def radial_bg(size, inner, outer, cx=0.5, cy=0.42):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            dx = x / size - cx
            dy = y / size - cy
            d = math.sqrt(dx * dx + dy * dy) / 0.85
            n = noise_hash(x * 0.07 + y * 0.11) * 0.08
            t = max(0.0, min(1.0, d + n))
            px[x, y] = mix(inner, outer, t)
    return img


def vignette(img, strength=0.55):
    size = img.size[0]
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for i in range(40):
        a = int(strength * 200 * (i / 40) ** 1.5)
        m = int(size * 0.015 * i)
        if size - m <= m:
            break
        d.rectangle([m, m, size - m - 1, size - m - 1], outline=(0, 0, 0, a))
    base = img.convert("RGBA")
    return Image.alpha_composite(base, overlay).convert("RGB")


def draw_bevel_rect(draw, box, fill, edge_light, edge_dark, radius=28, width=4):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=radius, fill=fill)
    # light edge
    draw.rounded_rectangle(box, radius=radius, outline=edge_light, width=width)
    # inner dark lip
    draw.rounded_rectangle(
        [x0 + 6, y0 + 6, x1 - 6, y1 - 6],
        radius=max(8, radius - 6),
        outline=edge_dark,
        width=2,
    )


def try_font(size):
    for name in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def stamp_label(img, lines, color, y=420):
    draw = ImageDraw.Draw(img)
    font = try_font(28)
    small = try_font(16)
    w, h = img.size
    for i, line in enumerate(lines):
        f = font if i == 0 else small
        bbox = draw.textbbox((0, 0), line, font=f)
        tw = bbox[2] - bbox[0]
        draw.text(((w - tw) / 2 + 1, y + i * 30 + 1), line, font=f, fill=(0, 0, 0, 180) if img.mode == "RGBA" else (0, 0, 0))
        draw.text(((w - tw) / 2, y + i * 30), line, font=f, fill=color)


def make_warheads_case(path: Path):
    size = 512
    img = radial_bg(size, (48, 12, 10), (8, 6, 10), cx=0.48, cy=0.38)
    # ember sparks
    px = img.load()
    rng = random.Random(42)
    for _ in range(140):
        x, y = rng.randint(20, 490), rng.randint(20, 490)
        heat = rng.randint(0, 2)
        c = [(255, 90, 40), (255, 180, 60), (255, 220, 140)][heat]
        r = rng.randint(1, 3)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < size and 0 <= yy < size:
                        px[xx, yy] = mix(px[xx, yy], c, 0.55)

    draw = ImageDraw.Draw(img, "RGBA")
    # crate body
    box = [70, 95, 442, 390]
    draw_bevel_rect(
        draw, box,
        fill=(62, 28, 22),
        edge_light=(255, 140, 70),
        edge_dark=(20, 8, 6),
        radius=22,
    )
    # hazard stripes
    stripe = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripe)
    for i in range(-2, 14):
        x = 90 + i * 36
        sd.polygon(
            [(x, 120), (x + 22, 120), (x - 40, 370), (x - 62, 370)],
            fill=(255, 190, 40, 55),
        )
    img = Image.alpha_composite(img.convert("RGBA"), stripe).convert("RGB")
    draw = ImageDraw.Draw(img, "RGBA")

    # metal latch band
    draw.rounded_rectangle([95, 210, 417, 268], radius=8, fill=(28, 18, 16), outline=(180, 90, 40), width=2)
    # warhead icon — pointed shell
    cx, cy = 256, 230
    draw.ellipse([cx - 54, cy - 34, cx + 54, cy + 34], fill=(30, 30, 34), outline=(220, 80, 50), width=3)
    draw.polygon(
        [(cx - 8, cy - 70), (cx + 8, cy - 70), (cx + 18, cy - 20), (cx - 18, cy - 20)],
        fill=(200, 50, 40),
        outline=(255, 160, 80),
    )
    draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(255, 120, 40))
    # rivets
    for x in (110, 150, 362, 402):
        for y in (130, 350):
            draw.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(180, 100, 50))

    img = vignette(img, 0.5)
    stamp_label(img, ["WARHEADS", "ORDNANCE CASE"], (255, 200, 140))
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


def make_accessories_case(path: Path):
    size = 512
    img = radial_bg(size, (18, 42, 58), (6, 10, 18), cx=0.52, cy=0.4)
    px = img.load()
    # cool tech grid
    for y in range(0, size, 18):
        for x in range(size):
            if noise_hash(x * 0.2 + y) > 0.72:
                px[x, y] = mix(px[x, y], (80, 200, 255), 0.35)
    for x in range(0, size, 18):
        for y in range(size):
            if noise_hash(y * 0.2 + x + 9) > 0.78:
                px[x, y] = mix(px[x, y], (40, 160, 220), 0.3)

    draw = ImageDraw.Draw(img, "RGBA")
    box = [68, 90, 444, 388]
    draw_bevel_rect(
        draw, box,
        fill=(22, 40, 52),
        edge_light=(120, 220, 255),
        edge_dark=(8, 16, 24),
        radius=26,
    )
    # frosted glass panel
    draw.rounded_rectangle([100, 130, 412, 300], radius=16, fill=(30, 70, 90, 160), outline=(160, 230, 255, 200), width=2)
    # gear / wrench motif
    cx, cy = 256, 215
    draw.ellipse([cx - 48, cy - 48, cx + 48, cy + 48], outline=(180, 240, 255), width=7)
    draw.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(12, 24, 34), outline=(100, 200, 230), width=3)
    for i in range(8):
        a = i * math.pi / 4
        x0 = cx + math.cos(a) * 34
        y0 = cy + math.sin(a) * 34
        x1 = cx + math.cos(a) * 58
        y1 = cy + math.sin(a) * 58
        draw.line([(x0, y0), (x1, y1)], fill=(200, 240, 255), width=8)
    # scope crosshair accent
    draw.line([(cx - 70, cy), (cx - 52, cy)], fill=(255, 210, 90), width=3)
    draw.line([(cx + 52, cy), (cx + 70, cy)], fill=(255, 210, 90), width=3)
    draw.line([(cx, cy - 70), (cx, cy - 52)], fill=(255, 210, 90), width=3)
    draw.line([(cx, cy + 52), (cx, cy + 70)], fill=(255, 210, 90), width=3)
    # bottom tech strip
    draw.rounded_rectangle([110, 320, 402, 358], radius=8, fill=(10, 24, 34), outline=(80, 180, 220), width=2)
    for i in range(7):
        x = 130 + i * 38
        draw.rectangle([x, 330, x + 22, 348], fill=(40, 160, 200) if i % 2 == 0 else (255, 190, 70))

    img = vignette(img, 0.48)
    stamp_label(img, ["ACCESSORIES", "MOD CASE"], (180, 230, 255))
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


def make_key_blank(inner, outer, accent, seed=1):
    size = 512
    img = radial_bg(size, inner, outer, cx=0.5, cy=0.45)
    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    # soft bokeh
    for _ in range(40):
        x, y = rng.randint(0, 500), rng.randint(0, 500)
        r = rng.randint(8, 28)
        col = (*accent, rng.randint(20, 55))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=col)
    return img


def draw_key_shape(draw, accent, metal, tip_color):
    # bow (head)
    draw.ellipse([168, 70, 344, 246], fill=metal, outline=accent, width=5)
    draw.ellipse([208, 110, 304, 206], fill=(18, 18, 22), outline=accent, width=3)
    # shaft
    draw.rounded_rectangle([236, 220, 276, 420], radius=10, fill=metal, outline=accent, width=3)
    # bit / teeth
    draw.polygon(
        [(276, 360), (330, 360), (330, 380), (300, 380), (300, 400), (330, 400), (330, 420), (276, 420)],
        fill=tip_color,
        outline=accent,
    )
    # shine
    draw.arc([180, 82, 300, 200], 200, 320, fill=(255, 255, 255, 90), width=4)


def make_warheads_key(path: Path):
    img = make_key_blank((60, 18, 14), (12, 6, 8), (255, 120, 50), seed=7)
    draw = ImageDraw.Draw(img, "RGBA")
    draw_key_shape(draw, (255, 150, 60), (90, 36, 28), (220, 70, 40))
    # explosive ring mark on bow
    draw.ellipse([228, 130, 284, 186], outline=(255, 200, 80), width=4)
    draw.ellipse([244, 146, 268, 170], fill=(255, 100, 40))
    img = vignette(img, 0.52)
    stamp_label(img, ["WARHEADS KEY"], (255, 190, 120), y=445)
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


def make_accessories_key(path: Path):
    img = make_key_blank((16, 40, 56), (6, 10, 16), (90, 210, 255), seed=11)
    draw = ImageDraw.Draw(img, "RGBA")
    draw_key_shape(draw, (120, 220, 255), (36, 64, 80), (255, 200, 80))
    # hex bolt in bow
    cx, cy, r = 256, 158, 22
    pts = [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in [i * math.pi / 3 for i in range(6)]]
    draw.polygon(pts, fill=(20, 36, 48), outline=(180, 240, 255))
    draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 200, 80))
    img = vignette(img, 0.5)
    stamp_label(img, ["ACCESSORIES KEY"], (160, 220, 255), y=445)
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


def main():
    CASES.mkdir(parents=True, exist_ok=True)
    KEYS.mkdir(parents=True, exist_ok=True)
    make_warheads_case(CASES / "warheads-case.png")
    make_accessories_case(CASES / "accessories-case.png")
    make_warheads_key(KEYS / "warheads-key.png")
    make_accessories_key(KEYS / "accessories-key.png")


if __name__ == "__main__":
    main()
